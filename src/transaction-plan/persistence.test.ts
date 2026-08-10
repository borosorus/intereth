import {
    loadTransactionPlan,
    parseTransactionPlan,
    saveTransactionPlan,
    TRANSACTION_PLAN_STORAGE_KEY,
} from "./persistence";
import { transactionPlanReducer, createEmptyTransactionPlanState } from "./reducer";
import { QueuedCall } from "./types";

const queuedCall: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000010",
    data: "0x1234",
    value: "100",
    decoderAbi: [],
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

    it("preserves tracked batches and recovers a submission interrupted before an ID was saved", () => {
        const storage = memoryStorage();
        const draft = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        const pending = {...draft, execution: {status: "pending" as const, batchId: "0x1234"}};
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(pending));
        expect(loadTransactionPlan(storage)).toEqual(pending);

        const submitting = transactionPlanReducer(draft, {type: "START_BATCH_SUBMISSION"});
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(submitting));

        expect(loadTransactionPlan(storage)).toEqual({
            ...draft,
            execution: {
                status: "idle",
                error: {
                    code: "SUBMISSION_INTERRUPTED",
                    message: "Batch submission was interrupted before a batch ID was saved.",
                },
            },
        });
    });

    it("removes storage for an empty plan", () => {
        const storage = memoryStorage();
        storage.setItem(TRANSACTION_PLAN_STORAGE_KEY, "saved");
        saveTransactionPlan(createEmptyTransactionPlanState(), storage);
        expect(storage.getItem(TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
    });

    it("does not read the retired versioned storage key", () => {
        const storage = memoryStorage();
        const state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        storage.setItem("intereth.transaction-plan.v3", JSON.stringify({...state, version: 3}));

        expect(loadTransactionPlan(storage)).toEqual(createEmptyTransactionPlanState());
    });

    it("fails closed for malformed and inconsistent data", () => {
        const valid = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        expect(parseTransactionPlan("not json")).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({...valid, version: 3}))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {...valid.plan, context: {...valid.plan.context!, chainId: "10"}},
        }))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {...valid.plan, calls: [queuedCall, queuedCall]},
        }))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {...valid.plan, calls: [{...queuedCall, decoderAbi: undefined}]},
        }))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {...valid.plan, calls: [{...queuedCall, decoderAbi: ["function owner() view returns (address)"]}]},
        }))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {
                ...valid.plan,
                calls: [{...queuedCall, display: {...queuedCall.display, arguments: {length: 1}}}],
            },
        }))).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({
            ...valid,
            plan: {
                ...valid.plan,
                calls: [{...queuedCall, display: {...queuedCall.display, kind: "abi"}, editor: {kind: "abi", functionFragment: "not a function", arguments: []}}],
            },
        }))).toBeNull();
    });

    it("rejects inconsistent persisted execution records", () => {
        const valid = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        const candidate = (execution: unknown) => JSON.stringify({...valid, execution});

        expect(parseTransactionPlan(candidate({status: "idle", batchId: "0x1234"}))).toBeNull();
        expect(parseTransactionPlan(candidate({status: "confirmed", batchId: "0x1234", walletStatus: 500, atomic: true}))).toBeNull();
        expect(parseTransactionPlan(candidate({status: "confirmed", batchId: "0x1234", walletStatus: 200, atomic: false}))).toBeNull();
        expect(parseTransactionPlan(candidate({status: "pending", batchId: "0x1234", walletStatus: 200, atomic: true}))).toBeNull();
        expect(parseTransactionPlan(candidate({status: "pending", batchId: "0x1234", walletStatus: 100, atomic: true}))).not.toBeNull();
        expect(parseTransactionPlan(candidate({status: "confirmed", batchId: "0x1234", walletStatus: 200, atomic: true}))).not.toBeNull();
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
