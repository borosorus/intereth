import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NormalizedError, normalizeError } from "../../callUtils";
import { useTransactionPlan } from "../../transaction-plan/context";
import { useTransactionPlanUi } from "../../transaction-plan/uiContext";
import { BatchExecutionError, QueuedCall, SequentialCallExecution } from "../../transaction-plan/types";
import { sendPreparedTransaction } from "../../transactions/sendTransaction";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import { createSafeTransaction, executeSafeTransaction, findSafeExecutionReceipt, reconcileSafeExecutionResult, safeReceiptSuccess, waitForSafeOwnerAction } from "../../wallet/safeTransactions";
import CopyButton from "../CopyButton";
import ErrorDialog from "../ErrorDialog";
import ExecutionReviewDialog, { ExecutionMechanism } from "./ExecutionReviewDialog";

function storedError(error: NormalizedError): BatchExecutionError {
    return {code: error.code, message: error.message};
}

export function sequentialCallLabel(call: QueuedCall) {
    return call.display.functionSignature ?? "Raw transaction";
}

function statusPresentation(record: SequentialCallExecution | undefined, ready: boolean) {
    if (!record) return ready ? {label: "Ready", color: "secondary" as const} : {label: "Waiting", color: "default" as const};
    if (record.status === "confirmed") return {label: "Confirmed", color: "success" as const};
    if (record.status === "failed") return {label: "Failed", color: "error" as const};
    if (record.status === "awaiting_approvals") return {label: "Safe approvals", color: "warning" as const};
    if (record.status === "pending") return {label: "Pending", color: "info" as const};
    return {label: "Awaiting wallet", color: "info" as const};
}

