import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeError, NormalizedError } from "../../callUtils";
import {
    AtomicCapabilityProbe,
    Eip5792BatchExecutor,
} from "../../transaction-plan/batchExecutor";
import { useTransactionPlan } from "../../transaction-plan/context";
import { BatchExecutionError, BatchExecutionState } from "../../transaction-plan/types";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import CopyButton from "../CopyButton";
import ErrorDialog from "../ErrorDialog";

type CapabilityState = AtomicCapabilityProbe | {status: "unchecked" | "checking"};

export interface AtomicBatchController {
    capability: CapabilityState;
    execution: BatchExecutionState;
    isRefreshing: boolean;
    error: NormalizedError | null;
    checkCapability: () => Promise<void>;
    submit: () => Promise<void>;
    refresh: () => Promise<void>;
    showInWallet: () => Promise<void>;
    clearError: () => void;
    resetFailedBatch: () => void;
}

function storedError(error: NormalizedError): BatchExecutionError {
    return {code: error.code, message: error.message};
}

export function useAtomicBatchExecution(reviewOpen: boolean): AtomicBatchController {
    const {state, dispatch, sessionStatus} = useTransactionPlan();
    const wallet = useWalletSession();
    const [capability, setCapability] = useState<CapabilityState>({status: "unchecked"});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<NormalizedError | null>(null);
    const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
    const refreshInFlight = useRef(false);
    const capabilityRequest = useRef(0);
    const context = state.plan.context;
    const executor = useMemo(
        () => wallet.provider ? new Eip5792BatchExecutor(wallet.provider) : null,
        [wallet.provider],
    );

    useEffect(() => {
        capabilityRequest.current += 1;
        setCapability({status: "unchecked"});
    }, [wallet.provider, wallet.account, wallet.chainId, context?.account, context?.chainId]);

    useEffect(() => {
        const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }, []);

    const checkCapability = useCallback(async () => {
        if (!executor || !context || sessionStatus !== "ready" || state.execution.status !== "idle") {
            return;
        }
        const request = ++capabilityRequest.current;
        setCapability({status: "checking"});
        const result = await executor.getCapability(context);
        if (capabilityRequest.current === request) {
            setCapability(result);
        }
    }, [context, executor, sessionStatus, state.execution.status]);

    useEffect(() => {
        if (reviewOpen && capability.status === "unchecked") {
            void checkCapability();
        }
    }, [capability.status, checkCapability, reviewOpen]);

    const submit = useCallback(async () => {
        if (!executor
            || !context
            || sessionStatus !== "ready"
            || (capability.status !== "supported" && capability.status !== "ready")) {
            return;
        }
        if (wallet.account?.toLowerCase() !== context.account.toLowerCase() || wallet.chainId !== context.chainId) {
            setError(normalizeError(Object.assign(new Error("The connected account or network no longer matches this plan."), {code: "PLAN_CONTEXT_MISMATCH"}), "Session changed"));
            return;
        }

        dispatch({type: "START_BATCH_SUBMISSION"});
        setError(null);
        try {
            const result = await executor.submit(context, state.plan.calls);
            dispatch({type: "BATCH_SUBMITTED", batchId: result.batchId, submittedAt: Date.now()});
        } catch (submissionError) {
            const normalized = normalizeError(submissionError, "Atomic batch submission failed");
            dispatch({type: "BATCH_SUBMISSION_FAILED", error: storedError(normalized)});
            setError(normalized);
        }
    }, [capability.status, context, dispatch, executor, sessionStatus, state.plan.calls, wallet.account, wallet.chainId]);

    const refresh = useCallback(async () => {
        const batchId = state.execution.batchId;
        if (!executor || !context || !batchId || sessionStatus !== "ready" || refreshInFlight.current) {
            return;
        }
        refreshInFlight.current = true;
        setIsRefreshing(true);
        try {
            const nextExecution = await executor.getStatus(batchId, context.chainId);
            dispatch({type: "BATCH_STATUS_UPDATED", execution: nextExecution, updatedAt: Date.now()});
            setError(null);
        } catch (statusError) {
            setError(normalizeError(statusError, "Batch status unavailable"));
        } finally {
            refreshInFlight.current = false;
            setIsRefreshing(false);
        }
    }, [context, dispatch, executor, sessionStatus, state.execution.batchId]);

    useEffect(() => {
        if (state.execution.status !== "pending" || sessionStatus !== "ready" || !pageVisible || !executor) {
            return;
        }
        const interval = window.setInterval(() => void refresh(), 5000);
        return () => window.clearInterval(interval);
    }, [executor, pageVisible, refresh, sessionStatus, state.execution.status]);

    const showInWallet = useCallback(async () => {
        if (!executor || !state.execution.batchId || sessionStatus !== "ready") {
            return;
        }
        try {
            await executor.showStatus(state.execution.batchId);
        } catch (showError) {
            setError(normalizeError(showError, "Wallet status view unavailable"));
        }
    }, [executor, sessionStatus, state.execution.batchId]);

    return {
        capability,
        execution: state.execution,
        isRefreshing,
        error,
        checkCapability,
        submit,
        refresh,
        showInWallet,
        clearError: () => setError(null),
        resetFailedBatch: () => {
            capabilityRequest.current += 1;
            setCapability({status: "unchecked"});
            dispatch({type: "RESET_FAILED_BATCH"});
        },
    };
}

