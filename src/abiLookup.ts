import {ethers} from "ethers";
import {chainsById} from "./chainConfig";

export type AbiLookupSource = "Sourcify" | "Blockscout";
export type AbiLookupFailureKind = "not-found" | "unavailable";

export interface AbiLookupResult {
    abi: unknown[];
    source: AbiLookupSource;
}

export class AbiLookupError extends Error {
    constructor(public readonly kind: AbiLookupFailureKind) {
        super(kind === "not-found"
            ? "No verified ABI was found for this contract."
            : "The ABI providers could not complete the lookup.");
        this.name = "AbiLookupError";
        Object.setPrototypeOf(this, AbiLookupError.prototype);
    }
}

interface LookupAttempt {
    kind: "success" | AbiLookupFailureKind;
    result?: AbiLookupResult;
}

function validAbi(value: unknown): value is unknown[] {
    if (!Array.isArray(value)) {
        return false;
    }

    try {
        new ethers.Interface(value as ethers.InterfaceAbi);
        return true;
    } catch {
        return false;
    }
}

async function lookupSourcify(address: string, chainId: string, signal: AbortSignal): Promise<LookupAttempt> {
    let response: Response;
    try {
        response = await fetch(`https://sourcify.dev/server/v2/contract/${encodeURIComponent(chainId)}/${encodeURIComponent(address)}?fields=abi`, {signal});
    } catch (error) {
        if (signal.aborted) throw error;
        return {kind: "unavailable"};
    }

    if (response.status === 404) return {kind: "not-found"};
    if (!response.ok) return {kind: "unavailable"};

    try {
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("abi" in payload)) {
            return {kind: "not-found"};
        }
        const abi = (payload as {abi: unknown}).abi;
        return validAbi(abi)
            ? {kind: "success", result: {abi, source: "Sourcify"}}
            : {kind: "unavailable"};
    } catch {
        return {kind: "unavailable"};
    }
}

async function lookupBlockscout(address: string, chainId: string, signal: AbortSignal): Promise<LookupAttempt> {
    const apiUrl = chainsById.get(chainId)?.blockscoutApiUrl;
    if (!apiUrl) return {kind: "not-found"};

    const url = new URL(apiUrl);
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "getabi");
    url.searchParams.set("address", address);

    let response: Response;
    try {
        response = await fetch(url.toString(), {signal});
    } catch (error) {
        if (signal.aborted) throw error;
        return {kind: "unavailable"};
    }

    if (response.status === 404) return {kind: "not-found"};
    if (!response.ok) return {kind: "unavailable"};

    try {
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null) return {kind: "unavailable"};
        const {status, message, result} = payload as {status?: unknown; message?: unknown; result?: unknown};
        if (status !== "1" || typeof result !== "string") {
            const details = `${typeof message === "string" ? message : ""} ${typeof result === "string" ? result : ""}`.toLowerCase();
            return {kind: /not verified|not found|no data/.test(details) ? "not-found" : "unavailable"};
        }
        const abi: unknown = JSON.parse(result);
        return validAbi(abi)
            ? {kind: "success", result: {abi, source: "Blockscout"}}
            : {kind: "unavailable"};
    } catch {
        return {kind: "unavailable"};
    }
}

export async function fetchVerifiedAbi({address, chainId, signal}: {
    address: string;
    chainId: string;
    signal: AbortSignal;
}): Promise<AbiLookupResult> {
    const sourcify = await lookupSourcify(address, chainId, signal);
    if (sourcify.result) return sourcify.result;
    const blockscout = await lookupBlockscout(address, chainId, signal);
    if (blockscout.result) return blockscout.result;
    const attempts = [sourcify, blockscout];
    throw new AbiLookupError(attempts.some((attempt) => attempt.kind === "unavailable") ? "unavailable" : "not-found");
}
