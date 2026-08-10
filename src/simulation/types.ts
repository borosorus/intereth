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

export interface SimulationLog {
    address: string;
    data: string;
    topics: string[];
    raw: unknown;
}

export interface SimulationCallError {
    code?: string | number;
    message: string;
    data?: string;
}

export interface SimulatedCallResult {
    status: "0x0" | "0x1";
    returnData: string;
    gasUsed: string;
    maxUsedGas?: string;
    logs: SimulationLog[];
    error?: SimulationCallError;
    raw: unknown;
}

export interface SimulatedCallsResult {
    calls: SimulatedCallResult[];
    blockNumber?: string;
    raw: unknown;
}

export interface DecodedValue {
    name: string;
    type: string;
    value: string;
}

export interface DecodedEvent {
    address: string;
    name: string;
    signature: string;
    arguments: DecodedValue[];
    kind: "abi" | "erc20-transfer" | "native-transfer";
    raw: SimulationLog;
}

export interface DecodedRevert {
    name: string;
    signature?: string;
    message: string;
    arguments: DecodedValue[];
    data: string;
    kind: "standard" | "custom" | "raw";
}

export interface BalanceChange {
    asset: "native" | "erc20";
    tokenAddress?: string;
    account: string;
    delta: string;
}

export interface PlanSimulatedCall extends SimulatedCallResult {
    callId: string;
    decodedEvents: DecodedEvent[];
    decodedRevert?: DecodedRevert;
}

export interface PlanSimulationSnapshot {
    revision: string;
    chainId: string;
    account: string;
    baseBlockNumber: string;
    simulatedBlockNumber?: string;
    calls: PlanSimulatedCall[];
    balanceChanges: BalanceChange[];
    raw: unknown;
}

export interface WatchResultValue {
    returnData: string;
    values?: DecodedValue[];
}

export type WatchEvaluationStatus = "loading" | "ready" | "blocked" | "error" | "stale";

export interface WatchEvaluation {
    watchId: string;
    revision: string;
    baseBlockNumber: string;
    status: WatchEvaluationStatus;
    base?: WatchResultValue;
    simulated?: WatchResultValue;
    error?: {code?: string | number; message: string};
}

export interface QueuedStateSimulationClient {
    assertChain(expectedChainId: string): Promise<void>;
    getBlockNumber(): Promise<string>;
    readAtBlock(context: PlanContext, read: SimulatedRead, baseBlock: string): Promise<string>;
    simulateCalls(context: PlanContext, calls: QueuedCall[], baseBlock?: string): Promise<SimulatedCallsResult>;
    simulateRead(context: PlanContext, calls: QueuedCall[], read: SimulatedRead, baseBlock?: string): Promise<SimulatedReadResult>;
}
