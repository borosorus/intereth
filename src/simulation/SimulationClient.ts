import { ethers } from "ethers";
import { isHexData, isHexQuantity, isRecord } from "../transaction-plan/rpcValidation";
import { PlanContext, QueuedCall } from "../transaction-plan/types";
import {
    QueuedStateSimulationClient,
    SimulatedCallsResult,
    SimulatedRead,
    SimulatedReadResult,
    SimulationRpcTransport,
} from "./types";

type SimulationErrorCode =
    | "SIMULATION_NOT_CONFIGURED"
    | "SIMULATION_UNSUPPORTED"
    | "SIMULATION_RPC_UNAVAILABLE"
    | "SIMULATION_CHAIN_MISMATCH"
    | "SIMULATION_RESPONSE_INVALID"
    | "SIMULATION_QUEUED_CALL_REVERTED"
    | "SIMULATION_READ_REVERTED";

function simulationError(code: SimulationErrorCode, message: string) {
    return Object.assign(new Error(message), {code});
}

function normalizeRpcUrl(rpcUrl: string) {
    try {
        const url = new URL(rpcUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("Unsupported protocol");
        }
        return url.toString();
    } catch {
        throw simulationError("SIMULATION_NOT_CONFIGURED", "No valid simulation RPC is configured for this chain.");
    }
}

export class HttpJsonRpcTransport implements SimulationRpcTransport {
    private nextId = 1;
    private readonly rpcUrl: string;

    constructor(rpcUrl: string) {
        this.rpcUrl = normalizeRpcUrl(rpcUrl);
    }

    async send(method: string, params: unknown[]): Promise<unknown> {
        const id = this.nextId++;
        try {
            const response = await fetch(this.rpcUrl, {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify({jsonrpc: "2.0", id, method, params}),
            });
            if (!response.ok) {
                throw simulationError("SIMULATION_RPC_UNAVAILABLE", `The simulation RPC returned HTTP ${response.status}.`);
            }

            const payload: unknown = await response.json();
            if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== id) {
                throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned an invalid JSON-RPC response.");
            }
            if (isRecord(payload.error)) {
                const rpcCode = payload.error.code;
                const message = typeof payload.error.message === "string" ? payload.error.message : "The simulation RPC rejected the request.";
                if (rpcCode === -32601 || rpcCode === "-32601") {
                    throw simulationError("SIMULATION_UNSUPPORTED", message);
                }
                throw simulationError("SIMULATION_RPC_UNAVAILABLE", message);
            }
            if (!("result" in payload)) {
                throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC response did not contain a result.");
            }
            return payload.result;
        } catch (error) {
            if (isRecord(error) && typeof error.code === "string" && error.code.startsWith("SIMULATION_")) {
                throw error;
            }
            throw simulationError("SIMULATION_RPC_UNAVAILABLE", "The simulation RPC could not complete the request.");
        }
    }
}

function decimalChainId(value: unknown) {
    if (!isHexQuantity(value)) {
        throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned an invalid chain ID.");
    }
    return ethers.getBigInt(value).toString();
}

function validatedAddress(value: string) {
    try {
        return ethers.getAddress(value);
    } catch {
        throw Object.assign(new Error("Simulation calls require valid EVM addresses."), {code: "INVALID_ARGUMENT"});
    }
}

function normalizedData(value: string) {
    if (!isHexData(value)) {
        throw Object.assign(new Error("Simulation calldata must be valid hexadecimal data."), {code: "INVALID_ARGUMENT"});
    }
    return ethers.hexlify(ethers.getBytes(value));
}

function quantity(value: string) {
    try {
        return ethers.toQuantity(BigInt(value));
    } catch {
        throw Object.assign(new Error("Simulation values must be non-negative decimal integers."), {code: "INVALID_ARGUMENT"});
    }
}

interface ParsedCallResult {
    status: "0x0" | "0x1";
    returnData: string;
    gasUsed: string;
    maxUsedGas?: string;
}

function parseCallResult(value: unknown): ParsedCallResult | null {
    if (!isRecord(value)
        || (value.status !== "0x0" && value.status !== "0x1")
        || !isHexData(value.returnData)
        || !isHexQuantity(value.gasUsed)
        || (value.maxUsedGas !== undefined && !isHexQuantity(value.maxUsedGas))) {
        return null;
    }
    return {
        status: value.status,
        returnData: value.returnData,
        gasUsed: value.gasUsed,
        ...(value.maxUsedGas === undefined ? {} : {maxUsedGas: value.maxUsedGas}),
    };
}

