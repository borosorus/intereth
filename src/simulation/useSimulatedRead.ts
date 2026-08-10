import { useCallback, useEffect, useRef, useState } from "react";
import { useSimulation } from "./context";
import { SimulatedRead, SimulatedReadResult } from "./types";
import { useWorkspaceMode } from "../workspace/context";

interface CompletedSimulatedRead {
    result: SimulatedReadResult;
    queuedCallCount: number;
}

export function useSimulatedRead(chainId?: string) {
    const simulation = useSimulation();
    const workspace = useWorkspaceMode();
    const [loading, setLoading] = useState(false);
    const requestId = useRef(0);
    const available = Boolean(workspace.mode === "simulate" && chainId && simulation.canSimulateChain(chainId));

    useEffect(() => {
        requestId.current += 1;
        setLoading(false);
        return () => {
            requestId.current += 1;
        };
    }, [simulation.revision, workspace.mode]);

    const run = useCallback(async (read: SimulatedRead): Promise<CompletedSimulatedRead | null> => {
        if (workspace.mode !== "simulate" || !chainId || !simulation.canSimulateChain(chainId)) {
            throw Object.assign(new Error("Queued-state simulation is not ready for this network."), {code: "SIMULATION_RPC_UNAVAILABLE"});
        }
        const currentRequest = ++requestId.current;
        const queuedCallCount = simulation.queuedCallCount;
        setLoading(true);
        try {
            const result = await simulation.simulateRead(chainId, read);
            return currentRequest === requestId.current ? {result, queuedCallCount} : null;
        } catch (error) {
            if (currentRequest !== requestId.current) return null;
            throw error;
        } finally {
            if (currentRequest === requestId.current) setLoading(false);
        }
    }, [chainId, simulation, workspace.mode]);

    return {
        available,
        enabled: workspace.mode === "simulate" && simulation.active,
        loading,
        revision: simulation.revision,
        run,
    };
}
