import { Eip5792BatchExecutor, WalletRpcTransport } from "./batchExecutor";
import { PlanContext, QueuedCall } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const BATCH_ID = `0x${"11".repeat(32)}`;
const BLOCK_HASH = `0x${"22".repeat(32)}`;
const TX_HASH = `0x${"33".repeat(32)}`;
const context: PlanContext = {account: ACCOUNT, chainId: "1"};
const call: QueuedCall = {
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

function executorWith(response: unknown) {
    const send = jest.fn().mockResolvedValue(response);
    return {executor: new Eip5792BatchExecutor({send} as WalletRpcTransport), send};
}

function statusResponse(status: number, overrides: Record<string, unknown> = {}) {
    return {
        version: "2.0.0",
        id: BATCH_ID,
        chainId: "0x1",
        status,
        atomic: true,
        ...overrides,
    };
}

describe("Eip5792BatchExecutor capabilities", () => {
    it.each([
        ["supported", {"0x1": {atomic: {status: "supported"}}}, "supported"],
        ["ready", {"0x1": {atomic: {status: "ready"}}}, "ready"],
        ["unsupported", {"0x1": {atomic: {status: "unsupported"}}}, "unsupported"],
        ["global", {"0x0": {atomic: {status: "supported"}}}, "supported"],
        ["missing", {"0x1": {paymasterService: {supported: true}}}, "unavailable"],
    ])("normalizes %s capability responses", async (_name, response, expected) => {
        const {executor, send} = executorWith(response);
        await expect(executor.getCapability(context)).resolves.toEqual({status: expected});
        expect(send).toHaveBeenCalledWith("wallet_getCapabilities", [ACCOUNT, ["0x1"]]);
    });

    it("prefers the requested chain over global capability data", async () => {
        const {executor} = executorWith({
            "0x0": {atomic: {status: "supported"}},
            "0x1": {atomic: {status: "ready"}},
        });
        await expect(executor.getCapability(context)).resolves.toEqual({status: "ready"});
    });

    it("distinguishes unsupported methods from malformed and failed responses", async () => {
        const unavailable = new Eip5792BatchExecutor({
            send: jest.fn().mockRejectedValue({code: -32601, message: "Method not found"}),
        });
        await expect(unavailable.getCapability(context)).resolves.toEqual({status: "unavailable"});

        const wrappedUnavailable = new Eip5792BatchExecutor({
            send: jest.fn().mockRejectedValue({code: "UNKNOWN_ERROR", info: {error: {code: -32601, message: "Method not found"}}}),
        });
        await expect(wrappedUnavailable.getCapability(context)).resolves.toEqual({status: "unavailable"});

        const malformed = executorWith({"0x1": {atomic: {status: "sometimes"}}}).executor;
        await expect(malformed.getCapability(context)).resolves.toMatchObject({
            status: "error",
            error: {code: "INVALID_CAPABILITY_RESPONSE"},
        });

        const failed = new Eip5792BatchExecutor({
            send: jest.fn().mockRejectedValue({code: 4100, message: "Unauthorized"}),
        });
        await expect(failed.getCapability(context)).resolves.toEqual({
            status: "error",
            error: {code: 4100, message: "Unauthorized"},
        });
    });
});

describe("Eip5792BatchExecutor submission", () => {
    it("submits the reviewed calls in order with atomic execution required", async () => {
        const second = {...call, id: "call-2", data: "0xabcd", value: "0"};
        const {executor, send} = executorWith({id: BATCH_ID});

        await expect(executor.submit(context, [call, second])).resolves.toEqual({batchId: BATCH_ID});
        expect(send).toHaveBeenCalledWith("wallet_sendCalls", [{
            version: "2.0.0",
            from: ACCOUNT,
            chainId: "0x1",
            atomicRequired: true,
            calls: [
                {to: TARGET, data: "0x1234", value: "0x64"},
                {to: TARGET, data: "0xabcd", value: "0x0"},
            ],
        }]);
    });

    it("rejects empty, mismatched, and malformed submission results", async () => {
        const {executor} = executorWith({id: BATCH_ID});
        await expect(executor.submit(context, [])).rejects.toThrow("empty transaction plan");
        await expect(executor.submit(context, [{...call, chainId: "10"}])).rejects.toThrow("match the plan");

        const malformed = executorWith({id: "not-hex"}).executor;
        await expect(malformed.submit(context, [call])).rejects.toThrow("invalid batch identifier");
    });
});

describe("Eip5792BatchExecutor status", () => {
    it.each([
        [100, "pending"],
        [200, "confirmed"],
        [400, "offchain_failed"],
        [500, "reverted"],
        [600, "partially_reverted"],
    ])("maps wallet status %i to %s", async (walletStatus, status) => {
        const {executor, send} = executorWith(statusResponse(walletStatus));
        await expect(executor.getStatus(BATCH_ID, "1")).resolves.toMatchObject({
            status,
            batchId: BATCH_ID,
            walletStatus,
            atomic: true,
        });
        expect(send).toHaveBeenCalledWith("wallet_getCallsStatus", [BATCH_ID]);
    });

    it("normalizes valid receipts", async () => {
        const receipt = {
            logs: [{address: TARGET, data: "0x", topics: [BLOCK_HASH]}],
            status: "0x1",
            blockHash: BLOCK_HASH,
            blockNumber: "0xa",
            gasUsed: "0x5208",
            transactionHash: TX_HASH,
        };
        const {executor} = executorWith(statusResponse(200, {receipts: [receipt]}));
        await expect(executor.getStatus(BATCH_ID, "1")).resolves.toMatchObject({
            status: "confirmed",
            receipts: [receipt],
        });
    });

    it("does not accept a reverted receipt as a confirmed atomic batch", async () => {
        const receipt = {
            logs: [],
            status: "0x0",
            blockHash: BLOCK_HASH,
            blockNumber: "0xa",
            gasUsed: "0x5208",
            transactionHash: TX_HASH,
        };
        const {executor} = executorWith(statusResponse(200, {receipts: [receipt]}));
        await expect(executor.getStatus(BATCH_ID, "1")).resolves.toMatchObject({
            status: "invalid",
            error: {code: "INVALID_BATCH_RESPONSE"},
        });
    });

    it("rejects receipts that contradict pending, off-chain failure, or complete-revert status", async () => {
        const successfulReceipt = {
            logs: [],
            status: "0x1",
            blockHash: BLOCK_HASH,
            blockNumber: "0xa",
            gasUsed: "0x5208",
            transactionHash: TX_HASH,
        };
        for (const status of [100, 400, 500]) {
            const {executor} = executorWith(statusResponse(status, {receipts: [successfulReceipt]}));
            await expect(executor.getStatus(BATCH_ID, "1")).resolves.toMatchObject({
                status: "invalid",
                error: {code: "INVALID_BATCH_RESPONSE"},
            });
        }
    });

    it.each([
        ["non-atomic", statusResponse(200, {atomic: false})],
        ["wrong ID", statusResponse(200, {id: `0x${"44".repeat(32)}`})],
        ["wrong chain", statusResponse(200, {chainId: "0xa"})],
        ["unknown status", statusResponse(299)],
        ["malformed receipts", statusResponse(200, {receipts: [{status: "0x1"}]})],
        ["short log topic", statusResponse(200, {receipts: [{
            logs: [{address: TARGET, data: "0x", topics: ["0x12"]}],
            status: "0x1",
            blockHash: BLOCK_HASH,
            blockNumber: "0xa",
            gasUsed: "0x5208",
            transactionHash: TX_HASH,
        }]})],
    ])("marks %s status responses invalid", async (_name, response) => {
        const {executor} = executorWith(response);
        await expect(executor.getStatus(BATCH_ID, "1")).resolves.toMatchObject({
            status: "invalid",
            batchId: BATCH_ID,
            error: {code: "INVALID_BATCH_RESPONSE"},
        });
    });

    it("asks the wallet to show a submitted batch", async () => {
        const {executor, send} = executorWith(undefined);
        await executor.showStatus(BATCH_ID);
        expect(send).toHaveBeenCalledWith("wallet_showCallsStatus", [BATCH_ID]);
    });
});
