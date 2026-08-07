import { ParamValue } from "../calls/parameters";

export const TRANSACTION_PLAN_STORAGE_VERSION = 3 as const;

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

export interface BatchExecutionError {
    code?: string | number;
    message: string;
}

export interface BatchLog {
    address: string;
    data: string;
    topics: string[];
}

export interface BatchReceipt {
    logs: BatchLog[];
    status: string;
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
    transactionHash: string;
}

export type BatchExecutionStatus =
    | "idle"
    | "submitting"
    | "pending"
    | "confirmed"
    | "offchain_failed"
    | "reverted"
    | "partially_reverted"
    | "invalid";

export interface BatchExecutionState {
    status: BatchExecutionStatus;
    batchId?: string;
    walletStatus?: number;
    atomic?: boolean;
    receipts?: BatchReceipt[];
    submittedAt?: number;
    updatedAt?: number;
    error?: BatchExecutionError;
}

export interface TransactionPlanState {
    version: typeof TRANSACTION_PLAN_STORAGE_VERSION;
    plan: {
        context: PlanContext | null;
        calls: QueuedCall[];
    };
    execution: BatchExecutionState;
}

export type TransactionPlanAction =
    | {type: "ADD_CALL"; call: QueuedCall}
    | {type: "UPDATE_CALL"; call: QueuedCall}
    | {type: "REMOVE_CALL"; callId: string}
    | {type: "DUPLICATE_CALL"; call: QueuedCall; afterCallId: string}
    | {type: "MOVE_CALL"; callId: string; direction: "up" | "down"}
    | {type: "CLEAR_PLAN"}
    | {type: "FORGET_TRACKED_PLAN"}
    | {type: "RESTORE_PLAN"; state: TransactionPlanState}
    | {type: "START_BATCH_SUBMISSION"}
    | {type: "BATCH_SUBMITTED"; batchId: string; submittedAt: number}
    | {type: "BATCH_SUBMISSION_FAILED"; error: BatchExecutionError}
    | {type: "BATCH_STATUS_UPDATED"; execution: BatchExecutionState; updatedAt: number}
    | {type: "RESET_FAILED_BATCH"};
