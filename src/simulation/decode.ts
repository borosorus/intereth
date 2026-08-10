import { ethers } from "ethers";
import { QueuedCall } from "../transaction-plan/types";
import {
    DecodedEvent,
    DecodedRevert,
    DecodedValue,
    PlanSimulationSnapshot,
    SimulatedCallsResult,
    SimulationLog,
} from "./types";
import { analyzeBalanceChanges, decodeTransferEvent } from "./balanceChanges";

const standardErrors = new ethers.Interface([
    "error Error(string message)",
    "error Panic(uint256 code)",
]);

function printable(value: unknown): string {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        try {
            return JSON.stringify(value, (_, nested) => typeof nested === "bigint" ? nested.toString() : nested);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function decodedValues(inputs: readonly ethers.ParamType[], values: ethers.Result): DecodedValue[] {
    return inputs.map((input, index) => ({
        name: input.name || `Argument ${index + 1}`,
        type: input.type,
        value: printable(values[index]),
    }));
}

function interfacesByAddress(calls: QueuedCall[]) {
    const fragments = new Map<string, string[]>();
    for (const call of calls) {
        const key = call.to.toLowerCase();
        fragments.set(key, [...(fragments.get(key) ?? []), ...call.decoderAbi]);
    }
    return new Map(Array.from(fragments.entries()).map(([address, abi]) => {
        try {
            return [address, new ethers.Interface(Array.from(new Set(abi)))] as const;
        } catch {
            return [address, null] as const;
        }
    }));
}

function decodeEvent(log: SimulationLog, interfaces: Map<string, ethers.Interface | null>): DecodedEvent | null {
    const transfer = decodeTransferEvent(log);
    if (transfer?.asset === "native") return transfer.event;

    const contractInterface = interfaces.get(log.address.toLowerCase());
    if (contractInterface) {
        try {
            const parsed = contractInterface.parseLog({topics: log.topics, data: log.data});
            if (parsed) {
                return {
                    address: log.address,
                    name: parsed.name,
                    signature: parsed.signature,
                    arguments: decodedValues(parsed.fragment.inputs, parsed.args),
                    kind: "abi",
                    raw: log,
                };
            }
        } catch {
            // Fall through to a standard transfer decoder.
        }
    }
    return transfer?.event ?? null;
}

function revertData(result: SimulatedCallsResult["calls"][number]) {
    if (result.error?.data && ethers.isHexString(result.error.data)) return result.error.data;
    return result.returnData !== "0x" ? result.returnData : "0x";
}

function parseRevert(contractInterface: ethers.Interface, data: string, kind: "standard" | "custom"): DecodedRevert | null {
    try {
        const parsed = contractInterface.parseError(data);
        if (!parsed) return null;
        const args = decodedValues(parsed.fragment.inputs, parsed.args);
        return {
            name: parsed.name,
            signature: parsed.signature,
            message: parsed.name === "Error" ? printable(parsed.args[0]) : parsed.name === "Panic" ? `Panic code ${printable(parsed.args[0])}` : parsed.signature,
            arguments: args,
            data,
            kind,
        };
    } catch {
        return null;
    }
}

function decodeRevert(call: QueuedCall, result: SimulatedCallsResult["calls"][number]): DecodedRevert | undefined {
    if (result.status !== "0x0") return undefined;
    const data = revertData(result);
    const standard = parseRevert(standardErrors, data, "standard");
    if (standard) return standard;
    if (call.decoderAbi.length > 0) {
        try {
            const custom = parseRevert(new ethers.Interface(call.decoderAbi), data, "custom");
            if (custom) return custom;
        } catch {
            // Invalid decoder metadata is already rejected by plan persistence/preparation.
        }
    }
    return {
        name: "Reverted",
        message: result.error?.message ?? "The call reverted without a decodable reason.",
        arguments: [],
        data,
        kind: "raw",
    };
}

export function createPlanSimulationSnapshot(
    context: {chainId: string; account: string},
    calls: QueuedCall[],
    result: SimulatedCallsResult,
    revision: string,
    baseBlockNumber: string,
): PlanSimulationSnapshot {
    const interfaces = interfacesByAddress(calls);
    const simulatedCalls = result.calls.map((callResult, index) => ({
        ...callResult,
        callId: calls[index].id,
        decodedEvents: callResult.logs.map((log) => decodeEvent(log, interfaces)).filter((event): event is DecodedEvent => event !== null),
        decodedRevert: decodeRevert(calls[index], callResult),
    }));
    return {
        revision,
        chainId: context.chainId,
        account: context.account,
        baseBlockNumber,
        simulatedBlockNumber: result.blockNumber,
        calls: simulatedCalls,
        balanceChanges: analyzeBalanceChanges(result.calls),
        raw: result.raw,
    };
}
