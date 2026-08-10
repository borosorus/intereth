import { ethers } from "ethers";
import { formatAbiValue } from "../callUtils";
import { buildParamValues, ParamValue } from "../calls/parameters";
import { normalizeReadData } from "../calls/readCall";
import { PlanContext, WatchExpression } from "../transaction-plan/types";
import { DecodedValue, WatchResultValue } from "./types";

function createWatchId() {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : ethers.id(`${Date.now()}-${Math.random()}`);
}

function printable(value: unknown): string {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) {
        return JSON.stringify(value, (_, nested) => typeof nested === "bigint" ? nested.toString() : nested);
    }
    return String(value);
}

interface PrepareWatchIdentity {
    target: string;
    context: PlanContext;
    id?: string;
    createdAt?: number;
}

export function prepareAbiWatch(options: PrepareWatchIdentity & {fragment: ethers.FunctionFragment; argumentValues: ParamValue[]}): WatchExpression {
    const {fragment} = options;
    if (fragment.stateMutability !== "view" && fragment.stateMutability !== "pure") {
        throw Object.assign(new Error("Only read-only functions can be pinned as watches."), {code: "INVALID_ARGUMENT"});
    }
    const args = buildParamValues(fragment.inputs, options.argumentValues);
    const contractInterface = new ethers.Interface([fragment]);
    return {
        id: options.id ?? createWatchId(),
        chainId: options.context.chainId,
        from: ethers.getAddress(options.context.account),
        to: ethers.getAddress(options.target),
        data: contractInterface.encodeFunctionData(fragment, args),
        value: "0",
        display: {
            kind: "abi",
            functionSignature: fragment.format("sighash"),
            arguments: fragment.inputs.map((input, index) => ({
                name: input.name || `Input ${index + 1}`,
                type: input.type,
                value: printable(args[index]),
            })),
        },
        decoder: {kind: "abi", functionFragment: fragment.format("full")},
        createdAt: options.createdAt ?? Date.now(),
    };
}

export function prepareRawWatch(options: PrepareWatchIdentity & {data: string}): WatchExpression {
    return {
        id: options.id ?? createWatchId(),
        chainId: options.context.chainId,
        from: ethers.getAddress(options.context.account),
        to: ethers.getAddress(options.target),
        data: normalizeReadData(options.data),
        value: "0",
        display: {kind: "raw"},
        decoder: {kind: "raw"},
        createdAt: options.createdAt ?? Date.now(),
    };
}

export function decodeWatchResult(watch: WatchExpression, returnData: string): WatchResultValue {
    if (watch.decoder.kind === "raw") return {returnData};
    const fragment = ethers.FunctionFragment.from(watch.decoder.functionFragment);
    const contractInterface = new ethers.Interface([fragment]);
    const decoded = contractInterface.decodeFunctionResult(fragment, returnData);
    const values = fragment.outputs.length === 1 ? [decoded[0]] : Array.from(decoded);
    const outputValues: DecodedValue[] = fragment.outputs.map((output, index) => ({
        name: output.name || `Output ${index + 1}`,
        type: output.type,
        value: formatAbiValue(output, values[index]),
    }));
    return {returnData, values: outputValues};
}
