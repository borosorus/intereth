import { HttpJsonRpcTransport, SimulationClient } from "./SimulationClient";
import { SimulationRpcTransport } from "./types";
import { PlanContext, QueuedCall } from "../transaction-plan/types";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const READ_TARGET = "0x0000000000000000000000000000000000000020";
const context: PlanContext = {account: ACCOUNT, chainId: "1"};
const queuedCall: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: ACCOUNT,
    to: TARGET,
    data: "0x1234",
    value: "100",
    decoderAbi: [],
    display: {kind: "raw", contractAddress: TARGET},
    editor: {kind: "raw"},
    createdAt: 1,
};

function clientWith(response: unknown) {
    const send = jest.fn().mockResolvedValue(response);
    return {client: new SimulationClient({send} as SimulationRpcTransport), send};
}

function callResult(status: "0x0" | "0x1", returnData = "0x", gasUsed = "0x5208", maxUsedGas?: string) {
    return {status, returnData, gasUsed, logs: [], ...(maxUsedGas ? {maxUsedGas} : {})};
}

describe("SimulationClient", () => {
    it("validates the endpoint chain", async () => {
        const {client, send} = clientWith("0x1");
        await expect(client.assertChain("1")).resolves.toBeUndefined();
        expect(send).toHaveBeenCalledWith("eth_chainId", []);

        await expect(clientWith("0xa").client.assertChain("1")).rejects.toMatchObject({code: "SIMULATION_CHAIN_MISMATCH"});
        await expect(clientWith("mainnet").client.assertChain("1")).rejects.toMatchObject({code: "SIMULATION_RESPONSE_INVALID"});
    });

    it("captures a validated base block", async () => {
        const {client, send} = clientWith("0x64");
        await expect(client.getBlockNumber()).resolves.toBe("0x64");
        expect(send).toHaveBeenCalledWith("eth_blockNumber", []);
        await expect(clientWith("100").client.getBlockNumber()).rejects.toMatchObject({code: "SIMULATION_RESPONSE_INVALID"});
    });

    it("runs canonical watch reads at the exact simulation base block", async () => {
        const {client, send} = clientWith("0x002a");
        await expect(client.readAtBlock(context, {to: READ_TARGET, data: "0xabcd"}, "0x64")).resolves.toBe("0x002a");
        expect(send).toHaveBeenCalledWith("eth_call", [{
            from: ACCOUNT,
            to: READ_TARGET,
            data: "0xabcd",
            value: "0x0",
        }, "0x64"]);
        await expect(clientWith("42").client.readAtBlock(context, {to: READ_TARGET, data: "0x"}, "0x64"))
            .rejects.toMatchObject({code: "SIMULATION_RESPONSE_INVALID"});
    });

    it("simulates queued calls and the temporary read in one ordered block", async () => {
        const {client, send} = clientWith([{
            number: "0x65",
            calls: [callResult("0x1"), callResult("0x1", "0x002a", "0x42")],
        }]);

        await expect(client.simulateRead(context, [queuedCall], {
            to: READ_TARGET,
            data: "0xabcd",
        })).resolves.toEqual({returnData: "0x002a", gasUsed: "0x42", blockNumber: "0x65"});

        expect(send).toHaveBeenCalledWith("eth_simulateV1", [{
            blockStateCalls: [{calls: [
                {from: ACCOUNT, to: TARGET, input: "0x1234", value: "0x64"},
                {from: ACCOUNT, to: READ_TARGET, input: "0xabcd", value: "0x0"},
            ]}],
            validation: false,
            traceTransfers: true,
        }, "latest"]);
    });

    it("simulates a generic ordered call sequence and retains per-call gas", async () => {
        const second = {...queuedCall, id: "call-2", to: READ_TARGET, data: "0xabcd"};
        const {client, send} = clientWith([{
            number: "0x65",
            calls: [callResult("0x1", "0x", "0x40"), callResult("0x1", "0x01", "0x42", "0x50")],
        }]);

        await expect(client.simulateCalls(context, [queuedCall, second], "0x64")).resolves.toMatchObject({
            calls: [
                {status: "0x1", returnData: "0x", gasUsed: "0x40", logs: []},
                {status: "0x1", returnData: "0x01", gasUsed: "0x42", maxUsedGas: "0x50", logs: []},
            ],
            blockNumber: "0x65",
        });
        expect(send).toHaveBeenCalledWith("eth_simulateV1", [expect.objectContaining({
            blockStateCalls: [{calls: expect.any(Array)}],
            traceTransfers: true,
        }), "0x64"]);
    });

    it("retains validated logs, revert errors, and raw response data", async () => {
        const log = {address: TARGET, data: "0x", topics: [`0x${"11".repeat(32)}`]};
        const rawCall = {...callResult("0x0", "0xdead"), logs: [log], error: {code: 3, message: "execution reverted", data: "0xdead"}};
        const response = [{number: "0x65", calls: [rawCall]}];
        const {client} = clientWith(response);

        await expect(client.simulateCalls(context, [queuedCall])).resolves.toMatchObject({
            calls: [{
                status: "0x0",
                logs: [{address: TARGET, data: "0x", topics: log.topics}],
                error: {code: 3, message: "execution reverted", data: "0xdead"},
                raw: rawCall,
            }],
            raw: response,
        });
    });

    it("identifies the first reverted queued call", async () => {
        const second = {...queuedCall, id: "call-2"};
        const {client} = clientWith([{
            calls: [callResult("0x1"), callResult("0x0", "0xdead"), callResult("0x1", "0x01")],
        }]);
        await expect(client.simulateRead(context, [queuedCall, second], {to: READ_TARGET, data: "0x"}))
            .rejects.toMatchObject({code: "SIMULATION_QUEUED_CALL_REVERTED", callId: "call-2", callIndex: 1});
    });

    it("distinguishes a reverted read", async () => {
        const {client} = clientWith([{
            calls: [callResult("0x1"), callResult("0x0", "0xdead")],
        }]);
        await expect(client.simulateRead(context, [queuedCall], {to: READ_TARGET, data: "0x"}))
            .rejects.toMatchObject({code: "SIMULATION_READ_REVERTED"});
    });

    it.each([
        ["not an array", {}],
        ["multiple blocks", [{calls: []}, {calls: []}]],
        ["wrong call count", [{calls: [callResult("0x1")]}]],
        ["bad call status", [{calls: [callResult("0x1"), {...callResult("0x1"), status: "0x2"}]}]],
        ["bad return data", [{calls: [callResult("0x1"), callResult("0x1", "0x1")]}]],
        ["bad gas quantity", [{calls: [callResult("0x1"), callResult("0x1", "0x", "12")]}]],
        ["bad maximum gas quantity", [{calls: [callResult("0x1"), callResult("0x1", "0x", "0x12", "12")]}]],
        ["bad block number", [{number: "12", calls: [callResult("0x1"), callResult("0x1")]}]],
        ["bad log", [{calls: [callResult("0x1"), {...callResult("0x1"), logs: [{address: "bad", data: "0x", topics: []}]}]}]],
        ["bad call error", [{calls: [callResult("0x1"), {...callResult("0x0"), error: {message: 3}}]}]],
    ])("rejects %s responses", async (_name, response) => {
        const {client} = clientWith(response);
        await expect(client.simulateRead(context, [queuedCall], {to: READ_TARGET, data: "0x"}))
            .rejects.toMatchObject({code: "SIMULATION_RESPONSE_INVALID"});
    });

    it("rejects empty and context-mismatched plans before making an RPC request", async () => {
        const {client, send} = clientWith([]);
        await expect(client.simulateRead(context, [], {to: READ_TARGET, data: "0x"})).rejects.toMatchObject({code: "INVALID_ARGUMENT"});
        await expect(client.simulateRead(context, [{...queuedCall, chainId: "10"}], {to: READ_TARGET, data: "0x"}))
            .rejects.toMatchObject({code: "PLAN_CONTEXT_MISMATCH"});
        await expect(client.simulateCalls(context, [])).rejects.toMatchObject({code: "INVALID_ARGUMENT"});
        await expect(client.simulateCalls(context, [{...queuedCall, from: READ_TARGET}]))
            .rejects.toMatchObject({code: "PLAN_CONTEXT_MISMATCH"});
        expect(send).not.toHaveBeenCalled();
    });
});

