import { TransactionPlanState } from "./types";
import { canForgetTrackedExecution, isExecutionAutoClearable, isExecutionMutable } from "./executionPolicy";

export type PlanSessionStatus =
    | "empty"
    | "disconnected"
    | "account_mismatch"
    | "chain_mismatch"
    | "ready";

export interface ActiveWalletIdentity {
    account: string | null;
    chainId: string | null;
}

export function selectPlanSessionStatus(state: TransactionPlanState, wallet: ActiveWalletIdentity): PlanSessionStatus {
    const context = state.plan.context;
    if (!context || state.plan.calls.length === 0) {
        return "empty";
    }
    if (!wallet.account || !wallet.chainId) {
        return "disconnected";
    }
    if (wallet.chainId !== context.chainId) {
        return "chain_mismatch";
    }
    if (wallet.account.toLowerCase() !== context.account.toLowerCase()) {
        return "account_mismatch";
    }
    return "ready";
}

export function selectCanEditPlan(state: TransactionPlanState, wallet: ActiveWalletIdentity) {
    const sessionStatus = selectPlanSessionStatus(state, wallet);
    return (sessionStatus === "empty" || sessionStatus === "ready") && isExecutionMutable(state.execution);
}

export function selectShouldClearForSession(state: TransactionPlanState, wallet: ActiveWalletIdentity) {
    const sessionStatus = selectPlanSessionStatus(state, wallet);
    if (sessionStatus !== "account_mismatch" && sessionStatus !== "chain_mismatch") {
        return false;
    }
    return isExecutionAutoClearable(state.execution);
}

export function selectCanForgetTrackedPlan(state: TransactionPlanState) {
    return canForgetTrackedExecution(state.execution);
}
