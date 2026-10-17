import { createContext, Dispatch, ReactNode, useContext, useEffect, useMemo, useReducer } from "react";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { loadTransactionPlan, saveTransactionPlan } from "./persistence";
import { transactionPlanReducer } from "./reducer";
import { PlanSessionStatus, selectCanEditPlan, selectPlanSessionStatus, selectShouldClearForSession } from "./selectors";
import { TransactionPlanAction, TransactionPlanState } from "./types";

interface TransactionPlanContextValue {
    state: TransactionPlanState;
    dispatch: Dispatch<TransactionPlanAction>;
    sessionStatus: PlanSessionStatus;
    canEdit: boolean;
}

const TransactionPlanContext = createContext<TransactionPlanContextValue | null>(null);

export function TransactionPlanProvider({children}: {children: ReactNode}) {
    const wallet = useWalletSession();
    const [state, dispatch] = useReducer(
        transactionPlanReducer,
        undefined,
        () => loadTransactionPlan(),
    );
    const walletIdentity = useMemo(() => ({
        account: wallet.executionAccount ?? wallet.account,
        chainId: wallet.executionChainId ?? wallet.chainId,
        isSafeMode: Boolean(wallet.isSafeMode),
        ownerAuthorized: Boolean(wallet.safeOwnerConnected),
    }), [wallet.account, wallet.chainId, wallet.executionAccount, wallet.executionChainId, wallet.isSafeMode, wallet.safeOwnerConnected]);
    const sessionStatus = selectPlanSessionStatus(state, walletIdentity);
    const canEdit = selectCanEditPlan(state, walletIdentity);

    useEffect(() => {
        saveTransactionPlan(state);
    }, [state]);

    useEffect(() => {
        if (selectShouldClearForSession(state, walletIdentity)) {
            dispatch({type: "CLEAR_PLAN"});
        }
    }, [state, walletIdentity]);

    const value = useMemo<TransactionPlanContextValue>(() => ({
        state,
        dispatch,
        sessionStatus,
        canEdit,
    }), [canEdit, sessionStatus, state]);

    return <TransactionPlanContext.Provider value={value}>{children}</TransactionPlanContext.Provider>;
}

export function useTransactionPlan() {
    const context = useContext(TransactionPlanContext);
    if (!context) {
        throw new Error("useTransactionPlan must be used inside TransactionPlanProvider");
    }
    return context;
}