export default function SequentialExecution() {
    const {state, dispatch, sessionStatus} = useTransactionPlan();
    const wallet = useWalletSession();
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewMechanism, setReviewMechanism] = useState<ExecutionMechanism>("sequential");
    const [error, setError] = useState<NormalizedError | null>(null);
    const [safeResubmitAvailableFor, setSafeResubmitAvailableFor] = useState<string | null>(null);
    const lastSafeReconcileRef = useRef(new Map<string, number>());
    const {activeView} = useTransactionPlanUi();
    // Views stay mounted across switches, so an open submission review must
    // not linger (and remain actionable) over the Explore view.
    useEffect(() => {
        if (activeView !== "execution") setReviewOpen(false);
    }, [activeView]);
    const execution = state.sequentialExecution;
    const records = execution.calls;
    const confirmedCount = records.filter((record) => record.status === "confirmed").length;
    const currentRecord = records[records.length - 1];
    const nextCall = state.plan.calls[confirmedCount];
    const walletReady = sessionStatus === "ready" && (wallet.isSafeMode
        ? Boolean(wallet.safeAppSdk || (wallet.injectedProvider && wallet.account && wallet.safeOwnerConnected))
        : Boolean(wallet.signer && wallet.provider));
    const callById = useMemo(() => new Map(state.plan.calls.map((call) => [call.id, call])), [state.plan.calls]);

    const sendCall = useCallback(async (call: QueuedCall) => {
        if (sessionStatus !== "ready") return;
        if (wallet.isSafeMode && (wallet.safeAccount?.source === "manual"
            || (wallet.safeAccount?.source === "connected-account" && wallet.safeAccount.owners.some((owner) => owner.toLowerCase() === wallet.account?.toLowerCase())))
            && wallet.injectedProvider && wallet.account) {
            dispatch({type: "START_SEQUENTIAL_CALL", callId: call.id});
            setError(null);
            let submittedHash: string | undefined;
            try {
                const draft = await createSafeTransaction(wallet.injectedProvider, wallet.account, wallet.safeAccount.address, call);
                if (draft.threshold > 1) {
                    const currentApprovals = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
                    let approvalTransactionHash: string | undefined;
                    if (!currentApprovals.some((owner) => owner.toLowerCase() === wallet.account!.toLowerCase())) {
                        const approval = await draft.protocolKit.approveTransactionHash(draft.safeTxHash);
                        const waited = await waitForSafeOwnerAction(approval, draft.provider);
                        if (!waited.receipt || waited.receipt.status !== 1) throw new Error("The Safe owner approval transaction did not confirm successfully.");
                        approvalTransactionHash = waited.hash;
                    }
                    const approvedOwners = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
                    dispatch({
                        type: "SEQUENTIAL_SAFE_APPROVAL_RECORDED",
                        callId: call.id,
                        safeTxHash: draft.safeTxHash,
                        safeNonce: String(draft.nonce),
                        safeCreatedBlock: String(draft.blockNumber),
                        approvalTransactionHash,
                        approvedOwners: approvedOwners.length,
                        threshold: draft.threshold,
                        updatedAt: Date.now(),
                    });
                } else {
                    const result = await reconcileSafeExecutionResult(draft, await executeSafeTransaction(draft, (transactionHash) => {
                        submittedHash = transactionHash;
                        dispatch({type: "SEQUENTIAL_CALL_SUBMITTED", callId: call.id, transactionHash, safeTxHash: draft.safeTxHash, safeNonce: String(draft.nonce), safeCreatedBlock: String(draft.blockNumber), submittedAt: Date.now()});
                    }));
                    if (result.success) {
                        dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: call.id, transactionHash: result.transactionHash, blockNumber: String(result.blockNumber), gasUsed: result.gasUsed, updatedAt: Date.now()});
                    } else {
                        dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: call.id, transactionHash: result.transactionHash, blockNumber: String(result.blockNumber), gasUsed: result.gasUsed, error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe transaction was included but its inner call failed."}, updatedAt: Date.now()});
                    }
                }
            } catch (sendError) {
                const normalized = normalizeError(sendError, "Safe transaction failed");
                setError(normalized);
                if (!submittedHash) dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: call.id, error: storedError(normalized), updatedAt: Date.now()});
            }
            return;
        }
        if (wallet.isSafeMode && wallet.safeAccount?.source === "safe-app" && wallet.safeAppSdk) {
            dispatch({type: "START_SEQUENTIAL_CALL", callId: call.id});
            setError(null);
            try {
                const result = await wallet.safeAppSdk.txs.send({txs: [{to: call.to, value: call.value, data: call.data}]});
                dispatch({
                    type: "SEQUENTIAL_SAFE_APPROVAL_RECORDED",
                    callId: call.id,
                    safeTxHash: result.safeTxHash,
                    safeNonce: String(wallet.safeAccount.nonce),
                    approvedOwners: 0,
                    threshold: wallet.safeAccount.threshold,
                    updatedAt: Date.now(),
                });
            } catch (sendError) {
                const normalized = normalizeError(sendError, "Safe submission failed");
                setError(normalized);
                dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: call.id, error: storedError(normalized), updatedAt: Date.now()});
            }
            return;
        }
        if (!wallet.signer) return;
        dispatch({type: "START_SEQUENTIAL_CALL", callId: call.id});
        setError(null);
        let submittedHash: string | undefined;
        try {
            await sendPreparedTransaction(wallet.signer, call, (result) => {
                if (result.status === "submitted") {
                    submittedHash = result.hash;
                    dispatch({type: "SEQUENTIAL_CALL_SUBMITTED", callId: call.id, transactionHash: result.hash, submittedAt: Date.now()});
                } else if (result.status === "confirmed") {
                    if (result.blockNumber === undefined || result.gasUsed === undefined) return;
                    dispatch({
                        type: "SEQUENTIAL_CALL_CONFIRMED",
                        callId: call.id,
                        transactionHash: result.hash,
                        blockNumber: String(result.blockNumber),
                        gasUsed: result.gasUsed,
                        updatedAt: Date.now(),
                    });
                } else if (result.status === "failed") {
                    dispatch({
                        type: "SEQUENTIAL_CALL_FAILED",
                        callId: call.id,
                        transactionHash: result.hash,
                        blockNumber: result.blockNumber === undefined ? undefined : String(result.blockNumber),
                        gasUsed: result.gasUsed,
                        error: {code: "CALL_EXCEPTION", message: "The transaction was included but reverted."},
                        updatedAt: Date.now(),
                    });
                }
            });
        } catch (sendError) {
            const normalized = normalizeError(sendError, "Transaction failed");
            setError(normalized);
            if (!submittedHash) {
                dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: call.id, error: storedError(normalized), updatedAt: Date.now()});
            }
        }
    }, [dispatch, sessionStatus, wallet.account, wallet.injectedProvider, wallet.isSafeMode, wallet.safeAccount, wallet.safeAppSdk, wallet.signer]);

    const sendSafeBatch = useCallback(async (retry = false) => {
        const calls = state.plan.calls;
        const retryingBatch = retry && execution.status === "active" && currentRecord?.status === "failed" && currentRecord.safeBatch;
        if (!wallet.isSafeMode || calls.length < 2 || (execution.status !== "idle" && !retryingBatch) || sessionStatus !== "ready" || !calls[0]) return;
        if (wallet.safeAccount?.source !== "safe-app" && (!wallet.account || !wallet.injectedProvider || !wallet.safeOwnerConnected || !wallet.safeAccount?.owners.some((owner) => owner.toLowerCase() === wallet.account!.toLowerCase()))) return;
        if (!retryingBatch) dispatch({type: "START_SEQUENTIAL_EXECUTION", startedAt: Date.now()});
        dispatch({type: "START_SEQUENTIAL_CALL", callId: calls[0].id, safeBatch: true});
        setError(null);
        let submitted = false;
        const safeCalls = calls.map(({to, data, value}) => ({to, data, value}));
        try {
            if (wallet.safeAccount?.source === "safe-app" && wallet.safeAppSdk) {
                const result = await wallet.safeAppSdk.txs.send({txs: safeCalls});
                dispatch({
                    type: "SEQUENTIAL_SAFE_APPROVAL_RECORDED",
                    callId: calls[0].id,
                    safeTxHash: result.safeTxHash,
                    safeNonce: String(wallet.safeAccount.nonce),
                    approvedOwners: 0,
                    threshold: wallet.safeAccount.threshold,
                    safeBatch: true,
                    updatedAt: Date.now(),
                });
                return;
            }
            if (!wallet.injectedProvider || !wallet.account || !wallet.safeAccount) throw new Error("Connect a Safe owner wallet to submit this plan.");
            const draft = await createSafeTransaction(wallet.injectedProvider, wallet.account, wallet.safeAccount.address, safeCalls);
            if (draft.threshold > 1) {
                const approved = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
                let approvalTransactionHash: string | undefined;
                if (!approved.some((owner) => owner.toLowerCase() === wallet.account!.toLowerCase())) {
                    const approval = await draft.protocolKit.approveTransactionHash(draft.safeTxHash);
                    const waited = await waitForSafeOwnerAction(approval, draft.provider);
                    if (!waited.receipt || waited.receipt.status !== 1) throw new Error("The Safe owner approval did not confirm successfully.");
                    approvalTransactionHash = waited.hash;
                }
                const approvedOwners = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
                dispatch({
                    type: "SEQUENTIAL_SAFE_APPROVAL_RECORDED",
                    callId: calls[0].id,
                    safeTxHash: draft.safeTxHash,
                    safeNonce: String(draft.nonce),
                    safeCreatedBlock: String(draft.blockNumber),
                    approvalTransactionHash,
                    approvedOwners: approvedOwners.length,
                    threshold: draft.threshold,
                    safeBatch: true,
                    updatedAt: Date.now(),
                });
                return;
            }
            const result = await executeSafeTransaction(draft, (transactionHash) => {
                submitted = true;
                dispatch({type: "SEQUENTIAL_CALL_SUBMITTED", callId: calls[0].id, transactionHash, safeTxHash: draft.safeTxHash, safeNonce: String(draft.nonce), safeCreatedBlock: String(draft.blockNumber), safeBatch: true, submittedAt: Date.now()});
            });
            const reconciled = await reconcileSafeExecutionResult(draft, result, draft.blockNumber);
            if (reconciled.success) {
                dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: calls[0].id, transactionHash: reconciled.transactionHash, blockNumber: String(reconciled.blockNumber), gasUsed: reconciled.gasUsed, updatedAt: Date.now()});
            } else {
                dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: calls[0].id, transactionHash: reconciled.transactionHash, blockNumber: String(reconciled.blockNumber), gasUsed: reconciled.gasUsed, error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe multi-call transaction failed. The queued calls were reverted together."}, updatedAt: Date.now()});
            }
        } catch (batchError) {
            const normalized = normalizeError(batchError, "Safe multi-call submission failed");
            setError(normalized);
            if (!submitted) dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: calls[0].id, error: storedError(normalized), updatedAt: Date.now()});
        }
    }, [currentRecord, dispatch, execution.status, sessionStatus, state.plan.calls, wallet.account, wallet.injectedProvider, wallet.isSafeMode, wallet.safeAccount, wallet.safeAppSdk, wallet.safeOwnerConnected]);

    useEffect(() => {
        if (execution.status !== "active" || currentRecord?.status !== "pending" || !currentRecord.transactionHash || !wallet.provider || sessionStatus !== "ready") {
            return;
        }
        let cancelled = false;
        const checkReceipt = async () => {
            try {
                const receipt = await wallet.provider!.getTransactionReceipt(currentRecord.transactionHash!);
                if (cancelled) return;
                const isSafeExecution = Boolean(currentRecord.safeTxHash && wallet.safeAccount);
                const completeSafeExecution = (executionReceipt: import("ethers").TransactionReceipt, success: boolean) => {
                    if (success) {
                        dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: currentRecord.callId, transactionHash: executionReceipt.hash, blockNumber: String(executionReceipt.blockNumber), gasUsed: executionReceipt.gasUsed.toString(), updatedAt: Date.now()});
                    } else {
                        dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, transactionHash: executionReceipt.hash, blockNumber: String(executionReceipt.blockNumber), gasUsed: executionReceipt.gasUsed.toString(), error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe transaction was included but its inner call failed."}, updatedAt: Date.now()});
                    }
                };
                if (isSafeExecution && wallet.safeAccount) {
                    const key = `${currentRecord.callId}:${currentRecord.safeTxHash}`;
                    const lastChecked = lastSafeReconcileRef.current.get(key) ?? 0;
                    const maySearchEvents = Boolean(receipt) || Date.now() - lastChecked >= 15_000;
                    if (maySearchEvents) {
                        lastSafeReconcileRef.current.set(key, Date.now());
                        const executed = await findSafeExecutionReceipt(
                            wallet.provider!,
                            wallet.safeAccount.address,
                            currentRecord.safeTxHash!,
                            Number(currentRecord.safeCreatedBlock ?? 0),
                        );
                        if (cancelled) return;
                        if (executed) {
                            completeSafeExecution(executed.receipt, executed.success);
                            return;
                        }
                    }

                    if (receipt?.status === 1) {
                        // A successful outer receipt without a matching Safe event is ambiguous.
                        // Keep tracking rather than risk retrying a call that may have executed.
                        return;
                    }

                    if (!receipt) {
                        if (!maySearchEvents) return;
                        const pendingTransaction = await wallet.provider!.getTransaction(currentRecord.transactionHash!);
                        if (cancelled || pendingTransaction) return;
                    }

                    if (wallet.safeAccount.source !== "manual" && wallet.safeAccount.source !== "connected-account") return;
                    const call = callById.get(currentRecord.callId);
                    if (!call || !wallet.account || !wallet.injectedProvider) return;
                    const safeTransactionCalls = currentRecord.safeBatch ? state.plan.calls : [call];
                    const draft = await createSafeTransaction(wallet.injectedProvider, wallet.account, wallet.safeAccount.address, safeTransactionCalls);
                    if (cancelled) return;
                    if (draft.nonce === Number(currentRecord.safeNonce) && draft.safeTxHash.toLowerCase() === currentRecord.safeTxHash!.toLowerCase()) {
                        if (receipt) {
                            dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, transactionHash: receipt.hash, blockNumber: String(receipt.blockNumber), gasUsed: receipt.gasUsed.toString(), error: {code: "CALL_EXCEPTION", message: "The outer transaction reverted before executing the Safe call."}, updatedAt: Date.now()});
                        } else {
                            setSafeResubmitAvailableFor(currentRecord.callId);
                        }
                    } else {
                        // The Safe nonce advanced after the first event scan. Check again at the
                        // latest block so an execution racing this reconciliation is not lost.
                        const executed = await findSafeExecutionReceipt(wallet.provider!, wallet.safeAccount.address, currentRecord.safeTxHash!, Number(currentRecord.safeCreatedBlock ?? 0));
                        if (cancelled) return;
                        if (executed) completeSafeExecution(executed.receipt, executed.success);
                        else dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, error: {code: "SAFE_NONCE_STALE", message: "The Safe nonce advanced without a matching execution event. This call is no longer executable from this proposal."}, updatedAt: Date.now()});
                    }
                    return;
                }

                if (!receipt) return;
                const success = currentRecord.safeTxHash && wallet.safeAccount
                    ? safeReceiptSuccess(receipt, wallet.safeAccount.address)
                    : receipt.status === 1;
                if (success) {
                    dispatch({
                        type: "SEQUENTIAL_CALL_CONFIRMED",
                        callId: currentRecord.callId,
                        transactionHash: receipt.hash,
                        blockNumber: String(receipt.blockNumber),
                        gasUsed: receipt.gasUsed.toString(),
                        updatedAt: Date.now(),
                    });
                } else {
                    dispatch({
                        type: "SEQUENTIAL_CALL_FAILED",
                        callId: currentRecord.callId,
                        transactionHash: receipt.hash,
                        blockNumber: String(receipt.blockNumber),
                        gasUsed: receipt.gasUsed.toString(),
                        error: {code: "CALL_EXCEPTION", message: "The transaction was included but reverted."},
                        updatedAt: Date.now(),
                    });
                }
            } catch (receiptError) {
                if (!cancelled) setError(normalizeError(receiptError, "Transaction status unavailable"));
            }
        };
        void checkReceipt();
        const interval = window.setInterval(() => void checkReceipt(), 5000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [callById, currentRecord?.callId, currentRecord?.safeBatch, currentRecord?.safeCreatedBlock, currentRecord?.safeNonce, currentRecord?.safeTxHash, currentRecord?.status, currentRecord?.transactionHash, dispatch, execution.status, sessionStatus, state.plan.calls, wallet.account, wallet.injectedProvider, wallet.provider, wallet.safeAccount]);

    const currentCall = currentRecord ? callById.get(currentRecord.callId) : undefined;
    const waiting = currentRecord?.status === "submitting" || currentRecord?.status === "pending";
    const safeOwnerCanSign = Boolean(wallet.account && wallet.safeAccount?.owners.some((owner) => owner.toLowerCase() === wallet.account!.toLowerCase()));
    const canSubmitSafeBatch = wallet.safeAccount?.source === "safe-app"
        ? Boolean(wallet.safeAppSdk)
        : Boolean(wallet.injectedProvider && wallet.safeOwnerConnected && safeOwnerCanSign);

    const refreshSafeApprovals = useCallback(async () => {
        if (!currentRecord || currentRecord.status !== "awaiting_approvals" || !wallet.safeAccount) return;
        const safeTransactionCalls = currentRecord.safeBatch ? state.plan.calls : currentCall ? [currentCall] : [];
        if (safeTransactionCalls.length === 0) return;
        try {
            if ((wallet.safeAccount.source === "manual"
                || (wallet.safeAccount.source === "connected-account" && wallet.safeAccount.owners.some((owner) => owner.toLowerCase() === wallet.account?.toLowerCase())))
                && wallet.injectedProvider && wallet.account) {
                const draft = await createSafeTransaction(
                    wallet.injectedProvider,
                    wallet.account,
                    wallet.safeAccount.address,
                    safeTransactionCalls,
                );
                if (draft.nonce !== Number(currentRecord.safeNonce)) {
                    const executed = await findSafeExecutionReceipt(draft.provider, wallet.safeAccount.address, currentRecord.safeTxHash!, Number(currentRecord.safeCreatedBlock ?? 0));
                    if (executed) {
                        const transactionHash = executed.receipt.hash;
                        const submittedAt = currentRecord.submittedAt ?? Date.now();
                        dispatch({type: "SEQUENTIAL_SAFE_EXECUTION_SUBMITTED", callId: currentRecord.callId, transactionHash, submittedAt});
                        if (executed.success) {
                            dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: currentRecord.callId, transactionHash, blockNumber: String(executed.receipt.blockNumber), gasUsed: executed.receipt.gasUsed.toString(), updatedAt: Date.now()});
                        } else {
                            dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, transactionHash, blockNumber: String(executed.receipt.blockNumber), gasUsed: executed.receipt.gasUsed.toString(), error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe transaction was included but its inner call failed."}, updatedAt: Date.now()});
                        }
                        return;
                    }
                    dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, error: {code: "SAFE_NONCE_STALE", message: "Another Safe transaction used this nonce. This proposal can no longer execute; retry the call to create a new Safe transaction."}, updatedAt: Date.now()});
                    return;
                }
                if (draft.safeTxHash.toLowerCase() !== currentRecord.safeTxHash?.toLowerCase()) return;
                const owners = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
                if (owners.length !== currentRecord.approvedOwners) {
                    dispatch({type: "SEQUENTIAL_SAFE_APPROVALS_UPDATED", callId: currentRecord.callId, approvedOwners: owners.length, updatedAt: Date.now()});
                }
                return;
            }
            if (wallet.safeAccount.source === "safe-app" && wallet.safeAppSdk && currentRecord.safeTxHash) {
                const transaction = await wallet.safeAppSdk.txs.getBySafeTxHash(currentRecord.safeTxHash);
                const details = transaction as unknown as {txStatus?: string; txHash?: string};
                if ((details.txStatus !== "SUCCESS" && details.txStatus !== "FAILED") || !details.txHash) return;
                const receipt = await wallet.safeAppSdk.eth.getTransactionReceipt([details.txHash]);
                const status = Number(BigInt(receipt.status ?? 0));
                const blockNumber = BigInt(receipt.blockNumber).toString();
                const gasUsed = BigInt(receipt.gasUsed).toString();
                dispatch({type: "SEQUENTIAL_SAFE_EXECUTION_SUBMITTED", callId: currentRecord.callId, transactionHash: details.txHash, submittedAt: currentRecord.submittedAt ?? Date.now()});
                if (status === 1 && details.txStatus === "SUCCESS" && safeReceiptSuccess(receipt as unknown as import("ethers").TransactionReceipt, wallet.safeAccount.address)) {
                    dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: currentRecord.callId, transactionHash: details.txHash, blockNumber, gasUsed, updatedAt: Date.now()});
                } else {
                    dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, transactionHash: details.txHash, blockNumber, gasUsed, error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe transaction failed during execution."}, updatedAt: Date.now()});
                }
            }
        } catch (refreshError) {
            // A temporarily unavailable Safe host or RPC must leave the proposal tracked.
            setError(normalizeError(refreshError, "Safe status unavailable"));
        }
    }, [currentCall, currentRecord, dispatch, state.plan.calls, wallet.account, wallet.injectedProvider, wallet.safeAccount, wallet.safeAppSdk]);

    useEffect(() => {
        if (currentRecord?.status !== "awaiting_approvals") return;
        void refreshSafeApprovals();
        const interval = window.setInterval(() => void refreshSafeApprovals(), 5000);
        return () => window.clearInterval(interval);
    }, [currentRecord?.status, refreshSafeApprovals]);

    const approveSafeCall = useCallback(async () => {
        if (!currentRecord || currentRecord.status !== "awaiting_approvals" || !currentCall
            || (wallet.safeAccount?.source !== "manual" && wallet.safeAccount?.source !== "connected-account")
            || !wallet.safeAccount.owners.some((owner) => owner.toLowerCase() === wallet.account?.toLowerCase())
            || !wallet.injectedProvider || !wallet.account || !wallet.safeOwnerConnected) return;
        try {
            const safeTransactionCalls = currentRecord.safeBatch ? state.plan.calls : [currentCall];
            const draft = await createSafeTransaction(wallet.injectedProvider, wallet.account, wallet.safeAccount.address, safeTransactionCalls, Number(currentRecord.safeNonce));
            if (draft.safeTxHash.toLowerCase() !== currentRecord.safeTxHash?.toLowerCase()) {
                throw Object.assign(new Error("The Safe nonce or call changed. Refresh the plan before approving."), {code: "SAFE_TRANSACTION_CHANGED"});
            }
            const existing = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
            if (!existing.some((owner) => owner.toLowerCase() === wallet.account!.toLowerCase())) {
                const approval = await draft.protocolKit.approveTransactionHash(draft.safeTxHash);
                const waited = await waitForSafeOwnerAction(approval, draft.provider);
                if (!waited.receipt || waited.receipt.status !== 1) throw new Error("The Safe approval transaction did not confirm successfully.");
            }
            const owners = await draft.protocolKit.getOwnersWhoApprovedTx(draft.safeTxHash);
            dispatch({type: "SEQUENTIAL_SAFE_APPROVALS_UPDATED", callId: currentRecord.callId, approvedOwners: owners.length, updatedAt: Date.now()});
        } catch (approvalError) {
            setError(normalizeError(approvalError, "Could not record Safe owner approval"));
        }
    }, [currentCall, currentRecord, dispatch, state.plan.calls, wallet.account, wallet.injectedProvider, wallet.safeAccount, wallet.safeOwnerConnected]);

    const executeApprovedSafeCall = useCallback(async () => {
        if (!currentRecord || currentRecord.status !== "awaiting_approvals" || !currentCall
            || (wallet.safeAccount?.source !== "manual" && wallet.safeAccount?.source !== "connected-account")
            || !wallet.safeAccount.owners.some((owner) => owner.toLowerCase() === wallet.account?.toLowerCase())
            || !wallet.injectedProvider || !wallet.account || !wallet.safeOwnerConnected
            || (currentRecord.approvedOwners ?? 0) < (currentRecord.threshold ?? Number.POSITIVE_INFINITY)) return;
        try {
            const safeTransactionCalls = currentRecord.safeBatch ? state.plan.calls : [currentCall];
            const draft = await createSafeTransaction(wallet.injectedProvider, wallet.account, wallet.safeAccount.address, safeTransactionCalls, Number(currentRecord.safeNonce));
            if (draft.safeTxHash.toLowerCase() !== currentRecord.safeTxHash?.toLowerCase()) {
                throw Object.assign(new Error("The Safe nonce or call changed. This transaction can no longer be executed from this plan."), {code: "SAFE_TRANSACTION_CHANGED"});
            }
            const result = await reconcileSafeExecutionResult(draft, await executeSafeTransaction(draft, (transactionHash) => {
                dispatch({type: "SEQUENTIAL_SAFE_EXECUTION_SUBMITTED", callId: currentRecord.callId, transactionHash, submittedAt: Date.now()});
            }), Number(currentRecord.safeCreatedBlock ?? draft.blockNumber));
            if (result.success) {
                dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: currentRecord.callId, transactionHash: result.transactionHash, blockNumber: String(result.blockNumber), gasUsed: result.gasUsed, updatedAt: Date.now()});
            } else {
                dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, transactionHash: result.transactionHash, blockNumber: String(result.blockNumber), gasUsed: result.gasUsed, error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe transaction was included but its inner call failed."}, updatedAt: Date.now()});
            }
        } catch (executionError) {
            setError(normalizeError(executionError, "Could not execute Safe transaction"));
        }
    }, [currentCall, currentRecord, dispatch, state.plan.calls, wallet.account, wallet.injectedProvider, wallet.safeAccount, wallet.safeOwnerConnected]);

    const resubmitSafeExecution = useCallback(async () => {
        if (!currentRecord || currentRecord.status !== "pending" || !currentRecord.safeTxHash || !currentCall
            || safeResubmitAvailableFor !== currentRecord.callId
            || (wallet.safeAccount?.source !== "manual" && wallet.safeAccount?.source !== "connected-account")
            || !wallet.injectedProvider || !wallet.account || !wallet.safeOwnerConnected) return;
        setSafeResubmitAvailableFor(null);
        try {
            const safeTransactionCalls = currentRecord.safeBatch ? state.plan.calls : [currentCall];
            const draft = await createSafeTransaction(wallet.injectedProvider, wallet.account, wallet.safeAccount.address, safeTransactionCalls, Number(currentRecord.safeNonce));
            if (draft.safeTxHash.toLowerCase() !== currentRecord.safeTxHash.toLowerCase()) {
                throw Object.assign(new Error("The Safe transaction changed and cannot be resubmitted."), {code: "SAFE_TRANSACTION_CHANGED"});
            }
            const result = await reconcileSafeExecutionResult(draft, await executeSafeTransaction(draft, (transactionHash) => {
                dispatch({type: "SEQUENTIAL_SAFE_REPLACEMENT_SUBMITTED", callId: currentRecord.callId, transactionHash, submittedAt: Date.now()});
            }), Number(currentRecord.safeCreatedBlock ?? draft.blockNumber));
            if (result.success) {
                dispatch({type: "SEQUENTIAL_CALL_CONFIRMED", callId: currentRecord.callId, transactionHash: result.transactionHash, blockNumber: String(result.blockNumber), gasUsed: result.gasUsed, updatedAt: Date.now()});
            } else {
                dispatch({type: "SEQUENTIAL_CALL_FAILED", callId: currentRecord.callId, transactionHash: result.transactionHash, blockNumber: String(result.blockNumber), gasUsed: result.gasUsed, error: {code: "SAFE_EXECUTION_FAILED", message: "The Safe transaction was included but its inner call failed."}, updatedAt: Date.now()});
            }
        } catch (resubmitError) {
            setSafeResubmitAvailableFor(currentRecord.callId);
            setError(normalizeError(resubmitError, "Could not resubmit Safe execution"));
        }
    }, [currentCall, currentRecord, dispatch, safeResubmitAvailableFor, state.plan.calls, wallet.account, wallet.injectedProvider, wallet.safeAccount, wallet.safeOwnerConnected]);

    return (
        <Stack spacing={1.5}>
            <Divider />
            <Box>
                <Typography variant="subtitle1" sx={{fontWeight: 800}}>{wallet.isSafeMode ? "Safe transactions" : "Individual transactions"}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {wallet.isSafeMode ? "Send each plan call as its own Safe transaction in order. Completed calls stay on-chain if a later call fails." : "Send plan calls one at a time in order. Confirmed calls stay on-chain if a later call fails."}
                </Typography>
            </Box>

            {wallet.safeAccount?.source === "connected-account"
                && wallet.account?.toLowerCase() === wallet.safeAccount.address.toLowerCase()
                && !safeOwnerCanSign
                && <Alert severity="info">This Safe is connected as the account. Connect one of its owner wallets to submit a multi-call transaction or approve and execute Safe proposals.</Alert>}

                    {execution.status !== "idle" && (
                <Stack spacing={0.75}>
                    {state.plan.calls.map((call, index) => {
                        const record = records[index];
                        const ready = execution.status === "active" && index === confirmedCount && (!record || record.status === "failed");
                        const presentation = statusPresentation(record, ready);
                        return (
                            <Paper key={call.id} variant="outlined" sx={{p: 1.25, borderRadius: 1.5}}>
                                <Stack spacing={0.5}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                                        <Typography variant="body2" sx={{fontWeight: 700, overflowWrap: "anywhere"}}>
                                            {index + 1}. {sequentialCallLabel(call)}
                                        </Typography>
                                        <Chip size="small" label={presentation.label} color={presentation.color} variant={record?.status === "confirmed" ? "filled" : "outlined"} />
                                    </Box>
                                    {record?.transactionHash && (
                                        <Box sx={{display: "flex", alignItems: "center", gap: 0.5, minWidth: 0}}>
                                            <Typography variant="caption" color="text.secondary" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>
                                                {record.transactionHash}
                                            </Typography>
                                            <CopyButton value={record.transactionHash} label={`Copy transaction hash for call ${index + 1}`} />
                                        </Box>
                                    )}
                                    {record?.safeTxHash && (
                                        <Box sx={{display: "flex", alignItems: "center", gap: 0.5, minWidth: 0}}>
                                            <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>Safe tx {record.safeTxHash}</Typography>
                                            <CopyButton value={record.safeTxHash} label={`Copy Safe transaction hash for call ${index + 1}`} />
                                        </Box>
                                    )}
                                    {record?.status === "awaiting_approvals" && (
                                        <Typography variant="caption" color="text.secondary">
                                            {record.approvedOwners ?? 0} of {record.threshold} owner approvals · Safe nonce {record.safeNonce}
                                        </Typography>
                                    )}
                                    {record?.approvalTransactionHash && <Typography variant="caption" color="text.secondary">Approval tx {record.approvalTransactionHash}</Typography>}
                                </Stack>
                            </Paper>
                        );
                    })}
                </Stack>
            )}

            {execution.status === "idle" && (
                <Stack spacing={0.75}>
                    {wallet.isSafeMode && state.plan.calls.length > 1 && (
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            disabled={!walletReady || !canSubmitSafeBatch || state.execution.status !== "idle"}
                            onClick={() => { setReviewMechanism("safe-batch"); setReviewOpen(true); }}
                        >
                            Review one Safe transaction for all {state.plan.calls.length} calls
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        color="secondary"
                        fullWidth
                        disabled={!walletReady || state.execution.status !== "idle"}
                        onClick={() => { setReviewMechanism("sequential"); setReviewOpen(true); }}
                    >
                        {wallet.isSafeMode ? "Review individual Safe transactions" : "Review sequential execution"}
                    </Button>
                </Stack>
            )}

            {execution.status === "active" && (
                <Stack spacing={1}>
                    {currentRecord?.status === "submitting" && <Alert severity="info">{currentRecord.safeBatch ? `Submitting one Safe transaction for all ${state.plan.calls.length} calls.` : `Waiting for wallet confirmation for call ${confirmedCount + 1}.`}</Alert>}
                    {currentRecord?.status === "pending" && <Alert severity="info">{currentRecord.safeBatch ? "The Safe multi-call transaction is pending on-chain." : `Call ${confirmedCount + 1} is pending on-chain.`}</Alert>}
                    {currentRecord?.status === "failed" && (
                        <Alert severity="error">{currentRecord.safeBatch ? "The Safe multi-call transaction failed" : `Call ${confirmedCount + 1} failed`}: {currentRecord.error?.message ?? "Transaction failed."}</Alert>
                    )}
                    {currentRecord?.status === "awaiting_approvals" && (
                        <Alert severity="warning">
                            {wallet.safeAccount?.source === "safe-app"
                                ? "This Safe transaction is awaiting approval or execution in Safe. Intereth will check its status while this view is open."
                                : `${currentRecord.approvedOwners ?? 0} of ${currentRecord.threshold} owners have approved this Safe transaction. Each approval is recorded on-chain.`}
                        </Alert>
                    )}
                    {currentRecord?.status === "awaiting_approvals"
                        && (wallet.safeAccount?.source === "manual" || wallet.safeAccount?.source === "connected-account")
                        && safeOwnerCanSign && (
                        <Stack spacing={1}>
                            {(currentRecord.approvedOwners ?? 0) < (currentRecord.threshold ?? Number.POSITIVE_INFINITY) && (
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    disabled={!walletReady || !wallet.account}
                                    onClick={() => void approveSafeCall()}
                                >
                                    Record approval from connected owner
                                </Button>
                            )}
                            {(currentRecord.approvedOwners ?? 0) >= (currentRecord.threshold ?? Number.POSITIVE_INFINITY) && (
                                <Button variant="contained" color="secondary" fullWidth disabled={!walletReady} onClick={() => void executeApprovedSafeCall()}>
                                    Execute Safe transaction
                                </Button>
                            )}
                        </Stack>
                    )}
                    {!waiting && currentRecord?.status !== "failed" && currentRecord?.status !== "awaiting_approvals" && nextCall && (
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            startIcon={<SendIcon />}
                            disabled={!walletReady}
                            onClick={() => void sendCall(nextCall)}
                        >
                            {wallet.isSafeMode ? "Send Safe call" : `Send call ${confirmedCount + 1}`}: {sequentialCallLabel(nextCall)}
                        </Button>
                    )}
                    {waiting && (
                        <Button variant="contained" color="secondary" fullWidth disabled startIcon={<CircularProgress size={18} color="inherit" />}>
                            {currentRecord?.status === "submitting" ? "Awaiting wallet" : "Awaiting confirmation"}
                        </Button>
                    )}
                    {currentRecord?.status === "pending" && safeResubmitAvailableFor === currentRecord.callId && (
                        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void resubmitSafeExecution()}>Resubmit</Button>}>
                            The original wallet transaction is no longer visible and this Safe nonce is still unused. Resubmitting cannot execute the Safe call twice, but may spend gas if the original is still pending elsewhere.
                        </Alert>
                    )}
                    {currentRecord?.status === "failed" && currentCall && (
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            onClick={() => {
                                dispatch({type: "RETRY_SEQUENTIAL_CALL", callId: currentRecord.callId});
                                if (currentRecord.safeBatch) void sendSafeBatch(true);
                                else void sendCall(currentCall);
                            }}
                        >
                            {currentRecord.safeBatch ? "Retry Safe multi-call" : "Retry transaction"}
                        </Button>
                    )}
                    {!waiting && currentRecord?.status !== "awaiting_approvals" && (
                        <Button variant="outlined" color="warning" fullWidth onClick={() => dispatch({type: "STOP_SEQUENTIAL_EXECUTION", updatedAt: Date.now()})}>
                            Stop execution
                        </Button>
                    )}
                </Stack>
            )}

            {execution.status === "completed" && (
                <Stack spacing={1}>
                    <Alert severity="success">{records.at(-1)?.safeBatch ? `All ${state.plan.calls.length} calls in the Safe transaction were confirmed.` : `All ${state.plan.calls.length} transactions were confirmed in order.`}</Alert>
                    <Typography variant="caption" color="text.secondary">Creating a new draft keeps these same calls. Review or remove them before sending anything again.</Typography>
                    <Button variant="outlined" fullWidth onClick={() => dispatch({type: "RESET_SEQUENTIAL_EXECUTION"})}>Create new draft</Button>
                </Stack>
            )}

            {execution.status === "stopped" && (
                <Stack spacing={1}>
                    <Alert severity="info">Sequential execution was stopped. Confirmed transactions remain on-chain.</Alert>
                    <Typography variant="caption" color="text.secondary">Creating a new draft keeps all original calls, including calls already confirmed. Remove or edit them before another execution.</Typography>
                    <Button variant="outlined" fullWidth onClick={() => dispatch({type: "RESET_SEQUENTIAL_EXECUTION"})}>Create new draft</Button>
                </Stack>
            )}

            <ExecutionReviewDialog
                open={reviewOpen}
                mechanism={reviewMechanism}
                onClose={() => setReviewOpen(false)}
                onConfirm={() => {
                    setReviewOpen(false);
                    if (reviewMechanism === "safe-batch") void sendSafeBatch();
                    else dispatch({type: "START_SEQUENTIAL_EXECUTION", startedAt: Date.now()});
                }}
            />
            <ErrorDialog error={error} onClose={() => setError(null)} />
        </Stack>
    );
}
