import { ethers } from "ethers";

export interface NormalizedError {
    title: string;
    message: string;
    code?: string;
    details: string;
}

export type ReadResultSource =
    | {kind: "onchain"}
    | {kind: "simulated"; queuedCallCount: number};

export type CallResultData =
    | {kind: "function"; outputs: readonly ethers.ParamType[]; value: unknown; source: ReadResultSource}
    | {kind: "raw"; data: string; source: ReadResultSource}
    | {
        kind: "transaction";
        status: "submitted" | "confirmed" | "failed" | "pending";
        hash: string;
        blockNumber?: number;
        gasUsed?: string;
    };

type ErrorLike = {
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
    reason?: unknown;
    stack?: unknown;
    info?: unknown;
    error?: unknown;
};

function asErrorLike(error: unknown): ErrorLike {
    return typeof error === "object" && error !== null ? error as ErrorLike : {};
}

function safeStringify(value: unknown) {
    const seen = new WeakSet<object>();
    try {
        return JSON.stringify(value, (_, nestedValue) => {
            if (typeof nestedValue === "bigint") {
                return nestedValue.toString();
            }
            if (typeof nestedValue === "object" && nestedValue !== null) {
                if (seen.has(nestedValue)) {
                    return "[Circular]";
                }
                seen.add(nestedValue);
            }
            return nestedValue;
        }, 2);
    } catch {
        return String(value);
    }
}

