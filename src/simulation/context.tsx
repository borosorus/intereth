import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NormalizedError, normalizeError } from "../callUtils";
import { chainsById } from "../chainConfig";
import { isExecutionMutable } from "../transaction-plan/executionPolicy";
import { useTransactionPlan } from "../transaction-plan/context";
import { createPlanSimulationSnapshot } from "./decode";
import { HttpJsonRpcTransport, SimulationClient } from "./SimulationClient";
import { PlanSimulationSnapshot, SimulatedRead, SimulatedReadResult } from "./types";

export type SimulationStatus = "idle" | "waiting" | "simulating" | "ready" | "stale" | "error";

interface SimulationState {
    status: SimulationStatus;
    chainId: string | null;
    error: NormalizedError | null;
    snapshot: PlanSimulationSnapshot | null;
}

interface SimulationContextValue extends SimulationState {
    active: boolean;
    revision: string;
    queuedCallCount: number;
    configured: boolean;
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
    const [state, setState] = useState<SimulationState>(initialState);
    const [retryCount, setRetryCount] = useState(0);
    const clientRef = useRef<SimulationClient | null>(null);
    const requestIdRef = useRef(0);
    const context = transactionPlan.state.plan.context;
    const calls = transactionPlan.state.plan.calls;
    const rpcUrl = chainRpcUrl(context?.chainId);
    const sessionAllowed = transactionPlan.sessionStatus === "ready" || transactionPlan.sessionStatus === "disconnected";
    const planAvailable = Boolean(context && calls.length > 0 && isExecutionMutable(transactionPlan.state.execution) && sessionAllowed);
    const configured = rpcUrl.length > 0;
    const active = planAvailable && configured;
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

    const value = useMemo<SimulationContextValue>(() => ({
        ...state,
        active,
        revision,
        queuedCallCount: calls.length,
        configured,
        retry,
        canSimulateChain,
        simulateRead,
    }), [active, calls.length, canSimulateChain, configured, retry, revision, simulateRead, state]);

    return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error("useSimulation must be used inside SimulationProvider");
    }
    return context;
}