function parseSimulationResponse(value: unknown, expectedCallCount: number) {
    if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
        throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned an unexpected block result.");
    }
    const block = value[0];
    const blockCalls = block.calls;
    if (!Array.isArray(blockCalls)) {
        throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned an unexpected block result.");
    }
    if (blockCalls.length !== expectedCallCount) {
        throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned an unexpected number of call results.");
    }
    const calls = blockCalls.map(parseCallResult);
    if (calls.some((call) => call === null)) {
        throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned malformed call results.");
    }
    if (block.number !== undefined && !isHexQuantity(block.number)) {
        throw simulationError("SIMULATION_RESPONSE_INVALID", "The simulation RPC returned an invalid simulated block number.");
    }
    return {calls: calls as ParsedCallResult[], blockNumber: block.number as string | undefined};
}

function rpcCall(from: string, to: string, input: string, value: string) {
    return {
        from: validatedAddress(from),
        to: validatedAddress(to),
        input: normalizedData(input),
        value: quantity(value),
    };
}

export class SimulationClient implements QueuedStateSimulationClient {
    constructor(private readonly transport: SimulationRpcTransport) {}

    async assertChain(expectedChainId: string) {
        if (!/^\d+$/.test(expectedChainId)) {
            throw Object.assign(new Error("The expected chain ID must be a decimal integer."), {code: "INVALID_ARGUMENT"});
        }
        const actualChainId = decimalChainId(await this.transport.send("eth_chainId", []));
        if (actualChainId !== expectedChainId) {
            throw simulationError(
                "SIMULATION_CHAIN_MISMATCH",
                `The configured simulation RPC is on chain ${actualChainId}, not chain ${expectedChainId}.`,
            );
        }
    }

    async simulateCalls(context: PlanContext, calls: QueuedCall[]): Promise<SimulatedCallsResult> {
        if (calls.length === 0) {
            throw Object.assign(new Error("Simulation requires at least one call."), {code: "INVALID_ARGUMENT"});
        }
        if (calls.some((call) => call.chainId !== context.chainId || call.from.toLowerCase() !== context.account.toLowerCase())) {
            throw Object.assign(new Error("Every simulated call must match the transaction plan."), {code: "PLAN_CONTEXT_MISMATCH"});
        }

        const requestCalls = calls.map((call) => rpcCall(call.from, call.to, call.data, call.value));
        const response = await this.transport.send("eth_simulateV1", [{
            blockStateCalls: [{calls: requestCalls}],
            validation: false,
            traceTransfers: false,
        }, "latest"]);
        return parseSimulationResponse(response, requestCalls.length);
    }

    async simulateRead(context: PlanContext, calls: QueuedCall[], read: SimulatedRead): Promise<SimulatedReadResult> {
        if (calls.length === 0) {
            throw Object.assign(new Error("Queued-state simulation requires at least one queued call."), {code: "INVALID_ARGUMENT"});
        }
        if (calls.some((call) => call.chainId !== context.chainId || call.from.toLowerCase() !== context.account.toLowerCase())) {
            throw Object.assign(new Error("Every simulated call must match the transaction plan."), {code: "PLAN_CONTEXT_MISMATCH"});
        }

        const requestCalls = calls.map((call) => rpcCall(call.from, call.to, call.data, call.value));
        requestCalls.push(rpcCall(context.account, read.to, read.data, read.value ?? "0"));
        const response = await this.transport.send("eth_simulateV1", [{
            blockStateCalls: [{calls: requestCalls}],
            validation: false,
            traceTransfers: false,
        }, "latest"]);
        const parsed = parseSimulationResponse(response, requestCalls.length);

        const revertedIndex = parsed.calls.slice(0, calls.length).findIndex((call) => call.status === "0x0");
        if (revertedIndex !== -1) {
            throw Object.assign(
                simulationError("SIMULATION_QUEUED_CALL_REVERTED", `Queued call ${revertedIndex + 1} reverted during simulation.`),
                {callId: calls[revertedIndex].id, callIndex: revertedIndex},
            );
        }
        const readResult = parsed.calls[calls.length];
        if (readResult.status === "0x0") {
            throw simulationError("SIMULATION_READ_REVERTED", "The read call reverted after applying the queued calls.");
        }
        return {
            returnData: readResult.returnData,
            gasUsed: readResult.gasUsed,
            maxUsedGas: readResult.maxUsedGas,
            blockNumber: parsed.blockNumber,
        };
    }
}
