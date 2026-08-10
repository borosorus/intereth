import { useCallback, useEffect, useState } from "react";
import { useTransactionPlan } from "../transaction-plan/context";
import { PlanContext, WatchExpression } from "../transaction-plan/types";
import { useWorkspaceMode } from "../workspace/context";

type WatchFactory = (context: PlanContext) => WatchExpression | Promise<WatchExpression>;

export function usePinWatch(chainId?: string) {
    const workspace = useWorkspaceMode();
    const {state, dispatch, canEdit} = useTransactionPlan();
    const [notice, setNotice] = useState<string | null>(null);
    const context = state.plan.context;
    const canPin = workspace.mode === "simulate" && canEdit && Boolean(context && chainId && context.chainId === chainId);

    useEffect(() => setNotice(null), [chainId, context?.account, context?.chainId, workspace.mode]);

    const pin = useCallback(async (factory: WatchFactory) => {
        if (!canPin || !context) return;
        const watch = await factory(context);
        const duplicate = state.plan.watches.some((current) => current.to.toLowerCase() === watch.to.toLowerCase()
            && current.data.toLowerCase() === watch.data.toLowerCase()
            && current.value === watch.value);
        if (duplicate) {
            setNotice("This watch is already pinned.");
            return;
        }
        dispatch({type: "ADD_WATCH", watch});
        setNotice("Watch pinned.");
    }, [canPin, context, dispatch, state.plan.watches]);

    return {canPin, notice, clearNotice: () => setNotice(null), pin};
}
