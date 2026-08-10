import { ethers } from "ethers";
import { CallResultData } from "../callUtils";
import { isHash } from "../transaction-plan/rpcValidation";
import { QueuedCall } from "../transaction-plan/types";

export type TransactionResultCallback = (result: Extract<CallResultData, {kind: "transaction"}>) => void;

function resultFromReceipt(hash: string, receipt: ethers.TransactionReceipt | null): Extract<CallResultData, {kind: "transaction"}> {
    return receipt ? {
        kind: "transaction",
        status: receipt.status === 1 ? "confirmed" : "failed",
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
    } : {kind: "transaction", status: "pending", hash};
}

export async function sendPreparedTransaction(
    signer: ethers.JsonRpcSigner,
    call: QueuedCall,
    onResult: TransactionResultCallback,
) {
    const response = await signer.sendTransaction({to: call.to, data: call.data, value: call.value});
    onResult({kind: "transaction", status: "submitted", hash: response.hash});
    const result = resultFromReceipt(response.hash, await response.wait(1, 60000));
    onResult(result);
    return result;
}

export async function forceSendPreparedTransaction(
    provider: ethers.BrowserProvider,
    call: QueuedCall,
    gasLimit: bigint,
    onResult: TransactionResultCallback,
) {
    const response = await provider.send("eth_sendTransaction", [{
        from: call.from,
        to: call.to,
        data: call.data,
        value: ethers.toQuantity(BigInt(call.value)),
        gas: ethers.toQuantity(gasLimit),
    }]);
    if (!isHash(response)) {
        throw Object.assign(new Error("The wallet returned an invalid transaction hash."), {code: "INVALID_WALLET_RESPONSE"});
    }
    onResult({kind: "transaction", status: "submitted", hash: response});
    const result = resultFromReceipt(response, await provider.waitForTransaction(response, 1, 60000));
    onResult(result);
    return result;
}
