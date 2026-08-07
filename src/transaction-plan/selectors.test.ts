import { createEmptyTransactionPlanState, transactionPlanReducer } from "./reducer";
import {
    selectCanEditPlan,
    selectCanForgetTrackedPlan,
    selectPlanSessionStatus,
    selectShouldClearForSession,
} from "./selectors";
import { TransactionPlanState } from "./types";
import { QueuedCall } from "./types";

const call: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000010",
    data: "0x",
    value: "0",
    display: {kind: "raw", contractAddress: "0x0000000000000000000000000000000000000010"},
    editor: {kind: "raw"},
    createdAt: 1,
};

describe("transaction plan selectors", () => {
    const draft = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call});

    it("derives disconnected and mismatch states without mutating the plan", () => {
        expect(selectPlanSessionStatus(draft, {account: null, chainId: null})).toBe("disconnected");
        expect(selectPlanSessionStatus(draft, {account: call.from, chainId: "10"})).toBe("chain_mismatch");
        expect(selectPlanSessionStatus(draft, {
            account: "0x0000000000000000000000000000000000000002",
            chainId: "1",
        })).toBe("account_mismatch");
        expect(draft.plan.context).toEqual({account: call.from, chainId: "1"});
    });

    it("makes a matching restored draft immediately editable", () => {
        const restored = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "RESTORE_PLAN", state: draft});
        const wallet = {account: call.from, chainId: "1"};
        expect(selectPlanSessionStatus(restored, wallet)).toBe("ready");
        expect(selectCanEditPlan(restored, wallet)).toBe(true);
    });

    it("clears safe records on identity mismatch but preserves unresolved batches", () => {
        const mismatchedWallet = {account: call.from, chainId: "10"};
        const withExecution = (execution: TransactionPlanState["execution"]): TransactionPlanState => ({...draft, execution});

        expect(selectShouldClearForSession(draft, mismatchedWallet)).toBe(true);
        expect(selectShouldClearForSession(withExecution({status: "confirmed", batchId: "0x12", walletStatus: 200, atomic: true}), mismatchedWallet)).toBe(true);
        expect(selectShouldClearForSession(withExecution({status: "offchain_failed", batchId: "0x12", walletStatus: 400, atomic: true}), mismatchedWallet)).toBe(true);
        expect(selectShouldClearForSession(withExecution({status: "reverted", batchId: "0x12", walletStatus: 500, atomic: true}), mismatchedWallet)).toBe(true);

        for (const execution of [
            {status: "submitting"} as const,
            {status: "pending", batchId: "0x12"} as const,
            {status: "invalid", batchId: "0x12"} as const,
            {status: "partially_reverted", batchId: "0x12", walletStatus: 600, atomic: true} as const,
        ]) {
            const state = withExecution(execution);
            expect(selectShouldClearForSession(state, mismatchedWallet)).toBe(false);
        }
    });

    it("only allows explicit forgetting for tracked uncertain outcomes", () => {
        expect(selectCanForgetTrackedPlan({...draft, execution: {status: "pending", batchId: "0x12"}})).toBe(true);
        expect(selectCanForgetTrackedPlan({...draft, execution: {status: "invalid", batchId: "0x12"}})).toBe(true);
        expect(selectCanForgetTrackedPlan({...draft, execution: {status: "partially_reverted", batchId: "0x12"}})).toBe(true);
        expect(selectCanForgetTrackedPlan(draft)).toBe(false);
        expect(selectCanForgetTrackedPlan({...draft, execution: {status: "submitting"}})).toBe(false);
    });
});
