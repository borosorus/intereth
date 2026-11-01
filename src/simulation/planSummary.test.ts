import { compactNetBalanceChanges, countPlanOutcomes, estimatedFee, summarizePlan, totalPlanGas } from "./planSummary";
import { PlanSimulatedCall, PlanSimulationSnapshot } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const TOKEN = "0x0000000000000000000000000000000000000020";

function call(overrides: Partial<PlanSimulatedCall> = {}): PlanSimulatedCall {
    return {
        callId: "call",
        status: "0x1",
        returnData: "0x",
        gasUsed: "0x64",
        logs: [],
        decodedEvents: [],
        raw: {},
        ...overrides,
    };
}

function snapshot(calls: PlanSimulatedCall[]): PlanSimulationSnapshot {
    return {
        revision: "revision",
        capturedAt: 1,
        chainId: "1",
        account: ACCOUNT,
        baseBlockNumber: "0x64",
        calls,
        balanceChanges: [],
        raw: {},
    };
}

describe("planSummary", () => {
    it("counts outcomes and uses maxUsedGas when the RPC provides it", () => {
        const calls = [
            call({callId: "one", maxUsedGas: "0x64"}),
            call({callId: "two", gasUsed: "0x20"}),
            call({callId: "three", status: "0x0", gasUsed: "0x1", maxUsedGas: "0x30"}),
        ];

        expect(countPlanOutcomes(calls)).toEqual({succeeded: 2, reverted: 1});
        expect(totalPlanGas(calls)).toBe(BigInt(180));
        expect(summarizePlan(snapshot(calls))).toMatchObject({
            totalCalls: 3,
            succeeded: 2,
            reverted: 1,
            totalGas: BigInt(180),
        });
    });

    it("computes a fee estimate and keeps non-zero balance effects", () => {
        const snap = {
            ...snapshot([call()]),
            balanceChanges: [
                {asset: "native" as const, account: ACCOUNT, delta: "-1000"},
                {asset: "erc20" as const, tokenAddress: TOKEN, account: TARGET, delta: "0"},
            ],
        };

        expect(estimatedFee(BigInt(21000), BigInt(1_000_000_000))).toBe(BigInt(21_000_000_000_000));
        expect(summarizePlan(snap).netBalanceChanges).toEqual([
            {asset: "native", account: ACCOUNT, delta: "-1000"},
        ]);
    });

    it("prioritizes the plan sender and limits compact balance effects", () => {
        const changes = [
            {asset: "erc20" as const, tokenAddress: TOKEN, account: "0x0000000000000000000000000000000000000099", delta: "1"},
            {asset: "native" as const, account: ACCOUNT, delta: "2"},
            {asset: "native" as const, account: TARGET, delta: "3"},
            {asset: "native" as const, account: "0x0000000000000000000000000000000000000098", delta: "4"},
        ];

        expect(compactNetBalanceChanges(changes, ACCOUNT, [TARGET], 2)).toEqual({
            changes: [changes[1], changes[2]],
            omitted: 2,
        });
    });
});
