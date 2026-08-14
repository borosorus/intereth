import { analyzeBalanceChanges } from "./balanceChanges";
import { PlanSimulationSnapshot, PlanSimulatedCall } from "./types";
import type { SimulationStatus } from "./context";

export type CallImpact =
    | {state: "ready"; call: PlanSimulatedCall; balanceChanges: ReturnType<typeof analyzeBalanceChanges>}
    | {state: "refreshing" | "stale" | "unavailable"};

export function selectCallImpact(options: {
    callId: string;
    revision: string;
    status: SimulationStatus;
    snapshot: PlanSimulationSnapshot | null;
}): CallImpact {
    const {callId, revision, status, snapshot} = options;
    if (status === "waiting" || status === "simulating") return {state: "refreshing"};
    if (status === "ready" && snapshot?.revision === revision) {
        const call = snapshot.calls.find((candidate) => candidate.callId === callId);
        return call ? {state: "ready", call, balanceChanges: analyzeBalanceChanges([call])} : {state: "unavailable"};
    }
    if (snapshot && snapshot.revision !== revision) return {state: "stale"};
    return {state: "unavailable"};
}

export function prioritizeBalanceChanges<T extends {account: string}>(changes: T[], planAccount: string, target: string) {
    const rank = (account: string) => account.toLowerCase() === planAccount.toLowerCase()
        ? 0
        : account.toLowerCase() === target.toLowerCase() ? 1 : 2;
    return changes.map((change, index) => ({change, index}))
        .sort((a, b) => rank(a.change.account) - rank(b.change.account) || a.index - b.index)
        .map(({change}) => change);
}
