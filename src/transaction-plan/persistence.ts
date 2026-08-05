import { ethers } from "ethers";
import { createEmptyTransactionPlanState } from "./reducer";
import { QueuedCall, TRANSACTION_PLAN_STORAGE_VERSION, TransactionPlanState } from "./types";

export const TRANSACTION_PLAN_STORAGE_KEY = "intereth.transaction-plan.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecimal(value: unknown) {
    return typeof value === "string" && /^\d+$/.test(value);
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
        && typeof value.data === "string"
        && ethers.isHexString(value.data)
        && isDecimal(value.value)
        && typeof value.createdAt === "number"
        && (value.display.kind === "abi" || value.display.kind === "raw")
        && (value.editor.kind === "abi" || value.editor.kind === "raw");
}

export function parseTransactionPlan(serialized: string): TransactionPlanState | null {
    try {
        const candidate: unknown = JSON.parse(serialized);
        if (!isRecord(candidate)
            || candidate.version !== TRANSACTION_PLAN_STORAGE_VERSION
            || !isRecord(candidate.plan)
            || !isRecord(candidate.execution)
            || !Array.isArray(candidate.plan.calls)
            || !candidate.plan.calls.every(isQueuedCall)) {
            return null;
        }

        const context = candidate.plan.context;
        if (candidate.plan.calls.length > 0) {
            if (!isRecord(context)
                || typeof context.account !== "string"
                || !ethers.isAddress(context.account)
                || !isDecimal(context.chainId)) {
                return null;
            }
            const contextAccount = context.account;
            const contextChainId = context.chainId;
            if (candidate.plan.calls.some((call) => call.chainId !== contextChainId || call.from.toLowerCase() !== contextAccount.toLowerCase())) {
                return null;
            }
        } else if (context !== null) {
            return null;
        }

        const executionStatus = candidate.execution.status;
        if (!(["idle", "executing", "halted", "complete"] as unknown[]).includes(executionStatus)
            || !isRecord(candidate.execution.resultsByCallId)) {
            return null;
        }

        return candidate as unknown as TransactionPlanState;
    } catch {
        return null;
    }
}

export function loadTransactionPlan(storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage) {
    if (!storage) {
        return createEmptyTransactionPlanState();
    }
    try {
        const serialized = storage.getItem(TRANSACTION_PLAN_STORAGE_KEY);
        return serialized ? parseTransactionPlan(serialized) ?? createEmptyTransactionPlanState() : createEmptyTransactionPlanState();
    } catch {
        return createEmptyTransactionPlanState();
    }
}

export function saveTransactionPlan(state: TransactionPlanState, storage: Pick<Storage, "setItem" | "removeItem"> | null = typeof window === "undefined" ? null : window.localStorage) {
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
