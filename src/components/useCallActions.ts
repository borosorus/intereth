import { useCallback, useEffect, useState } from "react";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { executableOf } from "../calls/executable";
import { detectErc20ApprovalRequirement } from "../transactions/approvalRecovery";
import { sendPreparedTransaction } from "../transactions/sendTransaction";
import { PlanContext, QueuedCall, WatchExpression } from "../transaction-plan/types";
import { useTransactionPlan } from "../transaction-plan/context";
import { SimulatedRead, SimulatedReadResult } from "../simulation/types";
import { useSimulatedRead } from "../simulation/useSimulatedRead";
import { usePinWatch } from "../simulation/usePinWatch";
import { useWorkspaceMode } from "../workspace/context";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { ApprovalRecoveryRequest } from "./ApprovalRecoveryDialog";
import { ReadLoadingMode } from "./ReadActions";

// Wallet identity is validated before a call is prepared, so preparation
// factories receive a ready account/chain pair instead of re-checking.
export interface CallWalletContext {
    account: string;
    chainId: string;
}

export type PreparedCallFactory = (wallet: CallWalletContext) => QueuedCall | Promise<QueuedCall>;
export type OnchainReadThunk = () => Promise<CallResultData>;
export type SimulatedReadThunk = () => Promise<SimulatedRead>;
export type SimulatedReadProjector = (completed: {result: SimulatedReadResult; queuedCallCount: number}) => CallResultData;
export type WatchFactory = (context: PlanContext) => WatchExpression | Promise<WatchExpression>;

// Shared execution actions for one authored call (ABI function, static
// function, or raw calldata). Authoring components own their form state and
// produce prepared calls; everything after preparation lives here so every
// authoring surface sends, queues, reads, simulates, and pins identically.
export function useCallActions({chainId}: {chainId?: string} = {}) {
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const simulatedRead = useSimulatedRead(chainId);
    const watchPin = usePinWatch(chainId);
    const workspace = useWorkspaceMode();

    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [isQueueing, setIsQueueing] = useState(false);
    const [queued, setQueued] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const [readLoading, setReadLoading] = useState<ReadLoadingMode>(null);
    const [approvalRequest, setApprovalRequest] = useState<ApprovalRecoveryRequest | null>(null);

    // Simulated results are only meaningful for the queue revision they were
    // produced against; a new revision clears them but never touches real
    // transaction results or in-flight approval recovery outside simulation.
    useEffect(() => {
        setResult((current) => current?.kind !== "transaction" && current?.source.kind === "simulated" ? null : current);
        if (workspace.mode === "simulate") setApprovalRequest(null);
    }, [simulatedRead.revision, workspace.mode]);

    const sendNow = useCallback(async (prepare: PreparedCallFactory) => {
        let attemptedCall: QueuedCall | null = null;
        try {
            setIsResponseLoading(true);
            setQueued(false);
            setResult(null);
            setError(null);
            if (!wallet.account || !wallet.chainId || !wallet.signer) {
                throw Object.assign(new Error("The connected wallet is not ready to send this transaction."), {code: "WALLET_DISCONNECTED"});
            }
            attemptedCall = await prepare({account: wallet.account, chainId: wallet.chainId});
            await sendPreparedTransaction(wallet.signer, executableOf(attemptedCall), setResult);
        } catch (caughtError) {
            const approvalRequirement = attemptedCall ? detectErc20ApprovalRequirement(caughtError) : null;
            if (attemptedCall && approvalRequirement) {
                setApprovalRequest({requirement: approvalRequirement, originalCall: attemptedCall});
                return;
            }
            const normalized = normalizeError(caughtError, "Transaction failed");
            setResult((current) => current?.kind === "transaction"
                ? {...current, status: normalized.code === "CALL_EXCEPTION" ? "failed" : "pending"}
                : current);
            setError(normalized);
        } finally {
            setIsResponseLoading(false);
        }
    }, [wallet.account, wallet.chainId, wallet.signer]);

    const queueCall = useCallback(async (prepare: PreparedCallFactory) => {
        try {
            setIsQueueing(true);
            setQueued(false);
            setError(null);
            if (!wallet.account || !wallet.chainId) {
                throw Object.assign(new Error("Connect a wallet before adding calls to the plan."), {code: "WALLET_DISCONNECTED"});
            }
            const prepared = await prepare({account: wallet.account, chainId: wallet.chainId});
            transactionPlan.dispatch({type: "ADD_CALL", call: prepared});
            setQueued(true);
        } catch (queueError) {
            setError(normalizeError(queueError, "Could not add call"));
        } finally {
            setIsQueueing(false);
        }
    }, [transactionPlan, wallet.account, wallet.chainId]);

    const runOnchainRead = useCallback(async (run: OnchainReadThunk, fallbackTitle?: string) => {
        setIsResponseLoading(true);
        setReadLoading("onchain");
        setResult(null);
        setError(null);
        try {
            setResult(await run());
        } catch (readError) {
            setError(normalizeError(readError, fallbackTitle));
        } finally {
            setIsResponseLoading(false);
            setReadLoading(null);
        }
    }, []);

    const runSimulated = useCallback(async (makeRead: SimulatedReadThunk, toResult: SimulatedReadProjector, fallbackTitle: string) => {
        try {
            setResult(null);
            setError(null);
            const completed = await simulatedRead.run(await makeRead());
            if (!completed) return;
            setResult(toResult(completed));
        } catch (simulationError) {
            setError(normalizeError(simulationError, fallbackTitle));
        }
    }, [simulatedRead]);

    const pinWatch = useCallback(async (factory: WatchFactory) => {
        try {
            await watchPin.pin(factory);
        } catch (watchError) {
            setError(normalizeError(watchError, "Could not pin watch"));
        }
    }, [watchPin]);

    const resetWriteState = useCallback(() => {
        setResult(null);
        setIsResponseLoading(false);
        setQueued(false);
        setApprovalRequest(null);
    }, []);

    const clearApprovalRequest = useCallback(() => setApprovalRequest(null), []);

    return {
        wallet,
        transactionPlan,
        simulatedRead,
        watchPin,
        // The simulated-read capability is owned by the simulation hook; the
        // workspace-mode check lives there, not in each authoring component.
        simulationAvailable: simulatedRead.available,
        readActionsLoading: (simulatedRead.loading ? "simulated" : isResponseLoading ? readLoading : null) as ReadLoadingMode,
        isResponseLoading,
        isQueueing,
        queued,
        result,
        setResult,
        error,
        setError,
        approvalRequest,
        clearApprovalRequest,
        sendNow,
        queueCall,
        runOnchainRead,
        runSimulated,
        pinWatch,
        resetWriteState,
    };
}
