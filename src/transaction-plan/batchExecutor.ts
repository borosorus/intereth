import { ethers } from "ethers";
import {
    BatchExecutionError,
    BatchExecutionState,
    BatchLog,
    BatchReceipt,
    PlanContext,
    QueuedCall,
} from "./types";

export interface WalletRpcTransport {
    send(method: string, params: unknown[]): Promise<unknown>;
}

export type AtomicCapabilityStatus = "supported" | "ready" | "unsupported" | "unavailable" | "error";

export interface AtomicCapabilityProbe {
    status: AtomicCapabilityStatus;
    error?: BatchExecutionError;
}

export interface AtomicBatchExecutor {
    getCapability(context: PlanContext): Promise<AtomicCapabilityProbe>;
    submit(context: PlanContext, calls: QueuedCall[]): Promise<{batchId: string}>;
    getStatus(batchId: string, expectedChainId: string): Promise<BatchExecutionState>;
    showStatus(batchId: string): Promise<void>;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asError(error: unknown, fallback: string): BatchExecutionError {
    if (isRecord(error)) {
        const infoError = isRecord(error.info) && isRecord(error.info.error) ? error.info.error : undefined;
        const nestedError = isRecord(error.error) ? error.error : infoError;
        const candidate = nestedError ?? error;
        const code = typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined;
        const message = typeof candidate.message === "string"
            ? candidate.message
            : typeof error.message === "string" ? error.message : fallback;
        return {code, message};
    }
    return {message: typeof error === "string" ? error : fallback};
}

function chainQuantity(chainId: string) {
    if (!/^\d+$/.test(chainId)) {
        throw Object.assign(new Error("Chain ID must be a decimal integer."), {code: "INVALID_ARGUMENT"});
    }
    return ethers.toQuantity(BigInt(chainId));
}

function normalizedHexKey(record: UnknownRecord, key: string) {
    const normalizedKey = key.toLowerCase();
    return Object.entries(record).find(([candidate]) => candidate.toLowerCase() === normalizedKey)?.[1];
}

function parseAtomicCapability(value: unknown): {status?: "supported" | "ready" | "unsupported"; invalid?: boolean} {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        return {invalid: true};
    }
    if (value.atomic === undefined) {
        return {};
    }
    const atomic = value.atomic;
    if (!isRecord(atomic)) {
        return {invalid: true};
    }
    return atomic.status === "supported" || atomic.status === "ready" || atomic.status === "unsupported"
        ? {status: atomic.status}
        : {invalid: true};
}

function validateBatchId(value: unknown): string {
    if (typeof value !== "string" || value === "0x" || value.length > 8194) {
        throw Object.assign(new Error("The wallet returned an invalid batch identifier."), {code: "INVALID_BATCH_RESPONSE"});
    }
    try {
        ethers.dataLength(value);
    } catch {
        throw Object.assign(new Error("The wallet returned an invalid batch identifier."), {code: "INVALID_BATCH_RESPONSE"});
    }
    return value;
}

function isHexData(value: unknown): value is string {
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

function isHexQuantity(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        return ethers.toQuantity(ethers.getBigInt(value)).toLowerCase() === value.toLowerCase();
    } catch {
        return false;
    }
}

function isHash(value: unknown): value is string {
    return isHexData(value) && ethers.dataLength(value) === 32;
}

function parseLog(value: unknown): BatchLog | null {
    if (!isRecord(value)
        || typeof value.address !== "string"
        || !ethers.isAddress(value.address)
        || !isHexData(value.data)
        || !Array.isArray(value.topics)
        || !value.topics.every(isHexData)) {
        return null;
    }
    return {
        address: ethers.getAddress(value.address),
        data: value.data,
        topics: value.topics,
    };
}

