import {
    Alert,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { chainsById } from "../chainConfig";
import { HttpJsonRpcTransport } from "../simulation/SimulationClient";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import { PlanContext, QueuedCall } from "../transaction-plan/types";
import {
    Erc20ApprovalRequirement,
    inferDirectApprovalToken,
    ValidatedApprovalRecovery,
    validateApprovalRecovery,
} from "../transactions/approvalRecovery";
import { forceSendPreparedTransaction, sendPreparedTransaction } from "../transactions/sendTransaction";
import { useWalletSession } from "../wallet/WalletSessionContext";
import CallResult from "./CallResult";
import ResponsiveDialog from "./ResponsiveDialog";

export interface ApprovalRecoveryRequest {
    requirement: Erc20ApprovalRequirement;
    originalCall: QueuedCall;
}

const technicalValueSx = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    overflowWrap: "anywhere",
};

interface ApprovalRecoveryDialogProps {
    request: ApprovalRecoveryRequest | null;
    onClose: () => void;
    onOriginalResult: (result: Extract<CallResultData, {kind: "transaction"}>) => void;
}

function parseAmount(value: string) {
    if (!/^\d+$/.test(value.trim())) {
        throw Object.assign(new Error("Approval amount must be a non-negative integer in token base units."), {code: "INVALID_ARGUMENT"});
    }
    return BigInt(value.trim());
}

