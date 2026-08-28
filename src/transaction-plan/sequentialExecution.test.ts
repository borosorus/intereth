import { loadTransactionPlan, parseTransactionPlan, saveTransactionPlan, TRANSACTION_PLAN_STORAGE_KEY } from "./persistence";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "./reducer";
import { QueuedCall } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const HASH_1 = `0x${"11".repeat(32)}`;
const HASH_2 = `0x${"22".repeat(32)}`;

function call(id: string): QueuedCall {
    return {
        id,
        chainId: "1",
        from: ACCOUNT,
        to: TARGET,
        data: "0x1234",
        value: "0",
        decoderAbi: [],
        display: {kind: "raw", contractAddress: TARGET},
        editor: {kind: "raw"},
        createdAt: 1,
    };
}

function draft() {
    let state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: call("call-1")});
    state = transactionPlanReducer(state, {type: "ADD_CALL", call: call("call-2")});
    return state;
}

function memoryStorage() {
    const entries = new Map<string, string>();
    return {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
    };
}

describe("sequential transaction execution", () => {
    it("executes only the next call and completes after confirmations in order", () => {
        let state = transactionPlanReducer(draft(), {type: "START_SEQUENTIAL_EXECUTION", startedAt: 10});
        expect(state.sequentialExecution).toMatchObject({status: "active", calls: []});

        expect(transactionPlanReducer(state, {type: "START_SEQUENTIAL_CALL", callId: "call-2"})).toBe(state);
        state = transactionPlanReducer(state, {type: "START_SEQUENTIAL_CALL", callId: "call-1"});
        state = transactionPlanReducer(state, {type: "SEQUENTIAL_CALL_SUBMITTED", callId: "call-1", transactionHash: HASH_1, submittedAt: 11});
        state = transactionPlanReducer(state, {
            type: "SEQUENTIAL_CALL_CONFIRMED", callId: "call-1", transactionHash: HASH_1,
            blockNumber: "100", gasUsed: "21000", updatedAt: 12,
        });
        expect(state.sequentialExecution.status).toBe("active");
        expect(state.sequentialExecution.calls[0]).toMatchObject({callId: "call-1", status: "confirmed", transactionHash: HASH_1});

        state = transactionPlanReducer(state, {type: "START_SEQUENTIAL_CALL", callId: "call-2"});
        state = transactionPlanReducer(state, {
            type: "SEQUENTIAL_CALL_FAILED", callId: "call-2", error: {code: 4001, message: "Rejected"}, updatedAt: 13,
        });
        expect(state.sequentialExecution.calls[1]).toMatchObject({callId: "call-2", status: "failed"});

        state = transactionPlanReducer(state, {type: "RETRY_SEQUENTIAL_CALL", callId: "call-2"});
        expect(state.sequentialExecution.calls).toHaveLength(1);
        state = transactionPlanReducer(state, {type: "START_SEQUENTIAL_CALL", callId: "call-2"});
        state = transactionPlanReducer(state, {type: "SEQUENTIAL_CALL_SUBMITTED", callId: "call-2", transactionHash: HASH_2, submittedAt: 14});
        state = transactionPlanReducer(state, {
            type: "SEQUENTIAL_CALL_CONFIRMED", callId: "call-2", transactionHash: HASH_2,
            blockNumber: "101", gasUsed: "22000", updatedAt: 15,
        });
        expect(state.sequentialExecution.status).toBe("completed");
        expect(state.sequentialExecution.calls.every((record) => record.status === "confirmed")).toBe(true);
    });

    it("locks the plan and atomic submission while sequential execution is active", () => {
        const active = transactionPlanReducer(draft(), {type: "START_SEQUENTIAL_EXECUTION", startedAt: 10});
        expect(transactionPlanReducer(active, {type: "REMOVE_CALL", callId: "call-1"})).toBe(active);
        expect(transactionPlanReducer(active, {type: "CLEAR_PLAN"})).toBe(active);
        expect(transactionPlanReducer(active, {type: "START_BATCH_SUBMISSION"})).toBe(active);

        const stopped = transactionPlanReducer(active, {type: "STOP_SEQUENTIAL_EXECUTION", updatedAt: 11});
        expect(stopped.sequentialExecution.status).toBe("stopped");
        expect(transactionPlanReducer(stopped, {type: "RESET_SEQUENTIAL_EXECUTION"}).sequentialExecution).toEqual({status: "idle", calls: []});
    });

    it("round-trips pending hashes, migrates legacy drafts, and rejects inconsistent prefixes", () => {
        const storage = memoryStorage();
        let pending = transactionPlanReducer(draft(), {type: "START_SEQUENTIAL_EXECUTION", startedAt: 10});
        pending = transactionPlanReducer(pending, {type: "START_SEQUENTIAL_CALL", callId: "call-1"});
        pending = transactionPlanReducer(pending, {type: "SEQUENTIAL_CALL_SUBMITTED", callId: "call-1", transactionHash: HASH_1, submittedAt: 11});
        saveTransactionPlan(pending, storage);
        expect(loadTransactionPlan(storage)).toEqual(pending);

        const legacy = draft();
        const {sequentialExecution: _sequentialExecution, ...legacyShape} = legacy;
        expect(parseTransactionPlan(JSON.stringify(legacyShape))).toEqual(legacy);

        const inconsistent = {
            ...pending,
            sequentialExecution: {
                ...pending.sequentialExecution,
                calls: [{...pending.sequentialExecution.calls[0], callId: "call-2"}],
            },
        };
        expect(parseTransactionPlan(JSON.stringify(inconsistent))).toBeNull();
    });

    it("recovers a pre-hash interrupted wallet submission as an explicit failure", () => {
        const storage = memoryStorage();
        let submitting = transactionPlanReducer(draft(), {type: "START_SEQUENTIAL_EXECUTION", startedAt: 10});
        submitting = transactionPlanReducer(submitting, {type: "START_SEQUENTIAL_CALL", callId: "call-1"});
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(submitting));

        const recovered = loadTransactionPlan(storage);
        expect(recovered.sequentialExecution.status).toBe("active");
        expect(recovered.sequentialExecution.calls[0]).toMatchObject({
            callId: "call-1",
            status: "failed",
            error: {code: "SUBMISSION_INTERRUPTED"},
        });
    });
});
