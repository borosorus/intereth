import { Alert, Box, Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Button, CircularProgress, Stack } from "@mui/material";
import { ethers } from "ethers";
import { useCallback, useEffect, useId, useState } from "react";
import ErrorDialog from "./ErrorDialog";
import TransactionValueInput from "./TransactionValueInput";
import CallResult from "./CallResult";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { ValueUnit } from "../calls/parameters";
import { prepareRawCall } from "../calls/prepareCall";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import { normalizeReadData } from "../calls/readCall";
import ReadActions, { ReadLoadingMode } from "./ReadActions";
import { useSimulatedRead } from "../simulation/useSimulatedRead";
import ApprovalRecoveryDialog, { ApprovalRecoveryRequest } from "./ApprovalRecoveryDialog";
import { detectErc20ApprovalRequirement } from "../transactions/approvalRecovery";
import { sendPreparedTransaction } from "../transactions/sendTransaction";
import { QueuedCall } from "../transaction-plan/types";
import { useWorkspaceMode } from "../workspace/context";
import { prepareRawWatch } from "../simulation/watchExpressions";
import { usePinWatch } from "../simulation/usePinWatch";

export default function RawCall({contract, isStaticOnly, disabled = false, chainId}: {contract: ethers.BaseContract, isStaticOnly?: boolean, disabled?: boolean, chainId?: string}){
    const dataInputId = useId();
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [isQueueing, setIsQueueing] = useState(false);
    const [queued, setQueued] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const [readLoading, setReadLoading] = useState<ReadLoadingMode>(null);
    const [approvalRecovery, setApprovalRecovery] = useState<ApprovalRecoveryRequest | null>(null);

    const [data, setData] = useState('');
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");
    const [staticCall, setStatic] = useState(isStaticOnly ?? false);
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const simulatedRead = useSimulatedRead(chainId);
    const workspace = useWorkspaceMode();
    const watchPin = usePinWatch(chainId);
    const simulationAvailable = workspace.mode === "simulate" && staticCall && simulatedRead.available;

    useEffect(() => {
        setResult((current) => current?.kind !== "transaction" && current?.source.kind === "simulated" ? null : current);
        if (workspace.mode === "simulate") setApprovalRecovery(null);
    }, [simulatedRead.revision, workspace.mode]);

    const call = useCallback(async () => {
        let attemptedCall: QueuedCall | null = null;
        const runner = contract.runner;
        const hasTxRunner = typeof runner?.sendTransaction === "function";
        const hasCallRunner = typeof runner?.call === "function";
        if (!hasCallRunner || (!staticCall && !hasTxRunner)) {
            setError(normalizeError(new Error("The connected provider cannot perform this action."), "Runner unavailable"));
            return;
        }

        try {
            setIsResponseLoading(true);
            setQueued(false);
            setResult(null);
            setError(null);
            const contractAddress = await contract.getAddress();
            if (!staticCall) {
                if (!wallet.account || !wallet.chainId || !wallet.signer) {
                    throw Object.assign(new Error("The connected wallet is not ready to send this transaction."), {code: "WALLET_DISCONNECTED"});
                }
                attemptedCall = prepareRawCall({
                    target: contractAddress,
                    account: wallet.account,
                    chainId: wallet.chainId,
                    data,
                    valueAmount,
                    valueUnit,
                });
                await sendPreparedTransaction(wallet.signer, attemptedCall, setResult);
            } else {
                setReadLoading("onchain");
                const callData = normalizeReadData(data);
                const resp = await runner!.call!({to: contractAddress, data: callData});
                setResult({kind: "raw", data: resp, source: {kind: "onchain"}});
            }
        } catch (caughtError) {
            const approvalRequirement = attemptedCall ? detectErc20ApprovalRequirement(caughtError) : null;
            if (attemptedCall && approvalRequirement) {
                setApprovalRecovery({requirement: approvalRequirement, originalCall: attemptedCall});
                return;
            }
            const normalized = normalizeError(caughtError, staticCall ? "Raw call failed" : "Transaction failed");
            setResult((current) => current?.kind === "transaction"
                ? {...current, status: normalized.code === "CALL_EXCEPTION" ? "failed" : "pending"}
                : current);
            setError(normalized);
        } finally {
            setIsResponseLoading(false);
            setReadLoading(null);
        }
    }, [contract, data, staticCall, valueAmount, valueUnit, wallet.account, wallet.chainId, wallet.signer]);

    const runSimulated = useCallback(async () => {
        if (!chainId) return;
        try {
            setQueued(false);
            setResult(null);
            setError(null);
            const completed = await simulatedRead.run({
                to: await contract.getAddress(),
                data: normalizeReadData(data),
            });
            if (!completed) return;
            setResult({
                kind: "raw",
                data: completed.result.returnData,
                source: {kind: "simulated", queuedCallCount: completed.queuedCallCount},
            });
        } catch (simulationError) {
            setError(normalizeError(simulationError, "Simulated raw call failed"));
        }
    }, [chainId, contract, data, simulatedRead]);

    const pinWatch = useCallback(async () => {
        try {
            await watchPin.pin(async (context) => prepareRawWatch({target: await contract.getAddress(), context, data}));
        } catch (watchError) {
            setError(normalizeError(watchError, "Could not pin watch"));
        }
    }, [contract, data, watchPin]);

    const addToQueue = useCallback(async () => {
        try {
            setIsQueueing(true);
            setQueued(false);
            setError(null);
            if (!wallet.account || !wallet.chainId) {
                throw Object.assign(new Error("Connect a wallet before adding calls to the plan."), {code: "WALLET_DISCONNECTED"});
            }
            const prepared = prepareRawCall({
                target: await contract.getAddress(),
                account: wallet.account,
                chainId: wallet.chainId,
                data,
                valueAmount,
                valueUnit,
            });
            transactionPlan.dispatch({type: "ADD_CALL", call: prepared});
            setQueued(true);
        } catch (queueError) {
            setError(normalizeError(queueError, "Could not add call"));
        } finally {
            setIsQueueing(false);
        }
    }, [contract, data, transactionPlan, valueAmount, valueUnit, wallet.account, wallet.chainId]);

    return (
    <Paper variant="outlined" sx={{mt: 2, p: {xs: 2, md: 3}, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.82)'}}>
        <Stack spacing={2}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap'}}>
                <Box>
                    <Typography variant="subtitle1" sx={{fontWeight: 700}}>Raw call</Typography>
                    <Typography variant="caption" color="text.secondary">
                        Provide calldata directly when you already have the encoded payload.
                    </Typography>
                </Box>
                {!isStaticOnly && (
                    <FormControlLabel
                        control={<Switch checked={staticCall} onChange={() => {
                            setStatic(!staticCall);
                            setResult(null);
                            setError(null);
                        }} />}
                        label="Static call"
                    />
                )}
            </Box>
            <Stack spacing={1.5}>
                <FormControl fullWidth>
                    <InputLabel htmlFor={dataInputId}>Hex calldata</InputLabel>
                    <Input id={dataInputId} value={data} onChange={(e) => setData(e.target.value)} />
                </FormControl>
                {!staticCall && (
                    <TransactionValueInput
                        amount={valueAmount}
                        unit={valueUnit}
                        onAmountChange={setValueAmount}
                        onUnitChange={setValueUnit}
                        label="Transaction value"
                    />
                )}
            </Stack>
            {staticCall ? (
                <ReadActions
                    simulationEnabled={simulatedRead.enabled}
                    simulationAvailable={simulationAvailable}
                    onChainAvailable={!disabled && typeof contract.runner?.call === "function"}
                    loading={simulatedRead.loading ? "simulated" : isResponseLoading ? readLoading : null}
                    onSimulated={() => void runSimulated()}
                    onOnChain={() => void call()}
                    onPinWatch={() => void pinWatch()}
                    canPinWatch={watchPin.canPin}
                />
            ) : (
                <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                    {workspace.mode === "interact" && (
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            disabled={disabled || isResponseLoading || isQueueing}
                            onClick={() => call()}
                            sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                        >
                            {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Send now"}
                        </Button>
                    )}
                    <Button
                        variant={workspace.mode === "simulate" ? "contained" : "outlined"}
                        color={workspace.mode === "simulate" ? "info" : "secondary"}
                        fullWidth
                        disabled={disabled || isQueueing || isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                        onClick={addToQueue}
                        sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                    >
                        {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to queue"}
                    </Button>
                </Stack>
            )}
            {queued && <Alert severity="success">Added to transaction queue.</Alert>}
            {watchPin.notice && (
                <Alert severity="info" onClose={watchPin.clearNotice}>
                    {watchPin.notice} Raw watches are treated as read-only and evaluated after ABI watches.
                </Alert>
            )}
            <CallResult result={result} />
        </Stack>
        <ErrorDialog error={error} onClose={() => setError(null)}/>
        <ApprovalRecoveryDialog
            request={approvalRecovery}
            onClose={() => setApprovalRecovery(null)}
            onOriginalResult={setResult}
        />
    </Paper>
    );
}
