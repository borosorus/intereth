import { ethers } from "ethers";
import { BatchLog, BatchReceipt } from "./types";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isHexData(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        ethers.dataLength(value);
        return true;
    } catch {
        return false;
    }
}

export function isHexQuantity(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        return ethers.toQuantity(ethers.getBigInt(value)).toLowerCase() === value.toLowerCase();
    } catch {
        return false;
    }
}

export function isHash(value: unknown): value is string {
    return isHexData(value) && ethers.dataLength(value) === 32;
}

export function parseBatchLog(value: unknown): BatchLog | null {
    if (!isRecord(value)
        || typeof value.address !== "string"
        || !ethers.isAddress(value.address)
        || !isHexData(value.data)
        || !Array.isArray(value.topics)
        || value.topics.length > 4
        || !value.topics.every(isHash)) {
        return null;
    }
    return {
        address: ethers.getAddress(value.address),
        data: value.data,
        topics: value.topics,
    };
}

export function parseBatchReceipt(value: unknown): BatchReceipt | null {
    if (!isRecord(value)
        || !Array.isArray(value.logs)
        || (value.status !== "0x0" && value.status !== "0x1")
        || !isHash(value.blockHash)
        || !isHexQuantity(value.blockNumber)
        || !isHexQuantity(value.gasUsed)
        || !isHash(value.transactionHash)) {
        return null;
    }
    const logs = value.logs.map(parseBatchLog);
    if (logs.some((log) => log === null)) {
        return null;
    }
    return {
        logs: logs as BatchLog[],
        status: value.status,
        blockHash: value.blockHash,
        blockNumber: value.blockNumber,
        gasUsed: value.gasUsed,
        transactionHash: value.transactionHash,
    };
}
