import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NormalizedError, normalizeError } from "../callUtils";
import { chainsById } from "../chainConfig";
import { isExecutionMutable } from "../transaction-plan/executionPolicy";
import { useTransactionPlan } from "../transaction-plan/context";
import { createPlanSimulationSnapshot } from "./decode";
import { HttpJsonRpcTransport, SimulationClient } from "./SimulationClient";
import { PlanSimulationSnapshot, SimulatedRead, SimulatedReadResult, TokenMetadata, WatchEvaluation } from "./types";
import { useWorkspaceMode } from "../workspace/context";
import { decodeWatchResult } from "./watchExpressions";
import { tokenMetadataKey, TokenMetadataService } from "./tokenMetadata";

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
    tokenMetadataByAddress: Record<string, TokenMetadata>;
    tokenMetadataResolving: boolean;
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
    const [tokenMetadataByAddress, setTokenMetadataByAddress] = useState<Record<string, TokenMetadata>>({});
    const [tokenMetadataResolving, setTokenMetadataResolving] = useState(false);
    const [metadataService] = useState(() => new TokenMetadataService());
    const [retryCount, setRetryCount] = useState(0);
    const clientRef = useRef<SimulationClient | null>(null);
    const requestIdRef = useRef(0);
    const metadataRequestIdRef = useRef(0);
    const context = transactionPlan.state.plan.context;
    const calls = transactionPlan.state.plan.calls;
    const watches = transactionPlan.state.plan.watches;
    const rpcUrl = chainRpcUrl(context?.chainId);
    const sessionAllowed = transactionPlan.sessionStatus === "ready" || transactionPlan.sessionStatus === "disconnected";
    const planAvailable = Boolean(context && calls.length > 0 && isExecutionMutable(transactionPlan.state.execution) && sessionAllowed);
    const configured = rpcUrl.length > 0;
    const active = planAvailable && configured;
    const watchActive = Boolean(context && configured && sessionAllowed && isExecutionMutable(transactionPlan.state.execution));
    const includedWatches = useMemo(() => workspace.mode === "simulate" ? watches : [], [watches, workspace.mode]);
    const revision = useMemo(() => [
        context?.chainId,
        context?.account,
        ...calls.map((call) => `${call.id}:${call.to}:${call.data}:${call.value}`),
        ...includedWatches.map((watch) => `${watch.id}:${watch.to}:${watch.data}:${watch.value}`),
    ].join("|"), [calls, context?.account, context?.chainId, includedWatches]);

    useEffect(() => {
        const requestId = ++requestIdRef.current;
        const executionMutable = isExecutionMutable(transactionPlan.state.execution);
        const canRun = Boolean(context && configured && sessionAllowed && executionMutable);
        const hasQueuedCalls = calls.length > 0;
        const shouldRun = canRun && (hasQueuedCalls || includedWatches.length > 0);
        if (!shouldRun || !context) {
            clientRef.current = null;
            setState((current) => {
                const snapshot = current.snapshot
                    && hasQueuedCalls
                    && context
                    && current.snapshot.chainId === context.chainId
                    && current.snapshot.account.toLowerCase() === context.account.toLowerCase()
                    ? current.snapshot
                    : null;
                return {status: snapshot ? "stale" : "idle", chainId: context?.chainId ?? null, error: null, snapshot};
            });
            setWatchEvaluations((current) => includedWatches.length === 0
                ? {}
                : Object.fromEntries(includedWatches
                    .filter((watch) => current[watch.id])
                    .map((watch) => [watch.id, {...current[watch.id], status: "stale" as const}])));
            return;
        }

        if (hasQueuedCalls) {
            setState((current) => {
                const snapshot = current.snapshot
                    && current.snapshot.chainId === context.chainId
                    && current.snapshot.account.toLowerCase() === context.account.toLowerCase()
                    ? current.snapshot
                    : null;
                return {status: snapshot ? "stale" : "waiting", chainId: context.chainId, error: null, snapshot};
            });
        } else {
            setState({status: "idle", chainId: context.chainId, error: null, snapshot: null});
        }
        setWatchEvaluations((current) => Object.fromEntries(includedWatches
            .filter((watch) => current[watch.id])
            .map((watch) => [watch.id, {...current[watch.id], status: "stale" as const}])));

        const timer = window.setTimeout(async () => {
            if (hasQueuedCalls) setState((current) => ({...current, status: "simulating", error: null}));
            try {
                const client = new SimulationClient(new HttpJsonRpcTransport(rpcUrl));
                await client.assertChain(context.chainId);
                const baseBlockNumber = await client.getBlockNumber();
                const planResult = hasQueuedCalls
                    ? await client.simulatePlan(context, calls, includedWatches, baseBlockNumber)
                    : null;
                const queueSucceeded = planResult?.queue.calls.every((call) => call.status === "0x1") ?? true;
                const simulatedByWatchId = new Map((planResult?.watches ?? []).map((watch) => [watch.watchId, watch]));
                const watchRevision = `${revision}|canonical`;
                const evaluations = await Promise.all(includedWatches.map(async (watch): Promise<WatchEvaluation> => {
                    try {
                        const read = {to: watch.to, data: watch.data, value: watch.value};
                        const base = decodeWatchResult(watch, await client.readAtBlock(context, read, baseBlockNumber));
                        if (!hasQueuedCalls) {
                            return {watchId: watch.id, revision: watchRevision, baseBlockNumber, status: "ready", base};
                        }
                        if (!queueSucceeded) {
                            return {watchId: watch.id, revision: watchRevision, baseBlockNumber, status: "blocked", base};
                        }
                        const simulated = simulatedByWatchId.get(watch.id);
                        if (!simulated) {
                            throw Object.assign(new Error("The simulation response omitted this watch."), {code: "SIMULATION_RESPONSE_INVALID"});
                        }
                        if (simulated.result.status === "0x0") {
                            return {
                                watchId: watch.id,
                                revision: watchRevision,
                                baseBlockNumber,
                                status: "error",
                                base,
                                error: {
                                    code: simulated.result.error?.code,
                                    message: simulated.result.error?.message ?? "The watch reverted against the queued state.",
                                },
                            };
                        }
                        return {
                            watchId: watch.id,
                            revision: watchRevision,
                            baseBlockNumber,
                            status: "ready",
                            base,
                            simulated: decodeWatchResult(watch, simulated.result.returnData),
                        };
                    } catch (watchError) {
                        const normalized = normalizeError(watchError, "Watch evaluation failed");
                        return {
                            watchId: watch.id,
                            revision: watchRevision,
                            baseBlockNumber,
                            status: "error",
                            error: {code: normalized.code, message: normalized.message},
                        };
                    }
                }));
                if (requestId !== requestIdRef.current) return;
                clientRef.current = hasQueuedCalls ? client : null;
                setWatchEvaluations(Object.fromEntries(evaluations.map((evaluation) => [evaluation.watchId, evaluation])));
                setState(hasQueuedCalls && planResult ? {
                    status: "ready",
                    chainId: context.chainId,
                    error: null,
                    snapshot: createPlanSimulationSnapshot(context, calls, planResult.queue, revision, baseBlockNumber),
                } : {status: "idle", chainId: context.chainId, error: null, snapshot: null});
            } catch (simulationError) {
                if (requestId !== requestIdRef.current) return;
                clientRef.current = null;
                const normalized = normalizeError(simulationError, hasQueuedCalls ? "Simulation unavailable" : "Watch evaluation failed");
                if (hasQueuedCalls) {
                    setState((current) => ({status: "error", chainId: context.chainId, error: normalized, snapshot: current.snapshot}));
                } else {
                    setWatchEvaluations(Object.fromEntries(includedWatches.map((watch) => [watch.id, {
                        watchId: watch.id,
                        revision,
                        baseBlockNumber: "latest",
                        status: "error" as const,
                        error: {code: normalized.code, message: normalized.message},
                    }])));
                }
            }
        }, hasQueuedCalls ? 350 : 0);

        return () => {
            window.clearTimeout(timer);
            if (requestId === requestIdRef.current) requestIdRef.current += 1;
        };
    }, [calls, configured, context, includedWatches, retryCount, revision, rpcUrl, sessionAllowed, transactionPlan.state.execution]);

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
        const requestId = ++metadataRequestIdRef.current;
        const snapshot = state.snapshot;
        if (!snapshot) {
            setTokenMetadataResolving(false);
            return;
        }
        const addresses = Array.from(new Set(snapshot.balanceChanges.flatMap((change) => (
            change.asset === "erc20" && change.tokenAddress ? [change.tokenAddress] : []
        ))));
        if (addresses.length === 0) {
            setTokenMetadataResolving(false);
            return;
        }

        const cached = Object.fromEntries(addresses.flatMap((address) => {
            const metadata = metadataService.getCached(snapshot.chainId, address);
            return metadata ? [[tokenMetadataKey(snapshot.chainId, address), metadata]] : [];
        }));
        if (Object.keys(cached).length > 0) {
            setTokenMetadataByAddress((current) => ({...current, ...cached}));
        }
        const missingAddresses = addresses.filter((address) => !metadataService.getCached(snapshot.chainId, address));
        if (missingAddresses.length === 0) {
            setTokenMetadataResolving(false);
            return;
        }
        setTokenMetadataResolving(true);
        let transport: HttpJsonRpcTransport;
        try {
            transport = new HttpJsonRpcTransport(chainRpcUrl(snapshot.chainId));
        } catch {
            setTokenMetadataResolving(false);
            return;
        }
        void metadataService.resolve(snapshot.chainId, missingAddresses, snapshot.baseBlockNumber, transport)
            .then((metadata) => {
                if (requestId !== metadataRequestIdRef.current) return;
                setTokenMetadataByAddress((current) => ({...current, ...metadata}));
            })
            .catch(() => {
                // Metadata enrichment is optional and must not affect simulation.
            })
            .finally(() => {
                if (requestId === metadataRequestIdRef.current) setTokenMetadataResolving(false);
            });
        return () => {
            if (requestId === metadataRequestIdRef.current) metadataRequestIdRef.current += 1;
        };
    }, [metadataService, state.snapshot]);

    const value = useMemo<SimulationContextValue>(() => ({
        ...state,
        active,
        watchActive,
        revision,
        queuedCallCount: calls.length,
        configured,
        watchEvaluations,
        tokenMetadataByAddress,
        tokenMetadataResolving,
        retry,
        canSimulateChain,
        simulateRead,
    }), [active, calls.length, canSimulateChain, configured, retry, revision, simulateRead, state, tokenMetadataByAddress, tokenMetadataResolving, watchActive, watchEvaluations]);

    return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error("useSimulation must be used inside SimulationProvider");
    }
    return context;
}
