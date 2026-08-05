import { ethers } from "ethers";
import type { ParamValue } from "../calls/parameters";
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
        && typeof value.createdAt === "number"
        && Number.isFinite(value.createdAt)
        && value.createdAt >= 0
        && hasValidDisplay(value.display, value.to)
        && hasValidEditor(value.editor)
        && value.display.kind === value.editor.kind;
}

function isReceipt(value: unknown): value is BatchReceipt {
    return isRecord(value)
        && Array.isArray(value.logs)
        && value.logs.every((log) => isRecord(log)
            && typeof log.address === "string"
            && ethers.isAddress(log.address)
            && isHexData(log.data)
            && Array.isArray(log.topics)
            && log.topics.length <= 4
            && log.topics.every(isHash))
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
    if (value.walletStatus !== undefined && (typeof value.walletStatus !== "number" || !Number.isInteger(value.walletStatus) || value.walletStatus < 0)) {
        return false;
    }
    if (value.atomic !== undefined && typeof value.atomic !== "boolean") {
        return false;
    }
    if (value.receipts !== undefined && (!Array.isArray(value.receipts) || !value.receipts.every(isReceipt))) {
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
        if (new Set(value.calls.map((call) => call.id)).size !== value.calls.length) {
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
        if (!plan || (plan.calls.length === 0 && candidate.execution.status !== "idle")) {
            return null;
        }
        return {version: TRANSACTION_PLAN_STORAGE_VERSION, plan, execution: candidate.execution};
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
