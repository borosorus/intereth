import { ethers } from "ethers";
import type { ParamValue } from "../calls/parameters";
import { createEmptyTransactionPlanState } from "./reducer";
import {
    BatchExecutionState,
    QueuedCall,
    SequentialCallExecution,
    SequentialExecutionState,
    TransactionPlanState,
    WatchExpression,
} from "./types";
import { isHexData, isRecord, parseBatchReceipt } from "./rpcValidation";

export const TRANSACTION_PLAN_STORAGE_KEY = "intereth.transaction-plan";

function isDecimal(value: unknown): value is string {
    return typeof value === "string" && /^\d+$/.test(value);
}

function isTimestamp(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStoredError(value: unknown) {
    return isRecord(value)
        && typeof value.message === "string"
        && (value.code === undefined || typeof value.code === "string" || typeof value.code === "number");
}

function isParamValue(value: unknown, depth = 0): value is ParamValue {
    if (depth > 32) return false;
    if (typeof value === "string") return true;
    if (Array.isArray(value)) return value.every((item) => isParamValue(item, depth + 1));
    return isRecord(value)
        && typeof value.amount === "string"
        && (value.unit === "wei" || value.unit === "gwei" || value.unit === "ether")
        && Object.keys(value).every((key) => key === "amount" || key === "unit");
}

function hasValidDisplay(value: Record<string, unknown>, target: string) {
    if ((value.kind !== "abi" && value.kind !== "raw")
        || typeof value.contractAddress !== "string"
        || !ethers.isAddress(value.contractAddress)
        || value.contractAddress.toLowerCase() !== target.toLowerCase()
        || (value.functionName !== undefined && typeof value.functionName !== "string")
        || (value.functionSignature !== undefined && typeof value.functionSignature !== "string")) {
        return false;
    }
    return value.arguments === undefined || (Array.isArray(value.arguments) && value.arguments.every((argument) => (
        isRecord(argument)
        && typeof argument.name === "string"
        && typeof argument.type === "string"
        && typeof argument.value === "string"
    )));
}

function hasValidEditor(value: Record<string, unknown>) {
    if (value.kind === "raw") return true;
    if (value.kind !== "abi" || typeof value.functionFragment !== "string" || !Array.isArray(value.arguments)) return false;
    try {
        ethers.FunctionFragment.from(value.functionFragment);
        return value.arguments.every((argument) => isParamValue(argument));
    } catch {
        return false;
    }
}

function hasValidDecoderAbi(value: unknown): value is string[] {
    if (!Array.isArray(value)) return false;
    try {
        return value.every((fragment) => {
            if (typeof fragment !== "string") return false;
            const parsed = ethers.Fragment.from(fragment);
            return parsed.type === "event" || parsed.type === "error";
        });
    } catch {
        return false;
    }
}

function isQueuedCall(value: unknown): value is QueuedCall {
    if (!isRecord(value) || !isRecord(value.display) || !isRecord(value.editor)) return false;
    return typeof value.id === "string"
        && value.id.length > 0
        && isDecimal(value.chainId)
        && typeof value.from === "string"
        && ethers.isAddress(value.from)
        && typeof value.to === "string"
        && ethers.isAddress(value.to)
        && isHexData(value.data)
        && isDecimal(value.value)
        && hasValidDecoderAbi(value.decoderAbi)
        && isTimestamp(value.createdAt)
        && hasValidDisplay(value.display, value.to)
        && hasValidEditor(value.editor)
        && value.display.kind === value.editor.kind;
}

function hasValidWatchDisplay(value: unknown) {
    if (!isRecord(value)
        || (value.kind !== "abi" && value.kind !== "raw")
        || (value.functionSignature !== undefined && typeof value.functionSignature !== "string")) return false;
    return value.arguments === undefined || (Array.isArray(value.arguments) && value.arguments.every((argument) => (
        isRecord(argument)
        && typeof argument.name === "string"
        && typeof argument.type === "string"
        && typeof argument.value === "string"
    )));
}

function hasValidWatchDecoder(value: unknown) {
    if (!isRecord(value) || (value.kind !== "abi" && value.kind !== "raw")) return false;
    if (value.kind === "raw") return Object.keys(value).every((key) => key === "kind");
    if (typeof value.functionFragment !== "string") return false;
    try {
        const fragment = ethers.FunctionFragment.from(value.functionFragment);
        return fragment.stateMutability === "view" || fragment.stateMutability === "pure";
    } catch {
        return false;
    }
}

function isWatchExpression(value: unknown): value is WatchExpression {
    return isRecord(value)
        && typeof value.id === "string"
        && value.id.length > 0
        && isDecimal(value.chainId)
        && typeof value.from === "string"
        && ethers.isAddress(value.from)
        && typeof value.to === "string"
        && ethers.isAddress(value.to)
        && isHexData(value.data)
        && isDecimal(value.value)
        && hasValidWatchDisplay(value.display)
        && hasValidWatchDecoder(value.decoder)
        && (value.display as {kind: string}).kind === (value.decoder as {kind: string}).kind
        && isTimestamp(value.createdAt);
}

const EXECUTION_STATUSES: BatchExecutionState["status"][] = [
    "idle", "submitting", "pending", "confirmed", "offchain_failed", "reverted", "partially_reverted", "invalid",
];

function isExecution(value: unknown): value is BatchExecutionState {
    if (!isRecord(value) || !EXECUTION_STATUSES.includes(value.status as BatchExecutionState["status"])) return false;
    if (value.batchId !== undefined && (!isHexData(value.batchId) || value.batchId === "0x" || value.batchId.length > 8194)) return false;
    if (value.walletStatus !== undefined && (typeof value.walletStatus !== "number" || !Number.isInteger(value.walletStatus) || value.walletStatus < 0)) return false;
    if (value.atomic !== undefined && typeof value.atomic !== "boolean") return false;
    if (value.receipts !== undefined && (!Array.isArray(value.receipts) || !value.receipts.every((receipt) => parseBatchReceipt(receipt) !== null))) return false;
    if (value.submittedAt !== undefined && !isTimestamp(value.submittedAt)) return false;
    if (value.updatedAt !== undefined && !isTimestamp(value.updatedAt)) return false;
    if (value.error !== undefined && !isStoredError(value.error)) return false;
    if (value.status === "idle" || value.status === "submitting") {
        return value.batchId === undefined && value.walletStatus === undefined && value.atomic === undefined && value.receipts === undefined;
    }
    if (typeof value.batchId !== "string") return false;
    if (value.status === "pending") {
        return (value.walletStatus === undefined && value.atomic === undefined) || (value.walletStatus === 100 && value.atomic === true);
    }
    if (value.status === "invalid") return true;
    const expectedWalletStatus: Partial<Record<BatchExecutionState["status"], number>> = {
        confirmed: 200, offchain_failed: 400, reverted: 500, partially_reverted: 600,
    };
    return value.walletStatus === expectedWalletStatus[value.status] && value.atomic === true;
}

function isSequentialCall(value: unknown): value is SequentialCallExecution {
    if (!isRecord(value)
        || typeof value.callId !== "string"
        || !["submitting", "pending", "confirmed", "failed"].includes(String(value.status))) return false;
    if (value.transactionHash !== undefined && (typeof value.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.transactionHash))) return false;
    if (value.blockNumber !== undefined && !isDecimal(value.blockNumber)) return false;
    if (value.gasUsed !== undefined && !isDecimal(value.gasUsed)) return false;
    if (value.submittedAt !== undefined && !isTimestamp(value.submittedAt)) return false;
    if (value.updatedAt !== undefined && !isTimestamp(value.updatedAt)) return false;
    if (value.error !== undefined && !isStoredError(value.error)) return false;
    if (value.status === "pending") return typeof value.transactionHash === "string" && isTimestamp(value.submittedAt);
    if (value.status === "confirmed") {
        return typeof value.transactionHash === "string" && isDecimal(value.blockNumber) && isDecimal(value.gasUsed) && isTimestamp(value.updatedAt);
    }
    if (value.status === "failed") return isStoredError(value.error) && isTimestamp(value.updatedAt);
    return value.transactionHash === undefined;
}

