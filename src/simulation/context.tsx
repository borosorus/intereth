import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NormalizedError, normalizeError } from "../callUtils";
import { chainsById } from "../chainConfig";
import { isExecutionMutable } from "../transaction-plan/executionPolicy";
import { useTransactionPlan } from "../transaction-plan/context";
import { createPlanSimulationSnapshot } from "./decode";
import { HttpJsonRpcTransport, SimulationClient } from "./SimulationClient";
import { PlanSimulationSnapshot, SimulatedRead, SimulatedReadResult, WatchEvaluation } from "./types";
import { useWorkspaceMode } from "../workspace/context";
import { decodeWatchResult } from "./watchExpressions";

export type SimulationStatus = "idle" | "waiting" | "simulating" | "ready" | "stale" | "error";

interface SimulationState {
    status: SimulationStatus;
    chainId: string | null;
    error: NormalizedError | null;
    snapshot: PlanSimulationSnapshot | null;
}

interface SimulationContextValue extends SimulationState {
    active: boolean;
    watchActive: boolean;
    revision: string;
    queuedCallCount: number;
    configured: boolean;
    watchEvaluations: Record<string, WatchEvaluation>;
    retry: () => void;
    canSimulateChain: (chainId: string) => boolean;
    simulateRead: (chainId: string, read: SimulatedRead) => Promise<SimulatedReadResult>;
}

