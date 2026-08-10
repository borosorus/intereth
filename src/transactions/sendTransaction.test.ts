import { ethers } from "ethers";
import { QueuedCall } from "../transaction-plan/types";
import { forceSendPreparedTransaction, sendPreparedTransaction } from "./sendTransaction";

const HASH = `0x${"11".repeat(32)}`;
const call: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000010",
    data: "0x1234",
    value: "5",
    decoderAbi: [],
    display: {kind: "raw", contractAddress: "0x0000000000000000000000000000000000000010"},
    editor: {kind: "raw"},
    createdAt: 1,
};

function receipt() {
    return {status: 1, hash: HASH, blockNumber: 12, gasUsed: BigInt(21_000)} as ethers.TransactionReceipt;
}

describe("prepared transaction sending", () => {
    it("reports submission and confirmation for an ordinary signer transaction", async () => {
        const onResult = jest.fn();
        const wait = jest.fn().mockResolvedValue(receipt());
        const signer = {sendTransaction: jest.fn().mockResolvedValue({hash: HASH, wait})} as unknown as ethers.JsonRpcSigner;

        await expect(sendPreparedTransaction(signer, call, onResult)).resolves.toMatchObject({status: "confirmed", hash: HASH});
        expect(signer.sendTransaction).toHaveBeenCalledWith({to: call.to, data: call.data, value: "5"});
        expect(onResult.mock.calls.map(([result]) => result.status)).toEqual(["submitted", "confirmed"]);
    });

    it("force-sends the exact derived gas through the wallet without estimating", async () => {
        const onResult = jest.fn();
        const provider = {
            send: jest.fn().mockResolvedValue(HASH),
            waitForTransaction: jest.fn().mockResolvedValue(receipt()),
        } as unknown as ethers.BrowserProvider;

        await forceSendPreparedTransaction(provider, call, BigInt(120), onResult);
        expect(provider.send).toHaveBeenCalledWith("eth_sendTransaction", [{
            from: call.from,
            to: call.to,
            data: call.data,
            value: "0x5",
            gas: "0x78",
        }]);
        expect(onResult.mock.calls.map(([result]) => result.status)).toEqual(["submitted", "confirmed"]);
    });

    it("rejects malformed wallet transaction hashes before polling", async () => {
        const provider = {
            send: jest.fn().mockResolvedValue("0x1234"),
            waitForTransaction: jest.fn(),
        } as unknown as ethers.BrowserProvider;
        await expect(forceSendPreparedTransaction(provider, call, BigInt(120), jest.fn()))
            .rejects.toMatchObject({code: "INVALID_WALLET_RESPONSE"});
        expect(provider.waitForTransaction).not.toHaveBeenCalled();
    });
});
