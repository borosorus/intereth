import { createContext, Dispatch, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { loadTransactionPlan, saveTransactionPlan } from "./persistence";
import { transactionPlanReducer } from "./reducer";
import { PlanSessionStatus, selectCanEditPlan, selectPlanSessionStatus } from "./selectors";
import { TransactionPlanAction, TransactionPlanState } from "./types";

interface TransactionPlanContextValue {
    state: TransactionPlanState;
    dispatch: Dispatch<TransactionPlanAction>;
    sessionStatus: PlanSessionStatus;
    canEdit: boolean;
    resumePlan: () => boolean;
}

const TransactionPlanContext = createContext<TransactionPlanContextValue | null>(null);

export function TransactionPlanProvider({children}: {children: ReactNode}) {
    const wallet = useWalletSession();
    const [state, dispatch] = useReducer(
        transactionPlanReducer,
        undefined,
        () => {
            const restored = loadTransactionPlan();
            return restored.plan.calls.length > 0
                ? transactionPlanReducer(restored, {type: "RESTORE_PLAN", state: restored})
                : restored;
        },
    );
    const walletIdentity = useMemo(() => ({account: wallet.account, chainId: wallet.chainId}), [wallet.account, wallet.chainId]);
    const sessionStatus = selectPlanSessionStatus(state, walletIdentity);
    const canEdit = selectCanEditPlan(state, walletIdentity);

    useEffect(() => {
        saveTransactionPlan(state);
    }, [state]);

    const resumePlan = useCallback(() => {
        if (selectPlanSessionStatus(state, walletIdentity) !== "requires_resume") {
            return false;
        }
        dispatch({type: "RESUME_PLAN"});
        return true;
    }, [state, walletIdentity]);

    const value = useMemo<TransactionPlanContextValue>(() => ({
        state,
        dispatch,
        sessionStatus,
        canEdit,
        resumePlan,
    }), [canEdit, resumePlan, sessionStatus, state]);

    return <TransactionPlanContext.Provider value={value}>{children}</TransactionPlanContext.Provider>;
}

export function useTransactionPlan() {
    const context = useContext(TransactionPlanContext);
    if (!context) {
        throw new Error("useTransactionPlan must be used inside TransactionPlanProvider");
    }
    return context;
}
