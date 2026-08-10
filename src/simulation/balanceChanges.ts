import { ethers } from "ethers";
import { BalanceChange, DecodedEvent, SimulatedCallResult, SimulationLog } from "./types";

export const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
export const NATIVE_TRANSFER_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function topicAddress(topic: string) {
    try {
        return ethers.getAddress(ethers.dataSlice(topic, 12));
    } catch {
        return null;
    }
}

export function decodeTransferEvent(log: SimulationLog): {
    asset: "native" | "erc20";
    from: string;
    to: string;
    amount: bigint;
    event: DecodedEvent;
} | null {
    if (log.topics.length !== 3 || log.topics[0].toLowerCase() !== TRANSFER_TOPIC.toLowerCase() || ethers.dataLength(log.data) !== 32) {
        return null;
    }
    const from = topicAddress(log.topics[1]);
    const to = topicAddress(log.topics[2]);
    if (!from || !to) return null;
    const amount = ethers.getBigInt(log.data);
    const asset = log.address.toLowerCase() === NATIVE_TRANSFER_ADDRESS ? "native" : "erc20";
    return {
        asset,
        from,
        to,
        amount,
        event: {
            address: log.address,
            name: asset === "native" ? "NativeTransfer" : "Transfer",
            signature: "Transfer(address,address,uint256)",
            arguments: [
                {name: "from", type: "address", value: from},
                {name: "to", type: "address", value: to},
                {name: "value", type: "uint256", value: amount.toString()},
            ],
            kind: asset === "native" ? "native-transfer" : "erc20-transfer",
            raw: log,
        },
    };
}

export function analyzeBalanceChanges(calls: SimulatedCallResult[]): BalanceChange[] {
    const totals = new Map<string, {asset: "native" | "erc20"; tokenAddress?: string; account: string; delta: bigint}>();
    const add = (asset: "native" | "erc20", tokenAddress: string | undefined, account: string, delta: bigint) => {
        if (account === ethers.ZeroAddress || delta === BigInt(0)) return;
        const key = `${asset}:${tokenAddress?.toLowerCase() ?? "native"}:${account.toLowerCase()}`;
        const existing = totals.get(key);
        totals.set(key, existing ? {...existing, delta: existing.delta + delta} : {asset, tokenAddress, account, delta});
    };

    for (const call of calls) {
        if (call.status !== "0x1") continue;
        for (const log of call.logs) {
            const transfer = decodeTransferEvent(log);
            if (!transfer) continue;
            const tokenAddress = transfer.asset === "erc20" ? log.address : undefined;
            add(transfer.asset, tokenAddress, transfer.from, -transfer.amount);
            add(transfer.asset, tokenAddress, transfer.to, transfer.amount);
        }
    }

    return Array.from(totals.values())
        .filter(({delta}) => delta !== BigInt(0))
        .map(({delta, ...change}) => ({...change, delta: delta.toString()}));
}
