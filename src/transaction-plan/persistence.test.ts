import { loadTransactionPlan, parseTransactionPlan, saveTransactionPlan, TRANSACTION_PLAN_STORAGE_KEY } from "./persistence";
import { transactionPlanReducer, createEmptyTransactionPlanState } from "./reducer";
import { QueuedCall } from "./types";

const queuedCall: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000010",
    data: "0x1234",
    value: "100",
    display: {kind: "raw", contractAddress: "0x0000000000000000000000000000000000000010"},
    editor: {kind: "raw"},
    createdAt: 1,
};

function memoryStorage() {
    const entries = new Map<string, string>();
    return {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
    };
}

describe("transaction plan persistence", () => {
    it("round-trips a JSON-safe plan", () => {
        const storage = memoryStorage();
        const state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});

        saveTransactionPlan(state, storage);
        expect(loadTransactionPlan(storage)).toEqual(state);
        expect(() => JSON.stringify(state)).not.toThrow();
    });

    it("removes storage for an empty plan", () => {
        const storage = memoryStorage();
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, "saved");
        saveTransactionPlan(createEmptyTransactionPlanState(), storage);
        expect(storage.getItem(TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
    });

    it("fails closed for malformed, mismatched, and unsupported data", () => {
        const valid = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        expect(parseTransactionPlan("not json")).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({...valid, version: 2}))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {...valid.plan, context: {...valid.plan.context!, chainId: "10"}},
        }))).toBeNull();
    });

    it("handles unavailable storage without breaking the in-memory plan", () => {
        const throwingStorage = {
            getItem: () => { throw new Error("blocked"); },
            setItem: () => { throw new Error("blocked"); },
            removeItem: () => { throw new Error("blocked"); },
        };
        expect(loadTransactionPlan(throwingStorage)).toEqual(createEmptyTransactionPlanState());
        expect(() => saveTransactionPlan(createEmptyTransactionPlanState(), throwingStorage)).not.toThrow();
    });
});
