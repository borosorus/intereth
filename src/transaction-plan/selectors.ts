import { TransactionPlanState } from "./types";

export type PlanSessionStatus =
    | "empty"
    | "disconnected"
    | "account_mismatch"
    | "chain_mismatch"
    | "requires_resume"
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
    if (state.plan.requiresResume) {
        return "requires_resume";
    }
    return "ready";
}

export function selectCanEditPlan(state: TransactionPlanState, wallet: ActiveWalletIdentity) {
    const sessionStatus = selectPlanSessionStatus(state, wallet);
    return (sessionStatus === "empty" || sessionStatus === "ready") && state.execution.status === "idle";
}