export function normalizeError(error: unknown, fallbackTitle = "Call failed"): NormalizedError {
    const candidate = asErrorLike(error);
    const info = asErrorLike(candidate.info);
    const nested = Object.keys(asErrorLike(candidate.error)).length > 0
        ? asErrorLike(candidate.error)
        : asErrorLike(info.error);
    const rawCode = nested.code ?? candidate.code;
    const code = typeof rawCode === "string" || typeof rawCode === "number" ? String(rawCode) : undefined;
    const reason = typeof candidate.reason === "string"
        ? candidate.reason
        : typeof nested.reason === "string" ? nested.reason : undefined;
    const shortMessage = typeof candidate.shortMessage === "string"
        ? candidate.shortMessage
        : typeof nested.shortMessage === "string" ? nested.shortMessage : undefined;
    const message = typeof nested.message === "string"
        ? nested.message
        : typeof candidate.message === "string" ? candidate.message : undefined;

    let title = fallbackTitle;
    let displayMessage = reason || shortMessage || message || (typeof error === "string" ? error : "An unexpected error occurred.");

    if (code === "ACTION_REJECTED" || code === "4001") {
        title = "Request rejected";
        displayMessage = "The wallet request was rejected. No transaction was sent.";
    } else if (code === "-32601") {
        title = "Wallet method unsupported";
        displayMessage = "This wallet does not support the requested batching method.";
    } else if (code === "-32602") {
        title = "Invalid wallet request";
        displayMessage = message || "The wallet rejected malformed batch parameters.";
    } else if (code === "4100") {
        title = "Wallet authorization required";
        displayMessage = "Reconnect or unlock the plan account before using wallet batching.";
    } else if (code === "5750") {
        title = "Smart account upgrade rejected";
        displayMessage = "The wallet could not or would not upgrade this account for atomic execution. No batch was sent.";
    } else if (code === "5760" || code === "5700") {
        title = "Atomic batching unavailable";
        displayMessage = "This wallet cannot execute the requested calls as an atomic batch.";
    } else if (code === "5710") {
        title = "Network not supported";
        displayMessage = "The wallet does not support this batch on the plan network.";
    } else if (code === "5720") {
        title = "Duplicate batch identifier";
        displayMessage = "The wallet reports that this batch identifier has already been used.";
    } else if (code === "5730") {
        title = "Batch not found";
        displayMessage = "The wallet no longer recognizes this batch identifier. The plan was not resubmitted.";
    } else if (code === "5740") {
        title = "Batch is too large";
        displayMessage = "The wallet cannot accept this many calls in one batch.";
    } else if (code === "PLAN_CONTEXT_MISMATCH") {
        title = "Session changed";
        displayMessage = "The connected account or network no longer matches this transaction plan.";
    } else if (code === "SIMULATION_NOT_CONFIGURED") {
        title = "Simulation unavailable";
        displayMessage = "No simulation RPC is configured for this network.";
    } else if (code === "SIMULATION_UNSUPPORTED") {
        title = "Simulation unsupported";
        displayMessage = "The configured RPC does not support eth_simulateV1.";
    } else if (code === "SIMULATION_RPC_UNAVAILABLE") {
        title = "Simulation unavailable";
        displayMessage = message || "The simulation RPC could not complete the request.";
    } else if (code === "SIMULATION_CHAIN_MISMATCH") {
        title = "Wrong simulation network";
        displayMessage = message || "The configured simulation RPC is connected to another network.";
    } else if (code === "SIMULATION_RESPONSE_INVALID") {
        title = "Invalid simulation response";
        displayMessage = message || "The simulation RPC returned data Intereth could not validate.";
    } else if (code === "SIMULATION_QUEUED_CALL_REVERTED") {
        title = "Queued call reverted";
        displayMessage = message || "A queued call reverted before the read could run.";
    } else if (code === "SIMULATION_READ_REVERTED") {
        title = "Simulated read reverted";
        displayMessage = message || "The read reverted after applying the queued calls.";
    } else if (code === "INVALID_BATCH_RESPONSE") {
        title = "Invalid wallet response";
        displayMessage = message || "The wallet returned invalid batch data.";
    } else if (code === "TIMEOUT") {
        title = "Confirmation timed out";
        displayMessage = "The transaction was submitted, but confirmation was not received before the timeout.";
    } else if (code === "NETWORK_ERROR" || code === "SERVER_ERROR") {
        title = "Network request failed";
        displayMessage = shortMessage || message || "The selected RPC provider could not complete the request.";
    } else if (code === "CALL_EXCEPTION") {
        title = "Contract call reverted";
        displayMessage = reason || shortMessage || "The contract rejected the call without a readable reason.";
    } else if (code === "INVALID_ARGUMENT") {
        title = "Invalid input";
        displayMessage = shortMessage || message || "One or more call arguments are invalid.";
    } else if (code === "NO_CONTRACT_CODE") {
        title = "No contract on this network";
        displayMessage = shortMessage || "The selected address has no deployed bytecode on the selected RPC network.";
    } else if (code === "BAD_DATA") {
        title = "Result could not be decoded";
        displayMessage = "The RPC returned data that does not match this function's ABI. Check that the contract address, selected network, and ABI belong together.";
    }

    const details = typeof candidate.stack === "string"
        ? candidate.stack
        : safeStringify(error);

    return {title, message: displayMessage, code, details};
}

export function valuesForOutputs(outputs: readonly ethers.ParamType[], value: unknown): unknown[] {
    if (outputs.length === 0) {
        return [];
    }
    if (outputs.length === 1) {
        return [value];
    }
    return value != null && typeof (value as ArrayLike<unknown>).length === "number"
        ? Array.from(value as ArrayLike<unknown>)
        : [value];
}

export function normalizeAbiValue(param: ethers.ParamType, value: unknown): unknown {
    if (param.baseType === "array") {
        const child = param.arrayChildren as ethers.ParamType;
        return Array.from((value ?? []) as ArrayLike<unknown>).map((item) => normalizeAbiValue(child, item));
    }
    if (param.baseType === "tuple") {
        const values = Array.from((value ?? []) as ArrayLike<unknown>);
        return Object.fromEntries((param.components ?? []).map((component, index) => [
            component.name || `field${index + 1}`,
            normalizeAbiValue(component, values[index]),
        ]));
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    return value == null ? null : value;
}

export function formatAbiValue(param: ethers.ParamType, value: unknown) {
    const normalized = normalizeAbiValue(param, value);
    return typeof normalized === "string" ? normalized : safeStringify(normalized);
}