const initialState: SimulationState = {
    status: "idle",
    chainId: null,
    error: null,
    snapshot: null,
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

function chainRpcUrl(chainId: string | undefined) {
    return chainId ? chainsById.get(chainId)?.rpcUrl.trim() ?? "" : "";
}

function errorCode(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error
        ? String((error as {code?: unknown}).code)
        : undefined;
}

function isEndpointError(error: unknown) {
    return [
        "SIMULATION_UNSUPPORTED",
        "SIMULATION_RPC_UNAVAILABLE",
        "SIMULATION_CHAIN_MISMATCH",
        "SIMULATION_RESPONSE_INVALID",
    ].includes(errorCode(error) ?? "");
}

export function SimulationProvider({children}: {children: ReactNode}) {
    const transactionPlan = useTransactionPlan();
    const workspace = useWorkspaceMode();
    const [state, setState] = useState<SimulationState>(initialState);
    const [watchEvaluations, setWatchEvaluations] = useState<Record<string, WatchEvaluation>>({});
    const [retryCount, setRetryCount] = useState(0);
    const clientRef = useRef<SimulationClient | null>(null);
    const requestIdRef = useRef(0);
    const watchRequestIdRef = useRef(0);
    const context = transactionPlan.state.plan.context;
    const calls = transactionPlan.state.plan.calls;
    const watches = transactionPlan.state.plan.watches;
    const rpcUrl = chainRpcUrl(context?.chainId);
    const sessionAllowed = transactionPlan.sessionStatus === "ready" || transactionPlan.sessionStatus === "disconnected";
    const planAvailable = Boolean(context && calls.length > 0 && isExecutionMutable(transactionPlan.state.execution) && sessionAllowed);
    const configured = rpcUrl.length > 0;
    const active = planAvailable && configured;
    const watchActive = Boolean(context && configured && sessionAllowed && isExecutionMutable(transactionPlan.state.execution));
    const revision = useMemo(() => [
        context?.chainId,
        context?.account,
        ...calls.map((call) => `${call.id}:${call.to}:${call.data}:${call.value}`),
    ].join("|"), [calls, context?.account, context?.chainId]);

    useEffect(() => {
        const requestId = ++requestIdRef.current;
        if (!active || !context) {
            clientRef.current = null;
            setState((current) => {
                const snapshot = current.snapshot
                    && context
                    && current.snapshot.chainId === context.chainId
                    && current.snapshot.account.toLowerCase() === context.account.toLowerCase()
                    ? current.snapshot
                    : null;
                return {status: snapshot ? "stale" : "idle", chainId: context?.chainId ?? null, error: null, snapshot};
            });
            return;
        }

        setState((current) => {
            const snapshot = current.snapshot
                && current.snapshot.chainId === context.chainId
                && current.snapshot.account.toLowerCase() === context.account.toLowerCase()
                ? current.snapshot
                : null;
            return {status: snapshot ? "stale" : "waiting", chainId: context.chainId, error: null, snapshot};
        });

        const timer = window.setTimeout(async () => {
            setState((current) => ({...current, status: "simulating", error: null}));
            try {
                const client = new SimulationClient(new HttpJsonRpcTransport(rpcUrl));
                await client.assertChain(context.chainId);
                const baseBlockNumber = await client.getBlockNumber();
                const result = await client.simulateCalls(context, calls, baseBlockNumber);
                if (requestId !== requestIdRef.current) return;
                clientRef.current = client;
                setState({
                    status: "ready",
                    chainId: context.chainId,
                    error: null,
                    snapshot: createPlanSimulationSnapshot(context, calls, result, revision, baseBlockNumber),
                });
            } catch (simulationError) {
                if (requestId !== requestIdRef.current) return;
                clientRef.current = null;
                setState((current) => ({
                    status: "error",
                    chainId: context.chainId,
                    error: normalizeError(simulationError, "Simulation unavailable"),
                    snapshot: current.snapshot,
                }));
            }
        }, 350);

        return () => {
            window.clearTimeout(timer);
            if (requestId === requestIdRef.current) requestIdRef.current += 1;
        };
    }, [active, calls, context, retryCount, revision, rpcUrl]);

    const retry = useCallback(() => setRetryCount((current) => current + 1), []);

    const canSimulateChain = useCallback((chainId: string) => (
        active
        && state.status === "ready"
        && state.chainId === chainId
        && state.snapshot?.revision === revision
        && clientRef.current !== null
    ), [active, revision, state.chainId, state.snapshot?.revision, state.status]);

    const simulateRead = useCallback(async (chainId: string, read: SimulatedRead) => {
        const client = clientRef.current;
        const planContext = transactionPlan.state.plan.context;
        const snapshot = state.snapshot;
        if (!client || !planContext || !snapshot || !canSimulateChain(chainId)) {
            throw Object.assign(new Error("Queued-state simulation is not ready for this network."), {code: "SIMULATION_RPC_UNAVAILABLE"});
        }
        try {
            return await client.simulateRead(planContext, transactionPlan.state.plan.calls, read, snapshot.baseBlockNumber);
        } catch (simulationError) {
            if (isEndpointError(simulationError)) {
                clientRef.current = null;
                setState((current) => ({
                    ...current,
                    status: "error",
                    error: normalizeError(simulationError, "Simulation unavailable"),
                }));
            }
            throw simulationError;
        }
    }, [canSimulateChain, state.snapshot, transactionPlan.state.plan.calls, transactionPlan.state.plan.context]);

    useEffect(() => {
        const requestId = ++watchRequestIdRef.current;
        if (watches.length === 0) {
            setWatchEvaluations({});
            return;
        }
        const hasQueuedCalls = calls.length > 0;
        const queueSnapshotReady = state.status === "ready"
            && state.snapshot?.revision === revision
            && clientRef.current !== null;
        if (workspace.mode !== "simulate" || !watchActive || !context || (hasQueuedCalls && !queueSnapshotReady)) {
            setWatchEvaluations((current) => Object.fromEntries(watches
                .filter((watch) => current[watch.id])
                .map((watch) => {
                    const evaluation = current[watch.id];
                    return [watch.id, state.status === "error"
                        ? evaluation
                        : {...evaluation, status: "stale" as const}];
                })));
            return;
        }

        const watchRevision = `${revision}|${watches.map((watch) => `${watch.id}:${watch.to}:${watch.data}:${watch.value}`).join("|")}`;
        void (async () => {
            let client = clientRef.current;
            let baseBlockNumber = state.snapshot?.baseBlockNumber;
            try {
                if (!hasQueuedCalls) {
                    client = new SimulationClient(new HttpJsonRpcTransport(rpcUrl));
                    await client.assertChain(context.chainId);
                    baseBlockNumber = await client.getBlockNumber();
                }
                if (!client || !baseBlockNumber) return;
                const evaluationBlock = baseBlockNumber;
                setWatchEvaluations((current) => Object.fromEntries(watches.map((watch) => [watch.id, {
                    ...(current[watch.id] ?? {}),
                    watchId: watch.id,
                    revision: watchRevision,
                    baseBlockNumber: evaluationBlock,
                    status: "loading" as const,
                }])));

                const queueSucceeded = !hasQueuedCalls || state.snapshot!.calls.every((call) => call.status === "0x1");
                const evaluate = async (watch: typeof watches[number]) => {
                    try {
                        const read = {to: watch.to, data: watch.data, value: watch.value};
                        const baseData = await client!.readAtBlock(context, read, evaluationBlock);
                        const base = decodeWatchResult(watch, baseData);
                        if (!queueSucceeded) {
                            return {evaluation: {
                                watchId: watch.id, revision: watchRevision, baseBlockNumber: evaluationBlock,
                                status: "blocked" as const, base,
                            }};
                        }
                        if (!hasQueuedCalls) {
                            return {evaluation: {
                                watchId: watch.id, revision: watchRevision, baseBlockNumber: evaluationBlock,
                                status: "ready" as const, base,
                            }};
                        }
                        const simulatedResult = await client!.simulateRead(context, calls, read, evaluationBlock);
                        return {evaluation: {
                            watchId: watch.id, revision: watchRevision, baseBlockNumber: evaluationBlock,
                            status: "ready" as const, base,
                            simulated: decodeWatchResult(watch, simulatedResult.returnData),
                        }};
                    } catch (watchError) {
                        const normalized = normalizeError(watchError, "Watch evaluation failed");
                        return {evaluation: {
                            watchId: watch.id, revision: watchRevision, baseBlockNumber: evaluationBlock,
                            status: "error" as const,
                            error: {code: normalized.code, message: normalized.message},
                        }, sourceError: watchError};
                    }
                };
                const results = await mapWithConcurrency(watches, 4, evaluate);
                if (requestId !== watchRequestIdRef.current) return;
                setWatchEvaluations(Object.fromEntries(results.map(({evaluation}) => [evaluation.watchId, evaluation])));
                const endpointFailure = results.find(({sourceError}) => sourceError && isEndpointError(sourceError));
                if (hasQueuedCalls && endpointFailure?.sourceError) {
                    clientRef.current = null;
                    setState((current) => ({
                        ...current,
                        status: "error",
                        error: normalizeError(endpointFailure.sourceError, "Simulation unavailable"),
                    }));
                }
            } catch (watchError) {
                if (requestId !== watchRequestIdRef.current) return;
                const normalized = normalizeError(watchError, "Watch evaluation failed");
                setWatchEvaluations(Object.fromEntries(watches.map((watch) => [watch.id, {
                    watchId: watch.id,
                    revision: watchRevision,
                    baseBlockNumber: baseBlockNumber ?? "latest",
                    status: "error" as const,
                    error: {code: normalized.code, message: normalized.message},
                }])));
            }
        })();

        return () => {
            if (requestId === watchRequestIdRef.current) watchRequestIdRef.current += 1;
        };
    }, [calls, context, retryCount, revision, rpcUrl, state.snapshot, state.status, watchActive, watches, workspace.mode]);

    const value = useMemo<SimulationContextValue>(() => ({
        ...state,
        active,
        watchActive,
        revision,
        queuedCallCount: calls.length,
        configured,
        watchEvaluations,
        retry,
        canSimulateChain,
        simulateRead,
    }), [active, calls.length, canSimulateChain, configured, retry, revision, simulateRead, state, watchActive, watchEvaluations]);

    return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await mapper(items[index]);
        }
    };
    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
    return results;
}

export function useSimulation() {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error("useSimulation must be used inside SimulationProvider");
    }
    return context;
}
