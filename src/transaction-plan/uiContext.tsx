import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

interface TransactionPlanUi {
    reviewRequest: number;
    requestReview: () => void;
}

const TransactionPlanUiContext = createContext<TransactionPlanUi>({reviewRequest: 0, requestReview: () => undefined});

export function TransactionPlanUiProvider({children}: {children: ReactNode}) {
    const [reviewRequest, setReviewRequest] = useState(0);
    const requestReview = useCallback(() => setReviewRequest((current) => current + 1), []);
    const value = useMemo(() => ({reviewRequest, requestReview}), [requestReview, reviewRequest]);
    return <TransactionPlanUiContext.Provider value={value}>{children}</TransactionPlanUiContext.Provider>;
}

export function useTransactionPlanUi() {
    return useContext(TransactionPlanUiContext);
}
