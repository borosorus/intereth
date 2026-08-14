import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { summarizeNativeValue } from "../../calls/displayValues";
import { useSimulation } from "../../simulation/context";
import { formatBalanceChangeAmount, metadataForToken, tokenLabel } from "../../simulation/tokenFormatting";
import { useTransactionPlan } from "../../transaction-plan/context";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import ResponsiveDialog from "../ResponsiveDialog";
import { simulationPresentation, StateBadge } from "../StateBadge";

export type ExecutionMechanism = "atomic-batch" | "smart-account";

function quantity(value: string) {
    try {
        return ethers.getBigInt(value).toLocaleString("en-US");
    } catch {
        return value;
    }
}

function snapshotAge(capturedAt: number, now: number) {
    const seconds = Math.max(0, Math.floor((now - capturedAt) / 1000));
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

export default function ExecutionReviewDialog({open, mechanism, onClose, onConfirm}: {
    open: boolean;
    mechanism: ExecutionMechanism;
    onClose: () => void;
    onConfirm: () => void;
}) {
    const {state, sessionStatus} = useTransactionPlan();
    const wallet = useWalletSession();
    const simulation = useSimulation();
    const [riskAccepted, setRiskAccepted] = useState(false);
    const [delegationAccepted, setDelegationAccepted] = useState(false);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!open) return;
        setRiskAccepted(false);
        setDelegationAccepted(false);
        setNow(Date.now());
        const interval = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(interval);
    }, [open, mechanism]);

    const calls = state.plan.calls;
    const context = state.plan.context;
    const snapshot = simulation.snapshot;
    const resultsById = useMemo(() => new Map(snapshot?.calls.map((call) => [call.callId, call]) ?? []), [snapshot]);
    const fresh = simulation.status === "ready"
        && snapshot?.revision === simulation.revision
        && calls.length === snapshot.calls.length
        && calls.every((call) => resultsById.has(call.id));
    const knownReverts = fresh ? calls.filter((call) => resultsById.get(call.id)?.status === "0x0") : [];
    const requiresRiskAcceptance = !fresh;
    const requiresDelegationAcceptance = mechanism === "smart-account";
    const sessionMatches = sessionStatus === "ready"
        && Boolean(context && wallet.account?.toLowerCase() === context.account.toLowerCase() && wallet.chainId === context.chainId);
    const canConfirm = sessionMatches
        && knownReverts.length === 0
        && (!requiresRiskAcceptance || riskAccepted)
        && (!requiresDelegationAcceptance || delegationAccepted);
    const totalNative = summarizeNativeValue(calls.reduce((total, call) => total + BigInt(call.value), BigInt(0)).toString());
    const accountChanges = fresh && snapshot
        ? snapshot.balanceChanges.filter((change) => change.account.toLowerCase() === snapshot.account.toLowerCase())
        : [];
    const simulationState = fresh
        ? simulationPresentation("ready")
        : simulation.status === "ready"
            ? {label: "Preview stale", kind: "warning" as const}
            : simulationPresentation(simulation.status);

    return (
        <ResponsiveDialog open={open} onClose={onClose} maxWidth="sm" aria-labelledby="execution-review-title">
            <DialogTitle id="execution-review-title">Review wallet submission</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Paper variant="outlined" sx={{p: 1.5, borderRadius: 2}}>
                        <Stack spacing={0.75}>
                            <Typography variant="subtitle2" sx={{fontWeight: 800}}>Submission</Typography>
                            <Typography variant="body2"><strong>Account:</strong> {context?.account ?? "Unavailable"}</Typography>
                            <Typography variant="body2"><strong>Chain:</strong> {context?.chainId ?? "Unavailable"}</Typography>
                            <Typography variant="body2"><strong>Calls:</strong> {calls.length}</Typography>
                            <Typography variant="body2"><strong>Total native value:</strong> {totalNative.primary}</Typography>
                            <Typography variant="body2"><strong>Mechanism:</strong> {mechanism === "smart-account" ? "EIP-5792 with smart-account enablement" : "EIP-5792 atomic batch"}</Typography>
                        </Stack>
                    </Paper>

                    <Box>
                        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.75}}>
                            <Typography variant="subtitle2" sx={{fontWeight: 800}}>Speculative preview</Typography>
                            <StateBadge {...simulationState} />
                        </Box>
                        {fresh && snapshot ? (
                            <Typography variant="caption" color="text.secondary">
                                Base block {quantity(snapshot.baseBlockNumber)} · captured {snapshotAge(snapshot.capturedAt, now)}
                            </Typography>
                        ) : (
                            <Alert severity="warning" sx={{mt: 1}}>
                                A fresh simulation matching this exact queue is unavailable. The wallet may still reject the request or the batch may revert.
                            </Alert>
                        )}
                    </Box>

                    {fresh && (
                        <Stack spacing={0.75}>
                            {calls.map((call, index) => {
                                const result = resultsById.get(call.id)!;
                                return (
                                    <Box key={call.id} sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                                        <Typography variant="body2" sx={{overflowWrap: "anywhere"}}>{index + 1}. {call.display.functionSignature ?? "Raw transaction"}</Typography>
                                        <Chip size="small" label={result.status === "0x1" ? "Success" : "Reverted"} color={result.status === "0x1" ? "success" : "error"} />
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}

                    {knownReverts.length > 0 && (
                        <Alert severity="error">
                            Submission is blocked because the current preview contains {knownReverts.length} reverting {knownReverts.length === 1 ? "call" : "calls"}. Edit the plan or refresh its simulation first.
                        </Alert>
                    )}

                    {fresh && snapshot && (
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 800, mb: 0.75}}>Plan-account balance changes</Typography>
                            {accountChanges.length === 0 ? (
                                <Typography variant="caption" color="text.secondary">No supported balance changes detected.</Typography>
                            ) : (
                                <Stack spacing={0.5}>
                                    {accountChanges.map((change) => {
                                        const metadata = change.asset === "erc20" ? metadataForToken(simulation.tokenMetadataByAddress, snapshot.chainId, change.tokenAddress) : undefined;
                                        return (
                                            <Box key={`${change.asset}:${change.tokenAddress ?? "native"}`} sx={{display: "flex", justifyContent: "space-between", gap: 1}}>
                                                <Typography variant="body2">{change.asset === "native" ? "Native asset" : tokenLabel(change.tokenAddress ?? "", metadata)}</Typography>
                                                <Typography variant="body2" sx={{fontFamily: "monospace", fontWeight: 700}}>{formatBalanceChangeAmount(change, metadata)}</Typography>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                        </Box>
                    )}

                    <Divider />
                    {requiresRiskAcceptance && (
                        <FormControlLabel
                            control={<Checkbox checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} />}
                            label="I understand that this queue does not have a fresh successful simulation."
                        />
                    )}
                    {requiresDelegationAcceptance && (
                        <>
                            <Alert severity="warning">The wallet may install a persistent EIP-7702 delegation on this account while enabling atomic execution.</Alert>
                            <FormControlLabel
                                control={<Checkbox checked={delegationAccepted} onChange={(event) => setDelegationAccepted(event.target.checked)} />}
                                label="I understand that this request may enable a persistent smart-account delegation."
                            />
                        </>
                    )}
                    {!sessionMatches && <Alert severity="error">Reconnect the plan account on its original chain before submitting.</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" color="secondary" disabled={!canConfirm} onClick={onConfirm}>
                    {mechanism === "smart-account" ? "Enable and submit" : "Submit atomic batch"}
                </Button>
            </DialogActions>
        </ResponsiveDialog>
    );
}
