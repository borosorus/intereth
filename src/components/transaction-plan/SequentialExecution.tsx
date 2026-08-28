import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NormalizedError, normalizeError } from "../../callUtils";
import { useTransactionPlan } from "../../transaction-plan/context";
import { BatchExecutionError, QueuedCall, SequentialCallExecution } from "../../transaction-plan/types";
import { sendPreparedTransaction } from "../../transactions/sendTransaction";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import CopyButton from "../CopyButton";
import ErrorDialog from "../ErrorDialog";
import ExecutionReviewDialog from "./ExecutionReviewDialog";

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
    if (record.status === "pending") return {label: "Pending", color: "info" as const};
    return {label: "Awaiting wallet", color: "info" as const};
}

export default function SequentialExecution() {
    const {state, dispatch, sessionStatus} = useTransactionPlan();
    const wallet = useWalletSession();
    const [reviewOpen, setReviewOpen] = useState(false);
    const [error, setError] = useState<NormalizedError | null>(null);
    const execution = state.sequentialExecution;
    const records = execution.calls;
    const confirmedCount = records.filter((record) => record.status === "confirmed").length;
    const currentRecord = records[records.length - 1];
    const nextCall = state.plan.calls[confirmedCount];
    const walletReady = sessionStatus === "ready" && Boolean(wallet.signer && wallet.provider);
    const callById = useMemo(() => new Map(state.plan.calls.map((call) => [call.id, call])), [state.plan.calls]);

    const sendCall = useCallback(async (call: QueuedCall) => {
        if (!wallet.signer || sessionStatus !== "ready") return;
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
    }, [dispatch, sessionStatus, wallet.signer]);

    useEffect(() => {
        if (execution.status !== "active" || currentRecord?.status !== "pending" || !currentRecord.transactionHash || !wallet.provider || sessionStatus !== "ready") {
            return;
        }
        let cancelled = false;
        const checkReceipt = async () => {
            try {
                const receipt = await wallet.provider!.getTransactionReceipt(currentRecord.transactionHash!);
                if (cancelled || !receipt) return;
                if (receipt.status === 1) {
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
    }, [currentRecord?.callId, currentRecord?.status, currentRecord?.transactionHash, dispatch, execution.status, sessionStatus, wallet.provider]);

    const currentCall = currentRecord ? callById.get(currentRecord.callId) : undefined;
    const waiting = currentRecord?.status === "submitting" || currentRecord?.status === "pending";

    return (
        <Stack spacing={1.5}>
            <Divider />
            <Box>
                <Typography variant="subtitle1" sx={{fontWeight: 800}}>Individual transactions</Typography>
                <Typography variant="caption" color="text.secondary">
                    Send queued calls one at a time in plan order. Confirmed calls stay on-chain if a later call fails.
                </Typography>
            </Box>

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
                                </Stack>
                            </Paper>
                        );
                    })}
                </Stack>
            )}

            {execution.status === "idle" && (
                <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    disabled={!walletReady || state.execution.status !== "idle"}
                    onClick={() => setReviewOpen(true)}
                >
                    Review sequential execution
                </Button>
            )}

            {execution.status === "active" && (
                <Stack spacing={1}>
                    {currentRecord?.status === "submitting" && <Alert severity="info">Waiting for wallet confirmation for call {confirmedCount + 1}.</Alert>}
                    {currentRecord?.status === "pending" && <Alert severity="info">Call {confirmedCount + 1} is pending on-chain.</Alert>}
                    {currentRecord?.status === "failed" && (
                        <Alert severity="error">Call {confirmedCount + 1} failed: {currentRecord.error?.message ?? "Transaction failed."}</Alert>
                    )}
                    {!waiting && currentRecord?.status !== "failed" && nextCall && (
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            startIcon={<SendIcon />}
                            disabled={!walletReady}
                            onClick={() => void sendCall(nextCall)}
                        >
                            Send call {confirmedCount + 1}: {sequentialCallLabel(nextCall)}
                        </Button>
                    )}
                    {waiting && (
                        <Button variant="contained" color="secondary" fullWidth disabled startIcon={<CircularProgress size={18} color="inherit" />}>
                            {currentRecord?.status === "submitting" ? "Awaiting wallet" : "Awaiting confirmation"}
                        </Button>
                    )}
                    {currentRecord?.status === "failed" && currentCall && (
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            onClick={() => {
                                dispatch({type: "RETRY_SEQUENTIAL_CALL", callId: currentRecord.callId});
                                void sendCall(currentCall);
                            }}
                        >
                            Retry transaction
                        </Button>
                    )}
                    {!waiting && (
                        <Button variant="outlined" color="warning" fullWidth onClick={() => dispatch({type: "STOP_SEQUENTIAL_EXECUTION", updatedAt: Date.now()})}>
                            Stop execution
                        </Button>
                    )}
                </Stack>
            )}

            {execution.status === "completed" && (
                <Stack spacing={1}>
                    <Alert severity="success">All {state.plan.calls.length} transactions were confirmed in order.</Alert>
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
                mechanism="sequential"
                onClose={() => setReviewOpen(false)}
                onConfirm={() => {
                    setReviewOpen(false);
                    dispatch({type: "START_SEQUENTIAL_EXECUTION", startedAt: Date.now()});
                }}
            />
            <ErrorDialog error={error} onClose={() => setError(null)} />
        </Stack>
    );
}
