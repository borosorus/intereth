import { ethers } from "ethers";
import { QueuedCall } from "../transaction-plan/types";
import { buildParamValues, cloneParamValues, ParamValue, toWeiValue, ValueUnit } from "./parameters";

interface PreparedCallIdentity {
    target: string;
    account: string;
    chainId: string;
    id?: string;
    createdAt?: number;
}

interface PrepareAbiCallOptions extends PreparedCallIdentity {
    fragment: ethers.FunctionFragment;
    decoderAbi?: readonly string[];
    argumentValues: ParamValue[];
    valueAmount?: string;
    valueUnit?: ValueUnit;
}

export function decoderAbiForInterface(contractInterface: ethers.Interface) {
    return contractInterface.fragments
        .filter((fragment) => fragment.type === "event" || fragment.type === "error")
        .map((fragment) => fragment.format("full"));
}

function normalizeDecoderAbi(fragments: readonly string[] | undefined) {
    return (fragments ?? []).map((fragment) => {
        const parsed = ethers.Fragment.from(fragment);
        if (parsed.type !== "event" && parsed.type !== "error") {
            throw Object.assign(new Error("Decoder ABI may contain only event and error fragments."), {code: "INVALID_ARGUMENT"});
        }
        return parsed.format("full");
    });
}

interface PrepareRawCallOptions extends PreparedCallIdentity {
    data: string;
    valueAmount: string;
    valueUnit: ValueUnit;
}

function validateIdentity({target, account, chainId}: PreparedCallIdentity) {
    if (!/^\d+$/.test(chainId)) {
        throw Object.assign(new Error("Chain ID must be a decimal integer."), {code: "INVALID_ARGUMENT"});
    }
    return {
        to: ethers.getAddress(target),
        from: ethers.getAddress(account),
    };
}

function createIdentity(options: PreparedCallIdentity) {
    const identity = validateIdentity(options);
    const generatedId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : ethers.id(`${Date.now()}-${Math.random()}`);
    return {
        id: options.id ?? generatedId,
        createdAt: options.createdAt ?? Date.now(),
        chainId: options.chainId,
        ...identity,
    };
}

function formatDisplayValue(value: unknown): string {
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return JSON.stringify(value, (_, nestedValue) => typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue);
    }
    return String(value);
}

export function prepareAbiCall(options: PrepareAbiCallOptions): QueuedCall {
    const {fragment} = options;
    if (fragment.stateMutability !== "payable" && fragment.stateMutability !== "nonpayable") {
        throw Object.assign(new Error("Only state-modifying functions can be queued."), {code: "INVALID_ARGUMENT"});
    }

    const identity = createIdentity(options);
    const args = buildParamValues(fragment.inputs, options.argumentValues);
    const contractInterface = new ethers.Interface([fragment]);
    const value = fragment.stateMutability === "payable"
        ? toWeiValue(options.valueAmount ?? "", options.valueUnit ?? "wei")
        : BigInt(0);

    return {
        ...identity,
        data: contractInterface.encodeFunctionData(fragment, args),
        value: value.toString(),
        decoderAbi: normalizeDecoderAbi(options.decoderAbi),
        display: {
            kind: "abi",
            contractAddress: identity.to,
            functionName: fragment.name,
            functionSignature: fragment.format("sighash"),
            arguments: fragment.inputs.map((input, index) => ({
                name: input.name || `Input ${index + 1}`,
                type: input.type,
                value: formatDisplayValue(args[index]),
            })),
        },
        editor: {
            kind: "abi",
            functionFragment: fragment.format("full"),
            arguments: cloneParamValues(options.argumentValues),
        },
    };
}

export function prepareRawCall(options: PrepareRawCallOptions): QueuedCall {
    const identity = createIdentity(options);
    const data = options.data.trim() || "0x";
    try {
        ethers.dataLength(data);
    } catch {
        throw Object.assign(new Error("Calldata must be a valid even-length hexadecimal value prefixed with 0x."), {code: "INVALID_ARGUMENT"});
    }

    return {
        ...identity,
        data,
        value: toWeiValue(options.valueAmount, options.valueUnit).toString(),
        decoderAbi: [],
        display: {
            kind: "raw",
            contractAddress: identity.to,
        },
        editor: {kind: "raw"},
    };
}