function parseSequentialExecution(value: unknown): SequentialExecutionState | null {
    if (!isRecord(value)
        || !["idle", "active", "completed", "stopped"].includes(String(value.status))
        || !Array.isArray(value.calls)
        || !value.calls.every(isSequentialCall)
        || (value.startedAt !== undefined && !isTimestamp(value.startedAt))
        || (value.updatedAt !== undefined && !isTimestamp(value.updatedAt))) return null;
    if (value.status === "idle") return value.calls.length === 0 ? {status: "idle", calls: []} : null;
    if (!isTimestamp(value.startedAt)) return null;
    return value as unknown as SequentialExecutionState;
}

function parsePlan(value: unknown): TransactionPlanState["plan"] | null {
    if (!isRecord(value)
        || !Array.isArray(value.calls)
        || !value.calls.every(isQueuedCall)
        || !Array.isArray(value.watches)
        || !value.watches.every(isWatchExpression)) return null;
    const context = value.context;
    if (value.calls.length > 0 || value.watches.length > 0) {
        if (!isRecord(context)
            || typeof context.account !== "string"
            || !ethers.isAddress(context.account)
            || !isDecimal(context.chainId)) return null;
        const account = context.account;
        const chainId = context.chainId;
        if (value.calls.some((call) => call.chainId !== chainId || call.from.toLowerCase() !== account.toLowerCase())) return null;
        if (new Set(value.calls.map((call) => call.id)).size !== value.calls.length) return null;
        const watches = value.watches as WatchExpression[];
        if (new Set(watches.map((watch) => watch.id)).size !== watches.length
            || watches.some((watch) => watch.chainId !== chainId || watch.from.toLowerCase() !== account.toLowerCase())) return null;
        return {context: {account: ethers.getAddress(account), chainId}, calls: value.calls, watches};
    }
    return context === null && value.watches.length === 0 ? {context: null, calls: [], watches: []} : null;
}

