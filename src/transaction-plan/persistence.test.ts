import {
    LEGACY_TRANSACTION_PLAN_STORAGE_KEY,
    LEGACY_V2_TRANSACTION_PLAN_STORAGE_KEY,
    loadTransactionPlan,
    migrateLegacyTransactionPlan,
    migrateV2TransactionPlan,
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
        storage.setItem(LEGACY_V2_TRANSACTION_PLAN_STORAGE_KEY, "legacy-v2");
        storage.setItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY, "legacy");
        saveTransactionPlan(createEmptyTransactionPlanState(), storage);
        expect(storage.getItem(TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
        expect(storage.getItem(LEGACY_V2_TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
        expect(storage.getItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
    });

    it("fails closed for malformed, mismatched, and unsupported data", () => {
        const valid = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        expect(parseTransactionPlan("not json")).toBeNull();
        expect(parseTransactionPlan(JSON.stringify({...valid, version: 4}))).toBeNull();
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

    it("migrates a saved v1 draft without losing calls", () => {
        const storage = memoryStorage();
        const current = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        const legacy = {
            version: 1,
            plan: {...current.plan, requiresResume: false},
            execution: {status: "idle", resultsByCallId: {}},
        };
        storage.setItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(legacy));

        const migrated = loadTransactionPlan(storage);
        expect(migrated.version).toBe(3);
        expect(migrated.plan.calls).toEqual([queuedCall]);
        expect(migrated.execution).toEqual({status: "idle"});
        expect(migrateLegacyTransactionPlan(JSON.stringify(legacy))).toEqual(migrated);

        saveTransactionPlan(migrated, storage);
        expect(storage.getItem(TRANSACTION_PLAN_STORAGE_KEY)).not.toBeNull();
        expect(storage.getItem(LEGACY_V2_TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
        expect(storage.getItem(LEGACY_TRANSACTION_PLAN_STORAGE_KEY)).toBeNull();
    });

    it("migrates a saved v2 batch without losing execution tracking", () => {
        const storage = memoryStorage();
        const current = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: queuedCall});
        const legacyV2 = {
            ...current,
            version: 2,
            plan: {...current.plan, requiresResume: false},
            execution: {status: "pending", batchId: "0x1234", submittedAt: 10},
        };
        storage.setItem(LEGACY_V2_TRANSACTION_PLAN_STORAGE_KEY, JSON.stringify(legacyV2));

        const migrated = loadTransactionPlan(storage);
        expect(migrated).toEqual({
            ...current,
            version: 3,
            execution: legacyV2.execution,
        });
        expect(migrateV2TransactionPlan(JSON.stringify(legacyV2))).toEqual(migrated);
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
