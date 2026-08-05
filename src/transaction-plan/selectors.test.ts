import { createEmptyTransactionPlanState, transactionPlanReducer } from "./reducer";
import { selectCanEditPlan, selectPlanSessionStatus } from "./selectors";
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

    it("requires explicit resume after restoration", () => {
        const restored = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "RESTORE_PLAN", state: draft});
        const wallet = {account: call.from, chainId: "1"};
        expect(selectPlanSessionStatus(restored, wallet)).toBe("requires_resume");
        expect(selectCanEditPlan(restored, wallet)).toBe(false);

        const resumed = transactionPlanReducer(restored, {type: "RESUME_PLAN"});
        expect(selectPlanSessionStatus(resumed, wallet)).toBe("ready");
        expect(selectCanEditPlan(resumed, wallet)).toBe(true);
    });
});