export default function ApprovalRecoveryDialog({request, onClose, onOriginalResult}: ApprovalRecoveryDialogProps) {
    const wallet = useWalletSession();
    const plan = useTransactionPlan();
    const planUi = useTransactionPlanUi();
    const [tokenAddress, setTokenAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [validated, setValidated] = useState<ValidatedApprovalRecovery | null>(null);
    const [checking, setChecking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmForce, setConfirmForce] = useState(false);
    const [approvalConfirmed, setApprovalConfirmed] = useState(false);
    const [approvalResult, setApprovalResult] = useState<Extract<CallResultData, {kind: "transaction"}> | null>(null);
    const [originalSubmissionUnresolved, setOriginalSubmissionUnresolved] = useState(false);
    const [error, setError] = useState<NormalizedError | null>(null);
    const context = useMemo<PlanContext | null>(() => request ? ({
        account: request.originalCall.from,
        chainId: request.originalCall.chainId,
    }) : null, [request]);
    const rpcUrl = context ? chainsById.get(context.chainId)?.rpcUrl.trim() ?? "" : "";
    const walletMatches = Boolean(
        context
        && wallet.account?.toLowerCase() === context.account.toLowerCase()
        && wallet.chainId === context.chainId,
    );

    useEffect(() => {
        setTokenAddress("");
        setAmount(request?.requirement.needed.toString() ?? "");
        setValidated(null);
        setChecking(false);
        setBusy(false);
        setConfirmForce(false);
        setApprovalConfirmed(false);
        setApprovalResult(null);
        setOriginalSubmissionUnresolved(false);
        setError(null);
        if (!request || !context || !rpcUrl) return;

        let cancelled = false;
        inferDirectApprovalToken(
            new HttpJsonRpcTransport(rpcUrl),
            context,
            request.originalCall.to,
            request.requirement,
        ).then((inferred) => {
            if (!cancelled && inferred) setTokenAddress((current) => current === "" ? inferred : current);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [context, request, rpcUrl]);

    const invalidate = () => {
        setValidated(null);
        setConfirmForce(false);
        setApprovalConfirmed(false);
        setApprovalResult(null);
        setError(null);
    };

    const validate = async () => {
        if (!request || !context) return;
        setChecking(true);
        setError(null);
        try {
            if (!rpcUrl) throw Object.assign(new Error("No simulation RPC is configured for this network."), {code: "SIMULATION_NOT_CONFIGURED"});
            const result = await validateApprovalRecovery(
                rpcUrl,
                context,
                request.originalCall,
                request.requirement,
                tokenAddress,
                parseAmount(amount),
            );
            setValidated(result);
        } catch (validationError) {
            setValidated(null);
            setError(normalizeError(validationError, "Approval validation failed"));
        } finally {
            setChecking(false);
        }
    };

    const addToPlan = () => {
        if (!request || !validated || !plan.canEdit || !walletMatches) return;
        plan.dispatch({type: "ADD_CALL", call: validated.approvalCall});
        plan.dispatch({type: "ADD_CALL", call: request.originalCall});
        planUi.requestReview();
        onClose();
    };

    const approveFirst = async () => {
        if (!validated || !wallet.signer || !walletMatches) return;
        setBusy(true);
        setError(null);
        try {
            const result = await sendPreparedTransaction(wallet.signer, validated.approvalCall, setApprovalResult);
            setApprovalConfirmed(result.status === "confirmed");
        } catch (approvalError) {
            setError(normalizeError(approvalError, "Approval transaction failed"));
        } finally {
            setBusy(false);
        }
    };

    const reportOriginalResult = (result: Extract<CallResultData, {kind: "transaction"}>) => {
        onOriginalResult(result);
        setOriginalSubmissionUnresolved(result.status === "submitted" || result.status === "pending");
    };

    const sendOriginal = async () => {
        if (!request || !wallet.signer || !walletMatches) return;
        setBusy(true);
        setError(null);
        try {
            await sendPreparedTransaction(wallet.signer, request.originalCall, reportOriginalResult);
            onClose();
        } catch (sendError) {
            setError(normalizeError(sendError, "Transaction failed"));
        } finally {
            setBusy(false);
        }
    };

    const forceSend = async () => {
        if (!request || !validated || !wallet.provider || !walletMatches) return;
        setBusy(true);
        setError(null);
        try {
            await forceSendPreparedTransaction(wallet.provider, request.originalCall, validated.gasLimit, reportOriginalResult);
            onClose();
        } catch (sendError) {
            setError(normalizeError(sendError, "Forced transaction failed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ResponsiveDialog open={request !== null} onClose={busy ? undefined : onClose} maxWidth="sm">
            <DialogTitle>ERC-20 approval required</DialogTitle>
            <DialogContent>
                {request && (
                    <Stack spacing={2} sx={{pt: 0.5}}>
                        <Alert severity="warning">
                            Gas estimation reports that this transaction needs more ERC-20 allowance. Confirm the token before continuing.
                        </Alert>
                        {!walletMatches && <Alert severity="error">Reconnect the original account and network before continuing.</Alert>}
                        <Stack spacing={0.75}>
                            <Stack spacing={0.15}>
                                <Typography variant="caption" color="text.secondary">Spender</Typography>
                                <Typography variant="body2" sx={technicalValueSx}>{request.requirement.spender}</Typography>
                            </Stack>
                            <Stack spacing={0.15}>
                                <Typography variant="caption" color="text.secondary">Current allowance</Typography>
                                <Typography variant="body2" sx={technicalValueSx}>{request.requirement.currentAllowance.toString()}</Typography>
                            </Stack>
                            <Stack spacing={0.15}>
                                <Typography variant="caption" color="text.secondary">Required allowance</Typography>
                                <Typography variant="body2" sx={technicalValueSx}>{request.requirement.needed.toString()}</Typography>
                            </Stack>
                        </Stack>
                        <TextField
                            label="Token contract address"
                            value={tokenAddress}
                            onChange={(event) => { setTokenAddress(event.target.value); invalidate(); }}
                            disabled={busy || checking || approvalConfirmed}
                            fullWidth
                            helperText="Intereth fills this only when the failed transaction target can be verified as the token."
                        />
                        <TextField
                            label="Approval amount (base units)"
                            value={amount}
                            onChange={(event) => { setAmount(event.target.value); invalidate(); }}
                            disabled={busy || checking || approvalConfirmed}
                            fullWidth
                        />
                        <Button
                            variant="outlined"
                            onClick={() => void validate()}
                            disabled={checking || busy || !tokenAddress.trim()}
                            sx={{minHeight: {xs: 44, sm: "auto"}}}
                        >
                            {checking ? <CircularProgress size={20} /> : "Validate approval"}
                        </Button>
                        {validated && (
                            <Alert severity="success">
                                Approval and transaction both succeeded in simulation. Forced-send gas limit: {validated.gasLimit.toString()}.
                            </Alert>
                        )}
                        {error && <Alert severity="error">{error.message}</Alert>}
                        {approvalResult && (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2" sx={{fontWeight: 700}}>Approval transaction</Typography>
                                <CallResult result={approvalResult} />
                            </Stack>
                        )}
                        {originalSubmissionUnresolved ? (
                            <Alert severity="warning">
                                The original transaction was submitted but remains unresolved. Verify its hash before taking any further action.
                            </Alert>
                        ) : approvalConfirmed ? (
                            <Button
                                variant="contained"
                                color="secondary"
                                disabled={busy || !wallet.signer || !walletMatches}
                                onClick={() => void sendOriginal()}
                                sx={{minHeight: {xs: 44, sm: "auto"}}}
                            >
                                Send transaction
                            </Button>
                        ) : (approvalResult?.status === "submitted" || approvalResult?.status === "pending") ? (
                            <Alert severity="warning">
                                The approval was submitted but remains unresolved. Do not submit it again; verify its hash before continuing.
                            </Alert>
                        ) : validated && (
                            <Stack spacing={{xs: 1.25, sm: 1}} sx={{"& .MuiButton-root": {minHeight: {xs: 44, sm: "auto"}}}}>
                                <Button variant="contained" color="secondary" disabled={busy || !plan.canEdit || !walletMatches} onClick={addToPlan}>
                                    Add approval and transaction to plan
                                </Button>
                                <Button variant="outlined" disabled={busy || !wallet.signer || !walletMatches} onClick={() => void approveFirst()}>
                                    Approve first
                                </Button>
                                {confirmForce ? (
                                    <Stack spacing={1}>
                                        <Alert severity="error">
                                            This bypasses gas estimation. Unless an approval becomes effective before execution, the transaction is expected to revert and consume gas.
                                        </Alert>
                                        <Button color="error" variant="contained" disabled={busy || !wallet.provider || !walletMatches} onClick={() => void forceSend()}>
                                            Confirm force send
                                        </Button>
                                    </Stack>
                                ) : (
                                    <Button color="error" variant="text" disabled={busy || !wallet.provider || !walletMatches} onClick={() => setConfirmForce(true)}>
                                        Send anyway
                                    </Button>
                                )}
                            </Stack>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Close</Button>
            </DialogActions>
        </ResponsiveDialog>
    );
}
