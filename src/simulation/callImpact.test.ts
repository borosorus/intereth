import { selectCallImpact, prioritizeBalanceChanges } from "./callImpact";
import { PlanSimulationSnapshot } from "./types";

const call = {
    callId: "call-1", status: "0x1" as const, returnData: "0x", gasUsed: "0x5208", logs: [], decodedEvents: [], raw: {},
};
const snapshot: PlanSimulationSnapshot = {
    revision: "current", chainId: "1", account: "0x0000000000000000000000000000000000000001",
    baseBlockNumber: "0x64", calls: [call], balanceChanges: [], raw: {},
};

describe("per-call simulation impacts", () => {
    it("only exposes effects from a fresh matching snapshot", () => {
        expect(selectCallImpact({callId: "call-1", revision: "current", status: "ready", snapshot})).toMatchObject({state: "ready", call});
        expect(selectCallImpact({callId: "call-1", revision: "next", status: "ready", snapshot})).toEqual({state: "stale"});
        expect(selectCallImpact({callId: "call-1", revision: "current", status: "simulating", snapshot})).toEqual({state: "refreshing"});
        expect(selectCallImpact({callId: "missing", revision: "current", status: "ready", snapshot})).toEqual({state: "unavailable"});
    });

    it("prioritizes the plan account and call target without changing stable order", () => {
        const changes = [{account: "other"}, {account: "target"}, {account: "sender"}, {account: "another"}];
        expect(prioritizeBalanceChanges(changes, "sender", "target").map(({account}) => account)).toEqual(["sender", "target", "other", "another"]);
    });
});
