import { transactionPlanReducer, createEmptyTransactionPlanState } from "./reducer";
import { QueuedCall, TransactionPlanState } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const OTHER_ACCOUNT = "0x0000000000000000000000000000000000000002";
const TARGET = "0x0000000000000000000000000000000000000010";

function call(overrides: Partial<QueuedCall> = {}): QueuedCall {
    return {
        id: "call-1",
        chainId: "1",
        from: ACCOUNT,
        to: TARGET,
        data: "0x1234",
        value: "0",
        display: {kind: "raw", contractAddress: TARGET},
        editor: {kind: "raw"},
        createdAt: 1,
        ...overrides,
    };
}

function addCalls(...calls: QueuedCall[]) {
    return calls.reduce(
        (state, queuedCall) => transactionPlanReducer(state, {type: "ADD_CALL", call: queuedCall}),
        createEmptyTransactionPlanState(),
    );
}

describe("transactionPlanReducer", () => {
    it("establishes context from the first call", () => {
        const state = addCalls(call());
        expect(state.plan.context).toEqual({account: ACCOUNT, chainId: "1"});
        expect(state.plan.calls).toHaveLength(1);
    });

    it("rejects calls from another account or chain", () => {
        const state = addCalls(call());
        const otherAccount = transactionPlanReducer(state, {
            type: "ADD_CALL",
            call: call({id: "call-2", from: OTHER_ACCOUNT}),
        });
        const otherChain = transactionPlanReducer(state, {
            type: "ADD_CALL",
            call: call({id: "call-3", chainId: "10"}),
        });

        expect(otherAccount).toBe(state);
        expect(otherChain).toBe(state);
    });

    it("rejects duplicate call identifiers", () => {
        const state = addCalls(call());
        expect(transactionPlanReducer(state, {
            type: "ADD_CALL",
            call: call({data: "0xabcd"}),
        })).toBe(state);
        expect(transactionPlanReducer(state, {
            type: "DUPLICATE_CALL",
            afterCallId: "call-1",
            call: call(),
        })).toBe(state);
    });

    it("duplicates, moves, removes, and resets the context when empty", () => {
        const first = call();
        const second = call({id: "call-2", data: "0xabcd"});
        let state = addCalls(first, second);
        state = transactionPlanReducer(state, {
            type: "DUPLICATE_CALL",
            afterCallId: first.id,
            call: call({id: "copy"}),
        });
        expect(state.plan.calls.map((item) => item.id)).toEqual(["call-1", "copy", "call-2"]);

        state = transactionPlanReducer(state, {type: "MOVE_CALL", callId: "call-2", direction: "up"});
        expect(state.plan.calls.map((item) => item.id)).toEqual(["call-1", "call-2", "copy"]);

        for (const item of [...state.plan.calls]) {
            state = transactionPlanReducer(state, {type: "REMOVE_CALL", callId: item.id});
        }
        expect(state.plan.calls).toEqual([]);
        expect(state.plan.context).toBeNull();
    });

    it("locks mutations and clearing while a batch is in flight", () => {
        const draft = addCalls(call());
        const submitting: TransactionPlanState = {
            ...draft,
            execution: {status: "submitting"},
        };

        expect(transactionPlanReducer(submitting, {type: "REMOVE_CALL", callId: "call-1"})).toBe(submitting);
        expect(transactionPlanReducer(submitting, {type: "CLEAR_PLAN"})).toBe(submitting);

        const pending: TransactionPlanState = {...draft, execution: {status: "pending", batchId: "0x1234"}};
        expect(transactionPlanReducer(pending, {type: "CLEAR_PLAN"})).toBe(pending);
    });

    it("tracks submission, batch status, and retryable terminal failures", () => {
        const draft = addCalls(call());
        const submitting = transactionPlanReducer(draft, {type: "START_BATCH_SUBMISSION"});
        expect(submitting.execution.status).toBe("submitting");

        const pending = transactionPlanReducer(submitting, {type: "BATCH_SUBMITTED", batchId: "0x1234", submittedAt: 10});
        expect(pending.execution).toMatchObject({status: "pending", batchId: "0x1234", submittedAt: 10});
        expect(transactionPlanReducer(pending, {type: "REMOVE_CALL", callId: "call-1"})).toBe(pending);

        const reverted = transactionPlanReducer(pending, {
            type: "BATCH_STATUS_UPDATED",
            execution: {status: "reverted", batchId: "0x1234", walletStatus: 500, atomic: true},
            updatedAt: 20,
        });
        expect(reverted.execution).toMatchObject({status: "reverted", submittedAt: 10, updatedAt: 20});
        expect(transactionPlanReducer(reverted, {
            type: "BATCH_STATUS_UPDATED",
            execution: {status: "pending", batchId: "0x1234"},
            updatedAt: 30,
        })).toBe(reverted);
        expect(transactionPlanReducer(reverted, {type: "RESET_FAILED_BATCH"}).execution).toEqual({status: "idle"});

        const partial: TransactionPlanState = {...pending, execution: {status: "partially_reverted", batchId: "0x1234"}};
        expect(transactionPlanReducer(partial, {type: "RESET_FAILED_BATCH"})).toBe(partial);
    });

    it("keeps a draft editable when submission fails before returning an ID", () => {
        const submitting = transactionPlanReducer(addCalls(call()), {type: "START_BATCH_SUBMISSION"});
        const failed = transactionPlanReducer(submitting, {
            type: "BATCH_SUBMISSION_FAILED",
            error: {code: 4001, message: "Rejected"},
        });

        expect(failed.execution).toEqual({status: "idle", error: {code: 4001, message: "Rejected"}});
        expect(transactionPlanReducer(failed, {type: "REMOVE_CALL", callId: "call-1"}).plan.calls).toEqual([]);
    });

    it("restores drafts read-only, preserves submitted batches, and recovers interrupted submission", () => {
        const draft = addCalls(call());
        const restoredDraft = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "RESTORE_PLAN", state: draft});
        expect(restoredDraft.plan.requiresResume).toBe(true);

        const pending: TransactionPlanState = {...draft, execution: {status: "pending", batchId: "0x1234"}};
        const restoredPending = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "RESTORE_PLAN", state: pending});
        expect(restoredPending.plan.requiresResume).toBe(false);
        expect(restoredPending.execution).toEqual(pending.execution);

        const submitting: TransactionPlanState = {...draft, execution: {status: "submitting"}};
        const interrupted = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "RESTORE_PLAN", state: submitting});

        expect(interrupted.plan.requiresResume).toBe(true);
        expect(interrupted.execution).toMatchObject({status: "idle", error: {code: "SUBMISSION_INTERRUPTED"}});
    });
});
