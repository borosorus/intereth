import { ethers } from "ethers";
import type { ParamValue } from "../calls/parameters";
import { createEmptyTransactionPlanState } from "./reducer";
import {
    BatchExecutionState,
    QueuedCall,
    TransactionPlanState,
    WatchExpression,
} from "./types";
import { isHexData, isRecord, parseBatchReceipt } from "./rpcValidation";

export const TRANSACTION_PLAN_STORAGE_KEY = "intereth.transaction-plan";

function isDecimal(value: unknown): value is string {
    return typeof value === "string" && /^\d+$/.test(value);
}

function isParamValue(value: unknown, depth = 0): value is ParamValue {
    if (depth > 32) {
        return false;
    }
    if (typeof value === "string") {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every((item) => isParamValue(item, depth + 1));
    }
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
    if (value.kind === "raw") {
        return true;
    }
    if (value.kind !== "abi" || typeof value.functionFragment !== "string" || !Array.isArray(value.arguments)) {
        return false;
    }
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
    if (!isRecord(value) || !isRecord(value.display) || !isRecord(value.editor)) {
        return false;
    }
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
        && typeof value.createdAt === "number"
        && Number.isFinite(value.createdAt)
        && value.createdAt >= 0
        && hasValidDisplay(value.display, value.to)
        && hasValidEditor(value.editor)
        && value.display.kind === value.editor.kind;
}

function hasValidWatchDisplay(value: unknown) {
    if (!isRecord(value)
        || (value.kind !== "abi" && value.kind !== "raw")
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
        && typeof value.createdAt === "number"
        && Number.isFinite(value.createdAt)
        && value.createdAt >= 0;
}

const EXECUTION_STATUSES: BatchExecutionState["status"][] = [
    "idle",
    "submitting",
    "pending",
    "confirmed",
    "offchain_failed",
    "reverted",
    "partially_reverted",
    "invalid",
];

function isExecution(value: unknown): value is BatchExecutionState {
    if (!isRecord(value) || !EXECUTION_STATUSES.includes(value.status as BatchExecutionState["status"])) {
        return false;
    }
    if (value.batchId !== undefined && (!isHexData(value.batchId) || value.batchId === "0x" || value.batchId.length > 8194)) {
        return false;
    }
    if (value.walletStatus !== undefined && (typeof value.walletStatus !== "number" || !Number.isInteger(value.walletStatus) || value.walletStatus < 0)) {
        return false;
    }
    if (value.atomic !== undefined && typeof value.atomic !== "boolean") {
        return false;
    }
    if (value.receipts !== undefined && (!Array.isArray(value.receipts) || !value.receipts.every((receipt) => parseBatchReceipt(receipt) !== null))) {
        return false;
    }
    if (value.submittedAt !== undefined && (typeof value.submittedAt !== "number" || !Number.isFinite(value.submittedAt) || value.submittedAt < 0)) {
        return false;
    }
    if (value.updatedAt !== undefined && (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < 0)) {
        return false;
    }
    if (value.error !== undefined && (!isRecord(value.error)
        || typeof value.error.message !== "string"
        || (value.error.code !== undefined && typeof value.error.code !== "string" && typeof value.error.code !== "number"))) {
        return false;
    }
    if (value.status === "idle" || value.status === "submitting") {
        return value.batchId === undefined
            && value.walletStatus === undefined
            && value.atomic === undefined
            && value.receipts === undefined;
    }
    if (typeof value.batchId !== "string") {
        return false;
    }
    if (value.status === "pending") {
        return (value.walletStatus === undefined && value.atomic === undefined)
            || (value.walletStatus === 100 && value.atomic === true);
    }
    if (value.status === "invalid") {
        return true;
    }
    const expectedWalletStatus: Partial<Record<BatchExecutionState["status"], number>> = {
        confirmed: 200,
        offchain_failed: 400,
        reverted: 500,
        partially_reverted: 600,
    };
    const expected = expectedWalletStatus[value.status as BatchExecutionState["status"]];
    return value.walletStatus === expected && value.atomic === true;
}

function parsePlan(value: unknown): TransactionPlanState["plan"] | null {
    if (!isRecord(value)
        || !Array.isArray(value.calls)
        || !value.calls.every(isQueuedCall)
        || !Array.isArray(value.watches)
        || !value.watches.every(isWatchExpression)) {
        return null;
    }
    const context = value.context;
    if (value.calls.length > 0) {
        if (!isRecord(context)
            || typeof context.account !== "string"
            || !ethers.isAddress(context.account)
            || !isDecimal(context.chainId)) {
            return null;
        }
        const account = context.account;
        const chainId = context.chainId;
        if (value.calls.some((call) => call.chainId !== chainId || call.from.toLowerCase() !== account.toLowerCase())) {
            return null;
        }
        if (new Set(value.calls.map((call) => call.id)).size !== value.calls.length) {
            return null;
        }
        const watches = value.watches as WatchExpression[];
        if (new Set(watches.map((watch) => watch.id)).size !== watches.length
            || watches.some((watch) => watch.chainId !== chainId || watch.from.toLowerCase() !== account.toLowerCase())) {
            return null;
        }
        return {
            context: {account: ethers.getAddress(account), chainId},
            calls: value.calls,
            watches,
        };
    }
    return context === null && value.watches.length === 0 ? {context: null, calls: [], watches: []} : null;
}

export function parseTransactionPlan(serialized: string): TransactionPlanState | null {
    try {
        const candidate: unknown = JSON.parse(serialized);
        if (!isRecord(candidate)
            || !Object.keys(candidate).every((key) => key === "plan" || key === "execution")
            || !isRecord(candidate.plan)
            || !isExecution(candidate.execution)) {
            return null;
        }
        const plan = parsePlan(candidate.plan);
        if (!plan || (plan.calls.length === 0 && candidate.execution.status !== "idle")) {
            return null;
        }
        return {plan, execution: candidate.execution};
    } catch {
        return null;
    }
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

function recoverInterruptedSubmission(state: TransactionPlanState): TransactionPlanState {
    if (state.execution.status !== "submitting") {
        return state;
    }
    return {
        ...state,
        execution: {
            status: "idle",
            error: {code: "SUBMISSION_INTERRUPTED", message: "Batch submission was interrupted before a batch ID was saved."},
        },
    };
}

export function loadTransactionPlan(storage: ReadStorage | null = typeof window === "undefined" ? null : window.localStorage) {
    if (!storage) {
        return createEmptyTransactionPlanState();
    }
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
    if (!storage) {
        return;
    }
    try {
        if (state.plan.calls.length === 0) {
            storage.removeItem(TRANSACTION_PLAN_STORAGE_KEY);
            return;
        }
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // A storage quota or privacy-mode failure must not make the in-memory plan unusable.
    }
}
