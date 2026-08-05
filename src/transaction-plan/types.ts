import { ParamValue } from "../calls/parameters";

export const TRANSACTION_PLAN_STORAGE_VERSION = 1 as const;

export interface PlanContext {
    account: string;
    chainId: string;
}

export interface DisplayArgument {
    name: string;
    type: string;
    value: string;
}

export type CallEditorMetadata =
    | {
        kind: "abi";
        functionFragment: string;
        arguments: ParamValue[];
    }
    | {
        kind: "raw";
    };

export interface QueuedCall {
    id: string;
    chainId: string;
    from: string;
    to: string;
    data: string;
    value: string;
    display: {
        kind: "abi" | "raw";
        contractAddress: string;
        functionName?: string;
        functionSignature?: string;
        arguments?: DisplayArgument[];
    };
    editor: CallEditorMetadata;
    createdAt: number;
}

export type ExecutionCallStatus =
    | "not_started"
    | "awaiting_wallet"
    | "submitted"
    | "confirmed"
    | "failed"
    | "skipped";

export interface ExecutionCallResult {
    status: ExecutionCallStatus;
    hash?: string;
    blockNumber?: number;
    gasUsed?: string;
    error?: string;
}

export type ExecutionStatus = "idle" | "executing" | "halted" | "complete";

export interface TransactionPlanState {
    version: typeof TRANSACTION_PLAN_STORAGE_VERSION;
    plan: {
        context: PlanContext | null;
        calls: QueuedCall[];
        requiresResume: boolean;
    };
    execution: {
        status: ExecutionStatus;
        resultsByCallId: Record<string, ExecutionCallResult>;
    };
}

export type TransactionPlanAction =
    | {type: "ADD_CALL"; call: QueuedCall}
    | {type: "UPDATE_CALL"; call: QueuedCall}
    | {type: "REMOVE_CALL"; callId: string}
    | {type: "DUPLICATE_CALL"; call: QueuedCall; afterCallId: string}
    | {type: "MOVE_CALL"; callId: string; direction: "up" | "down"}
    | {type: "CLEAR_PLAN"}
    | {type: "RESUME_PLAN"}
    | {type: "RESTORE_PLAN"; state: TransactionPlanState}
    | {type: "SET_EXECUTION"; execution: TransactionPlanState["execution"]};
