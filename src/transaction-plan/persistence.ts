import { ethers } from "ethers";
import { createEmptyTransactionPlanState } from "./reducer";
import {
    BatchExecutionState,
    BatchReceipt,
    QueuedCall,
    TRANSACTION_PLAN_STORAGE_VERSION,
    TransactionPlanState,
} from "./types";

export const TRANSACTION_PLAN_STORAGE_KEY = "intereth.transaction-plan.v2";
export const LEGACY_TRANSACTION_PLAN_STORAGE_KEY = "intereth.transaction-plan.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecimal(value: unknown): value is string {
    return typeof value === "string" && /^\d+$/.test(value);
}

function isHexData(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        ethers.dataLength(value);
        return true;
    } catch {
        return false;
    }
}

function isHexQuantity(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        return ethers.toQuantity(ethers.getBigInt(value)).toLowerCase() === value.toLowerCase();
    } catch {
        return false;
    }
}

function isHash(value: unknown): value is string {
    return isHexData(value) && ethers.dataLength(value) === 32;
}

function isQueuedCall(value: unknown): value is QueuedCall {
    if (!isRecord(value) || !isRecord(value.display) || !isRecord(value.editor)) {
        return false;
    }
    return typeof value.id === "string"
        && isDecimal(value.chainId)
        && typeof value.from === "string"
        && ethers.isAddress(value.from)
        && typeof value.to === "string"
        && ethers.isAddress(value.to)
        && isHexData(value.data)
        && isDecimal(value.value)
        && typeof value.createdAt === "number"
        && (value.display.kind === "abi" || value.display.kind === "raw")
        && (value.editor.kind === "abi" || value.editor.kind === "raw");
}

function isReceipt(value: unknown): value is BatchReceipt {
    return isRecord(value)
        && Array.isArray(value.logs)
        && value.logs.every((log) => isRecord(log)
            && typeof log.address === "string"
            && ethers.isAddress(log.address)
            && isHexData(log.data)
            && Array.isArray(log.topics)
            && log.topics.every(isHexData))
        && (value.status === "0x0" || value.status === "0x1")
        && isHash(value.blockHash)
        && isHexQuantity(value.blockNumber)
        && isHexQuantity(value.gasUsed)
        && isHash(value.transactionHash);
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
    if (value.walletStatus !== undefined && typeof value.walletStatus !== "number") {
        return false;
    }
    if (value.atomic !== undefined && typeof value.atomic !== "boolean") {
        return false;
    }
    if (value.receipts !== undefined && (!Array.isArray(value.receipts) || !value.receipts.every(isReceipt))) {
        return false;
    }
    if (value.submittedAt !== undefined && typeof value.submittedAt !== "number") {
        return false;
    }
    if (value.updatedAt !== undefined && typeof value.updatedAt !== "number") {
        return false;
    }
    if (value.error !== undefined && (!isRecord(value.error) || typeof value.error.message !== "string")) {
        return false;
    }
    return value.status === "idle" || value.status === "submitting"
        ? value.batchId === undefined
        : typeof value.batchId === "string";
}

function parsePlan(value: unknown): TransactionPlanState["plan"] | null {
    if (!isRecord(value) || !Array.isArray(value.calls) || !value.calls.every(isQueuedCall)) {
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
        return {
            context: {account: ethers.getAddress(account), chainId},
            calls: value.calls,
            requiresResume: Boolean(value.requiresResume),
        };
    }
    return context === null ? {context: null, calls: [], requiresResume: false} : null;
}

export function parseTransactionPlan(serialized: string): TransactionPlanState | null {
    try {
        const candidate: unknown = JSON.parse(serialized);
        if (!isRecord(candidate)
            || candidate.version !== TRANSACTION_PLAN_STORAGE_VERSION
            || !isRecord(candidate.plan)
            || !isExecution(candidate.execution)) {
            return null;
        }
        const plan = parsePlan(candidate.plan);
        return plan ? {version: TRANSACTION_PLAN_STORAGE_VERSION, plan, execution: candidate.execution} : null;
    } catch {
        return null;
    }
}

export function migrateLegacyTransactionPlan(serialized: string): TransactionPlanState | null {
    try {
        const candidate: unknown = JSON.parse(serialized);
        if (!isRecord(candidate) || candidate.version !== 1 || !isRecord(candidate.plan)) {
            return null;
        }
        const plan = parsePlan(candidate.plan);
        return plan ? {
            version: TRANSACTION_PLAN_STORAGE_VERSION,
            plan: {...plan, requiresResume: plan.calls.length > 0},
            execution: {status: "idle"},
        } : null;
    } catch {
        return null;
    }
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

export function loadTransactionPlan(storage: ReadStorage | null = typeof window === "undefined" ? null : window.localStorage) {
    if (!storage) {
        return createEmptyTransactionPlanState();
    }
    try {
        const serialized = storage.getItem(TRANSACTION_PLAN_STORAGE_KEY);
        if (serialized) {
            return parseTransactionPlan(serialized) ?? createEmptyTransactionPlanState();
        }
        const legacy = storage.getItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY);
        return legacy ? migrateLegacyTransactionPlan(legacy) ?? createEmptyTransactionPlanState() : createEmptyTransactionPlanState();
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
            storage.removeItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY);
            return;
        }
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(state));
        storage.removeItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY);
    } catch {
        // A storage quota or privacy-mode failure must not make the in-memory plan unusable.
    }
}
