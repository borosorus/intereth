import { BatchExecutionState } from "./types";

export function isExecutionMutable(execution: BatchExecutionState) {
    return execution.status === "idle";
}

export function isExecutionInFlight(execution: BatchExecutionState) {
    return execution.status === "submitting" || execution.status === "pending";
}

export function isExecutionAutoClearable(execution: BatchExecutionState) {
    return execution.status === "idle"
        || execution.status === "confirmed"
        || execution.status === "offchain_failed"
        || execution.status === "reverted";
}

export function canForgetTrackedExecution(execution: BatchExecutionState) {
    return Boolean(execution.batchId) && (
        execution.status === "pending"
        || execution.status === "invalid"
        || execution.status === "partially_reverted"
    );
}
