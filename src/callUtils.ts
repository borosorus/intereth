import { ethers } from "ethers";

export interface NormalizedError {
    title: string;
    message: string;
    code?: string;
    details: string;
}

export type CallResultData =
    | {kind: "function"; outputs: readonly ethers.ParamType[]; value: unknown}
    | {kind: "raw"; data: string}
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
    const code = typeof candidate.code === "string" ? candidate.code : undefined;
    const reason = typeof candidate.reason === "string" ? candidate.reason : undefined;
    const shortMessage = typeof candidate.shortMessage === "string" ? candidate.shortMessage : undefined;
    const message = typeof candidate.message === "string" ? candidate.message : undefined;

    let title = fallbackTitle;
    let displayMessage = reason || shortMessage || message || (typeof error === "string" ? error : "An unexpected error occurred.");

    if (code === "ACTION_REJECTED") {
        title = "Request rejected";
        displayMessage = "The wallet request was rejected. No transaction was sent.";
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