function parseReceipt(value: unknown): BatchReceipt | null {
    if (!isRecord(value)
        || !Array.isArray(value.logs)
        || (value.status !== "0x0" && value.status !== "0x1")
        || !isHash(value.blockHash)
        || !isHexQuantity(value.blockNumber)
        || !isHexQuantity(value.gasUsed)
        || !isHash(value.transactionHash)) {
        return null;
    }
    const logs = value.logs.map(parseLog);
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

function invalidStatus(batchId: string, message: string, walletStatus?: number): BatchExecutionState {
    return {
        status: "invalid",
        batchId,
        walletStatus,
        error: {code: "INVALID_BATCH_RESPONSE", message},
    };
}

export class Eip5792BatchExecutor implements AtomicBatchExecutor {
    constructor(private readonly transport: WalletRpcTransport) {}

    async getCapability(context: PlanContext): Promise<AtomicCapabilityProbe> {
        const chainId = chainQuantity(context.chainId);
        try {
            const response = await this.transport.send("wallet_getCapabilities", [
                ethers.getAddress(context.account),
                [chainId],
            ]);
            if (!isRecord(response)) {
                return {status: "error", error: {code: "INVALID_CAPABILITY_RESPONSE", message: "The wallet returned invalid capability data."}};
            }
            const chainCapabilities = normalizedHexKey(response, chainId);
            const globalCapabilities = normalizedHexKey(response, "0x0");
            const chainCapability = parseAtomicCapability(chainCapabilities);
            const globalCapability = parseAtomicCapability(globalCapabilities);
            if (chainCapability.invalid || (!chainCapability.status && globalCapability.invalid)) {
                return {status: "error", error: {code: "INVALID_CAPABILITY_RESPONSE", message: "The wallet returned invalid atomic capability data."}};
            }
            return {status: chainCapability.status ?? globalCapability.status ?? "unavailable"};
        } catch (error) {
            const normalized = asError(error, "The wallet could not report its batching capabilities.");
            return normalized.code === -32601 || normalized.code === "-32601"
                ? {status: "unavailable"}
                : {status: "error", error: normalized};
        }
    }

    async submit(context: PlanContext, calls: QueuedCall[]) {
        if (calls.length === 0) {
            throw Object.assign(new Error("An empty transaction plan cannot be submitted."), {code: "INVALID_ARGUMENT"});
        }
        if (calls.some((call) => call.chainId !== context.chainId || call.from.toLowerCase() !== context.account.toLowerCase())) {
            throw Object.assign(new Error("Every call must match the plan account and chain."), {code: "PLAN_CONTEXT_MISMATCH"});
        }

        const response = await this.transport.send("wallet_sendCalls", [{
            version: "2.0.0",
            from: ethers.getAddress(context.account),
            chainId: chainQuantity(context.chainId),
            atomicRequired: true,
            calls: calls.map((call) => ({
                to: ethers.getAddress(call.to),
                data: ethers.hexlify(ethers.getBytes(call.data)),
                value: ethers.toQuantity(BigInt(call.value)),
            })),
        }]);
        if (!isRecord(response)) {
            throw Object.assign(new Error("The wallet returned an invalid batch submission response."), {code: "INVALID_BATCH_RESPONSE"});
        }
        return {batchId: validateBatchId(response.id)};
    }

    async getStatus(batchId: string, expectedChainId: string): Promise<BatchExecutionState> {
        const validBatchId = validateBatchId(batchId);
        const response = await this.transport.send("wallet_getCallsStatus", [validBatchId]);
        if (!isRecord(response)) {
            return invalidStatus(validBatchId, "The wallet returned invalid batch status data.");
        }
        let responseChainId: string | null = null;
        try {
            responseChainId = typeof response.chainId === "string" ? chainQuantity(ethers.getBigInt(response.chainId).toString()) : null;
        } catch {
            responseChainId = null;
        }
        if (response.version !== "2.0.0"
            || response.id !== validBatchId
            || responseChainId !== chainQuantity(expectedChainId)
            || typeof response.status !== "number"
            || typeof response.atomic !== "boolean") {
            return invalidStatus(validBatchId, "The wallet returned batch status for an unexpected ID or chain.");
        }

        const walletStatus = response.status;
        if (!response.atomic) {
            return invalidStatus(validBatchId, "The wallet reported non-atomic execution for an atomic-required batch.", walletStatus);
        }

        let receipts: BatchReceipt[] | undefined;
        if (response.receipts !== undefined) {
            if (!Array.isArray(response.receipts)) {
                return invalidStatus(validBatchId, "The wallet returned malformed batch receipts.", walletStatus);
            }
            const parsedReceipts = response.receipts.map(parseReceipt);
            if (parsedReceipts.some((receipt) => receipt === null)) {
                return invalidStatus(validBatchId, "The wallet returned malformed batch receipts.", walletStatus);
            }
            receipts = parsedReceipts as BatchReceipt[];
        }

        const statusByCode: Partial<Record<number, BatchExecutionState["status"]>> = {
            100: "pending",
            200: "confirmed",
            400: "offchain_failed",
            500: "reverted",
            600: "partially_reverted",
        };
        const status = statusByCode[walletStatus];
        return status
            ? {status, batchId: validBatchId, walletStatus, atomic: true, receipts}
            : invalidStatus(validBatchId, `The wallet returned unknown batch status ${walletStatus}.`, walletStatus);
    }

    async showStatus(batchId: string) {
        await this.transport.send("wallet_showCallsStatus", [validateBatchId(batchId)]);
    }
}
