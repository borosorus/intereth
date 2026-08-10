import { PlanContext, QueuedCall } from "../transaction-plan/types";

export interface SimulationRpcTransport {
    send(method: string, params: unknown[]): Promise<unknown>;
}

export interface SimulatedRead {
    to: string;
    data: string;
    value?: string;
}

export interface SimulatedReadResult {
    returnData: string;
    gasUsed: string;
    maxUsedGas?: string;
    blockNumber?: string;
}

export interface SimulatedCallResult {
    status: "0x0" | "0x1";
    returnData: string;
    gasUsed: string;
    maxUsedGas?: string;
}

export interface SimulatedCallsResult {
    calls: SimulatedCallResult[];
    blockNumber?: string;
}

export interface QueuedStateSimulationClient {
    assertChain(expectedChainId: string): Promise<void>;
    simulateCalls(context: PlanContext, calls: QueuedCall[]): Promise<SimulatedCallsResult>;
    simulateRead(context: PlanContext, calls: QueuedCall[], read: SimulatedRead): Promise<SimulatedReadResult>;
}