function sequentialMatchesPlan(execution: SequentialExecutionState, plan: TransactionPlanState["plan"]) {
    if (execution.status === "idle") return true;
    if (plan.calls.length === 0 || execution.calls.length > plan.calls.length) return false;
    if (execution.calls.some((record, index) => record.callId !== plan.calls[index].id)) return false;
    if (execution.calls.slice(0, -1).some((record) => record.status !== "confirmed")) return false;
    const last = execution.calls[execution.calls.length - 1];
    if (execution.status === "completed") {
        return execution.calls.length === plan.calls.length && execution.calls.every((record) => record.status === "confirmed");
    }
    if (execution.status === "stopped") {
        return !last || (last.status !== "submitting" && last.status !== "pending");
    }
    return execution.calls.length < plan.calls.length || !last || last.status !== "confirmed";
}

export function parseTransactionPlan(serialized: string): TransactionPlanState | null {
    try {
        const candidate: unknown = JSON.parse(serialized);
        if (!isRecord(candidate)
            || !Object.keys(candidate).every((key) => key === "plan" || key === "execution" || key === "sequentialExecution")
            || !isRecord(candidate.plan)
            || !isExecution(candidate.execution)) return null;
        const plan = parsePlan(candidate.plan);
        const sequentialExecution = candidate.sequentialExecution === undefined
            ? {status: "idle" as const, calls: []}
            : parseSequentialExecution(candidate.sequentialExecution);
        if (!plan || !sequentialExecution || !sequentialMatchesPlan(sequentialExecution, plan)) return null;
        if (plan.calls.length === 0 && (candidate.execution.status !== "idle" || sequentialExecution.status !== "idle")) return null;
        if (candidate.execution.status !== "idle" && sequentialExecution.status !== "idle") return null;
        return {plan, execution: candidate.execution, sequentialExecution};
    } catch {
        return null;
    }
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

function recoverInterruptedSubmission(state: TransactionPlanState): TransactionPlanState {
    let next = state;
    if (next.execution.status === "submitting") {
        next = {
            ...next,
            execution: {
                status: "idle",
                error: {code: "SUBMISSION_INTERRUPTED", message: "Batch submission was interrupted before a batch ID was saved."},
            },
        };
    }
    const records = next.sequentialExecution.calls;
    const current = records[records.length - 1];
    if (next.sequentialExecution.status === "active" && current?.status === "submitting") {
        const updatedAt = Date.now();
        next = {
            ...next,
            sequentialExecution: {
                ...next.sequentialExecution,
                calls: [...records.slice(0, -1), {
                    ...current,
                    status: "failed",
                    error: {
                        code: "SUBMISSION_INTERRUPTED",
                        message: "The wallet submission was interrupted before a transaction hash was saved. Verify your wallet activity before retrying.",
                    },
                    updatedAt,
                }],
                updatedAt,
            },
        };
    }
    return next;
}

export function loadTransactionPlan(storage: ReadStorage | null = typeof window === "undefined" ? null : window.localStorage) {
    if (!storage) return createEmptyTransactionPlanState();
    try {
        const serialized = storage.getItem(TRANSACTION_PLAN_STORAGE_KEY);
        if (serialized) {
            const parsed = parseTransactionPlan(serialized);
            return parsed ? recoverInterruptedSubmission(parsed) : createEmptyTransactionPlanState();
        }
        return createEmptyTransactionPlanState();
    } catch {
        return createEmptyTransactionPlanState();
    }
}

export function saveTransactionPlan(state: TransactionPlanState, storage: WriteStorage | null = typeof window === "undefined" ? null : window.localStorage) {
    if (!storage) return;
    try {
        if (state.plan.calls.length === 0 && state.plan.watches.length === 0) {
            storage.removeItem(TRANSACTION_PLAN_STORAGE_KEY);
            return;
        }
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // A storage quota or privacy-mode failure must not make the in-memory plan unusable.
    }
}
