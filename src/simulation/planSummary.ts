import { BalanceChange, PlanSimulatedCall, PlanSimulationSnapshot } from "./types";

export interface PlanSummary {
    totalCalls: number;
    succeeded: number;
    reverted: number;
    totalGas: bigint;
    netBalanceChanges: BalanceChange[];
}

export function totalPlanGas(calls: PlanSimulatedCall[]) {
    return calls.reduce((total, call) => total + BigInt(call.maxUsedGas ?? call.gasUsed), BigInt(0));
}

export function countPlanOutcomes(calls: PlanSimulatedCall[]) {
    const succeeded = calls.filter((call) => call.status === "0x1").length;
    return {succeeded, reverted: calls.length - succeeded};
}

export function summarizePlan(snapshot: PlanSimulationSnapshot): PlanSummary {
    return {
        totalCalls: snapshot.calls.length,
        ...countPlanOutcomes(snapshot.calls),
        totalGas: totalPlanGas(snapshot.calls),
        netBalanceChanges: snapshot.balanceChanges.filter((change) => change.delta !== "0"),
    };
}

export function estimatedFee(totalGas: bigint, gasPriceWei: bigint) {
    return totalGas * gasPriceWei;
}

export function compactNetBalanceChanges(
    changes: BalanceChange[],
    planAccount: string,
    targets: Iterable<string>,
    limit = 4,
): {changes: BalanceChange[]; omitted: number} {
    const targetSet = new Set(Array.from(targets, (target) => target.toLowerCase()));
    const account = planAccount.toLowerCase();
    const rank = (change: BalanceChange) => {
        const address = change.account.toLowerCase();
        return address === account ? 0 : targetSet.has(address) ? 1 : 2;
    };
    const ordered = changes
        .filter((change) => change.delta !== "0")
        .map((change, index) => ({change, index}))
        .sort((left, right) => rank(left.change) - rank(right.change) || left.index - right.index)
        .map(({change}) => change);
    return {
        changes: ordered.slice(0, limit),
        omitted: Math.max(0, ordered.length - limit),
    };
}