const STATUS_LABELS: Record<BatchExecutionState["status"], string> = {
    idle: "Draft",
    submitting: "Awaiting wallet",
    pending: "Pending",
    confirmed: "Confirmed",
    offchain_failed: "Not submitted",
    reverted: "Reverted",
    partially_reverted: "Partially reverted",
    invalid: "Invalid response",
};

function statusColor(status: BatchExecutionState["status"]): "default" | "success" | "error" | "warning" {
    if (status === "confirmed") return "success";
    if (status === "pending" || status === "submitting") return "warning";
    if (status !== "idle") return "error";
    return "default";
}

function CapabilityControls({controller}: {controller: AtomicBatchController}) {
    const capability = controller.capability;
    if (capability.status === "unchecked" || capability.status === "checking") {
        return (
            <Button
                variant="outlined"
                fullWidth
                disabled={capability.status === "checking"}
                onClick={() => void controller.checkCapability()}
            >
                {capability.status === "checking" ? <CircularProgress size={20} /> : "Check wallet batching"}
            </Button>
        );
    }

    if (capability.status === "supported") {
        return (
            <Stack spacing={1}>
                <Alert severity="success">This wallet supports atomic transaction batches on the plan network.</Alert>
                <Button variant="contained" color="secondary" fullWidth startIcon={<SendIcon />} onClick={() => void controller.submit()}>
                    Send atomic batch
                </Button>
            </Stack>
        );
    }

    if (capability.status === "ready") {
        return (
            <Stack spacing={1}>
                <Alert severity="warning">
                    The wallet can enable atomic execution, potentially by installing a persistent EIP-7702 delegation on this account. Review the wallet request carefully.
                </Alert>
                <Button variant="contained" color="secondary" fullWidth startIcon={<SendIcon />} onClick={() => void controller.submit()}>
                    Enable smart account and send
                </Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={1}>
            <Alert severity={capability.status === "error" ? "error" : "info"}>
                {capability.status === "unsupported"
                    ? "This wallet does not support atomic batching on the plan network. Use Send immediately from individual function or raw-call forms."
                    : capability.status === "unavailable"
                        ? "Atomic batching is unavailable in this wallet. Use Send immediately from individual function or raw-call forms."
                        : ("error" in capability ? capability.error?.message : undefined) ?? "The wallet capability response could not be read."}
            </Alert>
            <Button variant="outlined" fullWidth startIcon={<RefreshIcon />} onClick={() => void controller.checkCapability()}>
                Check again
            </Button>
        </Stack>
    );
}

function ReceiptList({execution}: {execution: BatchExecutionState}) {
    if (!execution.receipts?.length) {
        return null;
    }
    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{fontWeight: 800}}>Receipts</Typography>
            {execution.receipts.map((receipt, index) => (
                <Paper key={`${receipt.transactionHash}-${index}`} variant="outlined" sx={{p: 1.5, borderRadius: 2}}>
                    <Stack spacing={0.75}>
                        <Box sx={{display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start"}}>
                            <Box sx={{minWidth: 0}}>
                                <Typography variant="caption" color="text.secondary">Transaction {index + 1}</Typography>
                                <Typography variant="body2" sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere"}}>
                                    {receipt.transactionHash}
                                </Typography>
                            </Box>
                            <CopyButton value={receipt.transactionHash} label={`Copy transaction ${index + 1} hash`} />
                        </Box>
                        <Typography variant="body2"><strong>Block:</strong> {BigInt(receipt.blockNumber).toString()}</Typography>
                        <Typography variant="body2"><strong>Gas used:</strong> {BigInt(receipt.gasUsed).toString()}</Typography>
                        <Typography variant="body2"><strong>Receipt status:</strong> {receipt.status === "0x1" ? "Success" : "Failed"}</Typography>
                    </Stack>
                </Paper>
            ))}
        </Stack>
    );
}

function SubmittedBatch({controller}: {controller: AtomicBatchController}) {
    const execution = controller.execution;
    const [confirmRetry, setConfirmRetry] = useState(false);
    const canRetry = execution.status === "offchain_failed" || execution.status === "reverted";
    const message = execution.status === "pending"
        ? "The wallet has accepted this atomic batch and it is awaiting an on-chain result."
        : execution.status === "confirmed"
            ? "The atomic batch was included without reverts."
            : execution.status === "offchain_failed"
                ? "The wallet will not submit or retry this batch. No calls were included on-chain."
                : execution.status === "reverted"
                    ? "The batch reverted completely. Only gas charges may have been applied."
                    : execution.status === "partially_reverted"
                        ? "The wallet reported partial execution despite atomic execution being required. Do not retry these calls without reviewing on-chain state."
                        : execution.error?.message ?? "The wallet returned a response that cannot be treated as atomic execution.";

    return (
        <Stack spacing={1.5}>
            <Alert severity={execution.status === "confirmed" ? "success" : execution.status === "pending" ? "info" : "error"}>
                {message}
            </Alert>
            <Paper variant="outlined" sx={{p: 1.5, borderRadius: 2}}>
                <Stack spacing={0.75}>
                    <Box sx={{display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center"}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Batch status</Typography>
                        <Chip size="small" label={STATUS_LABELS[execution.status]} color={statusColor(execution.status)} />
                    </Box>
                    {execution.batchId && (
                        <Box sx={{display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start"}}>
                            <Box sx={{minWidth: 0}}>
                                <Typography variant="caption" color="text.secondary">Batch ID</Typography>
                                <Typography variant="body2" sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere"}}>
                                    {execution.batchId}
                                </Typography>
                            </Box>
                            <CopyButton value={execution.batchId} label="Copy batch ID" />
                        </Box>
                    )}
                    {execution.walletStatus !== undefined && <Typography variant="body2"><strong>Wallet status:</strong> {execution.walletStatus}</Typography>}
                    {execution.atomic !== undefined && <Typography variant="body2"><strong>Atomic:</strong> {execution.atomic ? "Yes" : "No"}</Typography>}
                </Stack>
            </Paper>
            <ReceiptList execution={execution} />
            <Stack direction={{xs: "column", sm: "row"}} spacing={1}>
                <Button
                    variant="outlined"
                    fullWidth
                    startIcon={controller.isRefreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
                    disabled={controller.isRefreshing}
                    onClick={() => void controller.refresh()}
                >
                    Refresh status
                </Button>
                <Button variant="outlined" fullWidth startIcon={<OpenInNewIcon />} onClick={() => void controller.showInWallet()}>
                    View in wallet
                </Button>
            </Stack>
            {canRetry && (
                <Button color="warning" variant="outlined" fullWidth onClick={() => setConfirmRetry(true)}>
                    Create retry draft
                </Button>
            )}
            <Dialog open={confirmRetry} onClose={() => setConfirmRetry(false)}>
                <DialogTitle>Create a retry draft?</DialogTitle>
                <DialogContent>
                    <Typography>The batch record will be removed and these calls will become editable and eligible for a new submission. Nothing will be resent automatically.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmRetry(false)}>Cancel</Button>
                    <Button color="warning" onClick={() => {
                        controller.resetFailedBatch();
                        setConfirmRetry(false);
                    }}>Create draft</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}

export default function AtomicBatchExecution({controller}: {controller: AtomicBatchController}) {
    return (
        <Stack spacing={1.5}>
            <Divider />
            <Box>
                <Typography variant="subtitle1" sx={{fontWeight: 800}}>Atomic execution</Typography>
                <Typography variant="caption" color="text.secondary">All queued calls must execute atomically or the wallet must reject the request.</Typography>
            </Box>
            {controller.execution.status === "idle" && controller.execution.error && (
                <Alert severity="warning">{controller.execution.error.message}</Alert>
            )}
            {controller.execution.status === "idle" && <CapabilityControls controller={controller} />}
            {controller.execution.status === "submitting" && (
                <Button variant="contained" color="secondary" fullWidth disabled startIcon={<CircularProgress size={18} color="inherit" />}>
                    Awaiting wallet
                </Button>
            )}
            {controller.execution.status !== "idle" && controller.execution.status !== "submitting" && (
                <SubmittedBatch controller={controller} />
            )}
            <ErrorDialog error={controller.error} onClose={controller.clearError} />
        </Stack>
    );
}
