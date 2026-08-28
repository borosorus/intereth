import { ParamValue } from "../calls/parameters";

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
    decoderAbi: string[];
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

export type WatchDecoderMetadata =
    | {kind: "abi"; functionFragment: string}
    | {kind: "raw"};

export interface WatchExpression {
    id: string;
    chainId: string;
    from: string;
    to: string;
    data: string;
    value: string;
    display: {
        kind: "abi" | "raw";
        functionSignature?: string;
        arguments?: DisplayArgument[];
    };
    decoder: WatchDecoderMetadata;
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

export type SequentialCallExecutionStatus = "submitting" | "pending" | "confirmed" | "failed";

export interface SequentialCallExecution {
    callId: string;
    status: SequentialCallExecutionStatus;
    transactionHash?: string;
    blockNumber?: string;
    gasUsed?: string;
    submittedAt?: number;
    updatedAt?: number;
    error?: BatchExecutionError;
}

export interface SequentialExecutionState {
    status: "idle" | "active" | "completed" | "stopped";
    calls: SequentialCallExecution[];
    startedAt?: number;
    updatedAt?: number;
}

export interface TransactionPlanState {
    plan: {
        context: PlanContext | null;
        calls: QueuedCall[];
        watches: WatchExpression[];
    };
    execution: BatchExecutionState;
    sequentialExecution: SequentialExecutionState;
}

export type TransactionPlanAction =
    | {type: "ADD_CALL"; call: QueuedCall}
    | {type: "UPDATE_CALL"; call: QueuedCall}
    | {type: "REMOVE_CALL"; callId: string}
    | {type: "DUPLICATE_CALL"; call: QueuedCall; afterCallId: string}
    | {type: "MOVE_CALL"; callId: string; direction: "up" | "down"}
    | {type: "CLEAR_PLAN"}
    | {type: "ADD_WATCH"; watch: WatchExpression}
    | {type: "REMOVE_WATCH"; watchId: string}
    | {type: "FORGET_TRACKED_PLAN"}
    | {type: "START_BATCH_SUBMISSION"}
    | {type: "BATCH_SUBMITTED"; batchId: string; submittedAt: number}
    | {type: "BATCH_SUBMISSION_FAILED"; error: BatchExecutionError}
    | {type: "BATCH_STATUS_UPDATED"; execution: BatchExecutionState; updatedAt: number}
    | {type: "RESET_FAILED_BATCH"}
    | {type: "START_SEQUENTIAL_EXECUTION"; startedAt: number}
    | {type: "START_SEQUENTIAL_CALL"; callId: string}
    | {type: "SEQUENTIAL_CALL_SUBMITTED"; callId: string; transactionHash: string; submittedAt: number}
    | {type: "SEQUENTIAL_CALL_CONFIRMED"; callId: string; transactionHash: string; blockNumber: string; gasUsed: string; updatedAt: number}
    | {type: "SEQUENTIAL_CALL_FAILED"; callId: string; error: BatchExecutionError; updatedAt: number; transactionHash?: string; blockNumber?: string; gasUsed?: string}
    | {type: "RETRY_SEQUENTIAL_CALL"; callId: string}
    | {type: "STOP_SEQUENTIAL_EXECUTION"; updatedAt: number};
