import Safe from "@safe-global/protocol-kit";
import { ethers } from "ethers";
import { ExecutableCall } from "../calls/executable";

export interface SafeTransactionDraft {
    protocolKit: Safe;
    provider: ethers.BrowserProvider;
    transaction: Awaited<ReturnType<Safe["createTransaction"]>>;
    safeTxHash: string;
    nonce: number;
    blockNumber: number;
    owners: string[];
    threshold: number;
}

export interface SafeExecutionReceipt {
    transactionHash: string;
    blockNumber: number;
    gasUsed: string;
    success: boolean;
}

const SAFE_EVENTS = new ethers.Interface([
    "event ExecutionSuccess(bytes32 txHash, uint256 payment)",
    "event ExecutionFailure(bytes32 txHash, uint256 payment)",
]);
const SAFE_INDEXED_EVENTS = new ethers.Interface([
    "event ExecutionSuccess(bytes32 indexed txHash, uint256 payment)",
    "event ExecutionFailure(bytes32 indexed txHash, uint256 payment)",
]);

function parseSafeExecutionLog(log: ethers.Log) {
    return (log.topics.length > 1 ? SAFE_INDEXED_EVENTS : SAFE_EVENTS).parseLog(log);
}

export async function createSafeTransaction(
    eip1193Provider: unknown,
    ownerAddress: string,
    safeAddress: string,
    call: ExecutableCall | readonly ExecutableCall[],
    nonce?: number,
): Promise<SafeTransactionDraft> {
    const browserProvider = new ethers.BrowserProvider(eip1193Provider as never);
    const blockNumber = await browserProvider.getBlockNumber();
    const protocolKit = await Safe.init({
        provider: eip1193Provider as never,
        signer: ethers.getAddress(ownerAddress),
        safeAddress: ethers.getAddress(safeAddress),
    });
    const [owners, threshold] = await Promise.all([protocolKit.getOwners(), protocolKit.getThreshold()]);
    if (!owners.some((owner) => owner.toLowerCase() === ownerAddress.toLowerCase())) {
        throw Object.assign(new Error("The connected wallet is not an owner of this Safe."), {code: "SAFE_OWNER_REQUIRED"});
    }
    if (nonce !== undefined && await protocolKit.getNonce() !== nonce) {
        throw Object.assign(new Error("The Safe nonce changed while this transaction was awaiting approvals."), {code: "SAFE_NONCE_STALE"});
    }
    const calls = Array.isArray(call) ? call : [call];
    if (calls.length === 0) throw Object.assign(new Error("A Safe transaction must contain at least one call."), {code: "INVALID_ARGUMENT"});
    const transaction = await protocolKit.createTransaction({
        transactions: calls.map((item) => ({
            to: ethers.getAddress(item.to),
            value: BigInt(item.value).toString(),
            data: ethers.hexlify(ethers.getBytes(item.data)),
        })),
        onlyCalls: true,
        ...(nonce === undefined ? {} : {options: {nonce}}),
    });
    const safeTxHash = await protocolKit.getTransactionHash(transaction);
    return {protocolKit, provider: browserProvider, transaction, safeTxHash, nonce: transaction.data.nonce, blockNumber, owners, threshold};
}

export async function waitForSafeOwnerAction(response: {hash: string}, provider: ethers.BrowserProvider) {
    const receipt = await provider.waitForTransaction(response.hash, 1, 60_000);
    if (!receipt) return {hash: response.hash, receipt: null};
    return {hash: response.hash, receipt};
}

export async function executeSafeTransaction(draft: SafeTransactionDraft, onSubmitted?: (transactionHash: string) => void): Promise<SafeExecutionReceipt> {
    const result = await draft.protocolKit.executeTransaction(draft.transaction);
    onSubmitted?.(result.hash);
    const receipt = await draft.provider.waitForTransaction(result.hash, 1, 60_000);
    if (!receipt) {
        throw Object.assign(new Error("The Safe execution transaction is still pending."), {code: "TIMEOUT", transactionHash: result.hash});
    }
    const safeExecutionSuccess = await safeReceiptSuccess(receipt, await draft.protocolKit.getAddress());
    return {
        transactionHash: result.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        success: safeExecutionSuccess,
    };
}

export function safeReceiptSuccess(receipt: ethers.TransactionReceipt, safeAddress: string) {
    let success = receipt.status === 1;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== safeAddress.toLowerCase()) continue;
        try {
            const parsed = parseSafeExecutionLog(log);
            if (parsed?.name === "ExecutionFailure") success = false;
            if (parsed?.name === "ExecutionSuccess") success = receipt.status === 1;
        } catch {
            // Ignore Safe logs unrelated to the execution result.
        }
    }
    return success;
}

export async function reconcileSafeExecutionResult(draft: SafeTransactionDraft, result: SafeExecutionReceipt, fromBlock = draft.blockNumber): Promise<SafeExecutionReceipt> {
    if (result.success) return result;
    const executed = await findSafeExecutionReceipt(draft.provider, await draft.protocolKit.getAddress(), draft.safeTxHash, fromBlock);
    if (!executed) return result;
    return {
        transactionHash: executed.receipt.hash,
        blockNumber: executed.receipt.blockNumber,
        gasUsed: executed.receipt.gasUsed.toString(),
        success: executed.success,
    };
}

export async function findSafeExecutionReceipt(provider: ethers.BrowserProvider, safeAddress: string, safeTxHash: string, fromBlock = 0) {
    const successTopic = SAFE_EVENTS.getEvent("ExecutionSuccess")!.topicHash;
    const failureTopic = SAFE_EVENTS.getEvent("ExecutionFailure")!.topicHash;
    const latestBlock = await provider.getBlockNumber();
    const normalizedSafeTxHash = safeTxHash.toLowerCase();
    // Safe's txHash is event data, not an indexed topic. Scan bounded ranges
    // newest-first so public RPCs with log range limits can still reconcile it.
    for (let toBlock = latestBlock; toBlock >= fromBlock; toBlock -= 2_000) {
        const rangeStart = Math.max(fromBlock, toBlock - 1_999);
        const logs = await provider.getLogs({
            address: ethers.getAddress(safeAddress),
            topics: [[successTopic, failureTopic]],
            fromBlock: rangeStart,
            toBlock,
        });
        for (const log of logs) {
            try {
                const parsed = parseSafeExecutionLog(log);
                if (!parsed || String(parsed.args.txHash).toLowerCase() !== normalizedSafeTxHash) continue;
                const receipt = await provider.getTransactionReceipt(log.transactionHash);
                if (!receipt) return null;
                return {receipt, success: safeReceiptSuccess(receipt, safeAddress)};
            } catch {
                // Ignore malformed or unrelated Safe event logs.
            }
        }
    }
    return null;
}
