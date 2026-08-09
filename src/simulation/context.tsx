import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NormalizedError, normalizeError } from "../callUtils";
import { chainsById } from "../onboard";
import { isExecutionMutable } from "../transaction-plan/executionPolicy";
import { useTransactionPlan } from "../transaction-plan/context";
import { HttpJsonRpcTransport, SimulationClient } from "./SimulationClient";
import { SimulatedRead, SimulatedReadResult } from "./types";

export type SimulationStatus = "disabled" | "checking" | "ready" | "error";

interface SimulationState {
    enabled: boolean;
    status: SimulationStatus;
    chainId: string | null;
    error: NormalizedError | null;
}

interface SimulationContextValue extends SimulationState {
    configured: boolean;
    canEnable: boolean;
    enable: () => Promise<void>;
    disable: () => void;
    retry: () => Promise<void>;
    canSimulateChain: (chainId: string) => boolean;
    simulateRead: (chainId: string, read: SimulatedRead) => Promise<SimulatedReadResult>;
}

const disabledState: SimulationState = {
    enabled: false,
    status: "disabled",
    chainId: null,
    error: null,
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

function simulationRpcUrl(chainId: string | undefined) {
    return chainId ? chainsById.get(chainId)?.simulationRpcUrl.trim() ?? "" : "";
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
    const [state, setState] = useState<SimulationState>(disabledState);
    const clientRef = useRef<SimulationClient | null>(null);
    const requestIdRef = useRef(0);
    const context = transactionPlan.state.plan.context;
    const rpcUrl = simulationRpcUrl(context?.chainId);
    const sessionAllowed = transactionPlan.sessionStatus === "ready" || transactionPlan.sessionStatus === "disconnected";
    const planAvailable = Boolean(
        context
        && transactionPlan.state.plan.calls.length > 0
        && isExecutionMutable(transactionPlan.state.execution)
        && sessionAllowed,
    );
    const configured = rpcUrl.length > 0;
    const canEnable = planAvailable && configured;

    const disable = useCallback(() => {
        requestIdRef.current += 1;
        clientRef.current = null;
        setState(disabledState);
    }, []);

    useEffect(() => {
        if (!planAvailable || !configured || (state.chainId !== null && state.chainId !== context?.chainId)) {
            disable();
        }
    }, [configured, context?.chainId, disable, planAvailable, state.chainId]);

    const enable = useCallback(async () => {
        if (!context || !canEnable) {
            const error = normalizeError(
                Object.assign(new Error(configured
                    ? "Queued-state simulation is unavailable for the current transaction plan."
                    : "No simulation RPC is configured for this network."),
                {code: configured ? "PLAN_CONTEXT_MISMATCH" : "SIMULATION_NOT_CONFIGURED"}),
                "Simulation unavailable",
            );
            setState({enabled: true, status: "error", chainId: context?.chainId ?? null, error});
            return;
        }

        const requestId = ++requestIdRef.current;
        clientRef.current = null;
        setState({enabled: true, status: "checking", chainId: context.chainId, error: null});
        try {
            const client = new SimulationClient(new HttpJsonRpcTransport(rpcUrl));
            await client.assertChain(context.chainId);
            if (requestId !== requestIdRef.current) return;
            clientRef.current = client;
            setState({enabled: true, status: "ready", chainId: context.chainId, error: null});
        } catch (enableError) {
            if (requestId !== requestIdRef.current) return;
            clientRef.current = null;
            setState({
                enabled: true,
                status: "error",
                chainId: context.chainId,
                error: normalizeError(enableError, "Simulation unavailable"),
            });
        }
    }, [canEnable, configured, context, rpcUrl]);

    const canSimulateChain = useCallback((chainId: string) => (
        state.enabled
        && state.status === "ready"
        && state.chainId === chainId
        && context?.chainId === chainId
        && planAvailable
        && clientRef.current !== null
    ), [context?.chainId, planAvailable, state.chainId, state.enabled, state.status]);

    const simulateRead = useCallback(async (chainId: string, read: SimulatedRead) => {
        const client = clientRef.current;
        const planContext = transactionPlan.state.plan.context;
        if (!client || !planContext || !canSimulateChain(chainId)) {
            throw Object.assign(new Error("Queued-state simulation is not ready for this network."), {code: "SIMULATION_RPC_UNAVAILABLE"});
        }
        try {
            return await client.simulateRead(planContext, transactionPlan.state.plan.calls, read);
        } catch (simulationError) {
            if (isEndpointError(simulationError)) {
                clientRef.current = null;
                setState({
                    enabled: true,
                    status: "error",
                    chainId: planContext.chainId,
                    error: normalizeError(simulationError, "Simulation unavailable"),
                });
            }
            throw simulationError;
        }
    }, [canSimulateChain, transactionPlan.state.plan.calls, transactionPlan.state.plan.context]);

    const value = useMemo<SimulationContextValue>(() => ({
        ...state,
        configured,
        canEnable,
        enable,
        disable,
        retry: enable,
        canSimulateChain,
        simulateRead,
    }), [canEnable, canSimulateChain, configured, disable, enable, simulateRead, state]);

    return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error("useSimulation must be used inside SimulationProvider");
    }
    return context;
}