describe("HttpJsonRpcTransport", () => {
    afterEach(() => jest.restoreAllMocks());

    it("returns valid JSON-RPC results", async () => {
        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            json: async () => ({jsonrpc: "2.0", id: 1, result: "0x1"}),
        } as Response);
        await expect(new HttpJsonRpcTransport("https://simulate.example").send("eth_chainId", []))
            .resolves.toBe("0x1");
    });

    it("normalizes unsupported, failed, and malformed responses", async () => {
        jest.spyOn(global, "fetch")
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({jsonrpc: "2.0", id: 1, error: {code: -32601, message: "Method not found"}}),
            } as Response)
            .mockResolvedValueOnce({ok: false, status: 429} as Response)
            .mockResolvedValueOnce({ok: true, json: async () => ({jsonrpc: "2.0", id: 99, result: []})} as Response);

        await expect(new HttpJsonRpcTransport("https://simulate.example").send("eth_simulateV1", []))
            .rejects.toMatchObject({code: "SIMULATION_UNSUPPORTED"});
        await expect(new HttpJsonRpcTransport("https://simulate.example").send("eth_simulateV1", []))
            .rejects.toMatchObject({code: "SIMULATION_RPC_UNAVAILABLE"});
        await expect(new HttpJsonRpcTransport("https://simulate.example").send("eth_simulateV1", []))
            .rejects.toMatchObject({code: "SIMULATION_RESPONSE_INVALID"});
    });

    it("rejects missing and non-http endpoint configuration", () => {
        expect(() => new HttpJsonRpcTransport("")).toThrow("No valid simulation RPC");
        expect(() => new HttpJsonRpcTransport("ws://simulate.example")).toThrow("No valid simulation RPC");
    });
});
