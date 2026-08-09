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
    blockNumber?: string;
}

export interface QueuedStateSimulationClient {
    assertChain(expectedChainId: string): Promise<void>;
    simulateRead(context: PlanContext, calls: QueuedCall[], read: SimulatedRead): Promise<SimulatedReadResult>;
}
