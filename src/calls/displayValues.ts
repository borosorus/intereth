import { ethers } from "ethers";
import { DisplayArgument } from "../transaction-plan/types";

export interface DisplayValueSummary {
    primary: string;
    secondary?: string;
}

export function shortAddress(value: string) {
    return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function collectionLength(value: string) {
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === "object" ? Object.keys(parsed).length : null;
    } catch {
        return null;
    }
}

export function summarizeArgument(argument: DisplayArgument): DisplayValueSummary {
    const type = argument.type.trim().toLowerCase();
    const value = argument.value;

    if (type === "address" && ethers.isAddress(value)) {
        return {primary: shortAddress(ethers.getAddress(value)), secondary: value};
    }
    if (/^u?int\d*$/.test(type)) {
        try {
            return {primary: BigInt(value).toLocaleString("en-US"), secondary: value};
        } catch {
            return {primary: value};
        }
    }
    if (type === "bool") {
        return {primary: value === "true" ? "True" : value === "false" ? "False" : value};
    }
    if (type.startsWith("bytes") && ethers.isHexString(value)) {
        try {
            const bytes = ethers.dataLength(value);
            const primary = value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
            return {primary, secondary: `${bytes} ${bytes === 1 ? "byte" : "bytes"}`};
        } catch {
            return {primary: value};
        }
    }
    if (type.includes("[") || type === "tuple" || type.startsWith("tuple(")) {
        const length = collectionLength(value);
        const tuple = type === "tuple" || type.startsWith("tuple(");
        if (length !== null) {
            return {primary: `${length} ${tuple ? (length === 1 ? "field" : "fields") : (length === 1 ? "item" : "items")}`, secondary: value};
        }
    }
    if (value.length > 84) {
        return {primary: `${value.slice(0, 64)}…`, secondary: value};
    }
    return {primary: value || "Empty"};
}

export function summarizeNativeValue(value: string): DisplayValueSummary {
    try {
        const wei = BigInt(value);
        return wei === BigInt(0)
            ? {primary: "0 ETH", secondary: "0 wei"}
            : {primary: `${ethers.formatEther(wei)} ETH`, secondary: `${wei.toLocaleString("en-US")} wei`};
    } catch {
        return {primary: value, secondary: "Invalid native value"};
    }
}
