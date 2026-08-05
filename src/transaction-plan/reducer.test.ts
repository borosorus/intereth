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

    it("locks mutations and clearing during execution", () => {
        const draft = addCalls(call());
        const executing: TransactionPlanState = {
            ...draft,
            execution: {status: "executing", resultsByCallId: {}},
        };

        expect(transactionPlanReducer(executing, {type: "REMOVE_CALL", callId: "call-1"})).toBe(executing);
        expect(transactionPlanReducer(executing, {type: "CLEAR_PLAN"})).toBe(executing);
    });

    it("restores non-empty plans as read-only and halts interrupted execution", () => {
        const saved: TransactionPlanState = {
            ...addCalls(call()),
            execution: {status: "executing", resultsByCallId: {}},
        };
        const restored = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "RESTORE_PLAN", state: saved});

        expect(restored.plan.requiresResume).toBe(true);
        expect(restored.execution.status).toBe("halted");
    });
});
