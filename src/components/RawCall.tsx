import { Alert, Box, Button, Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Stack } from "@mui/material";
import { ethers } from "ethers";
import { useCallback, useId, useState } from "react";
import ErrorDialog from "./ErrorDialog";
import TransactionValueInput from "./TransactionValueInput";
import CallResult from "./CallResult";
import CallActionButtons from "./CallActionButtons";
import { CallWalletContext, useCallActions } from "./useCallActions";
import { CallResultData, normalizeError } from "../callUtils";
import { ValueUnit } from "../calls/parameters";
import { prepareRawCall } from "../calls/prepareCall";
import { normalizeReadData } from "../calls/readCall";
import ReadActions from "./ReadActions";
import ApprovalRecoveryDialog from "./ApprovalRecoveryDialog";
import { prepareRawWatch } from "../simulation/watchExpressions";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";

export default function RawCall({contract, isStaticOnly, disabled = false, chainId}: {contract: ethers.BaseContract, isStaticOnly?: boolean, disabled?: boolean, chainId?: string}){
    const dataInputId = useId();
    const actions = useCallActions({chainId});
    const planUi = useTransactionPlanUi();
    const {wallet, transactionPlan, watchPin, result, error, setError, queued} = actions;

    const [data, setData] = useState('');
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");
    const [staticCall, setStatic] = useState(isStaticOnly ?? false);
    const simulationAvailable = staticCall && actions.simulationAvailable;

    // Raw calls may run against a provider without a sender, which is a
    // runner capability check rather than a wallet check, so it stays here.
    const guardRunner = useCallback((needsSend: boolean) => {
        const runner = contract.runner;
        if (typeof runner?.call === "function" && (!needsSend || typeof runner?.sendTransaction === "function")) return true;
        setError(normalizeError(new Error("The connected provider cannot perform this action."), "Runner unavailable"));
        return false;
    }, [contract, setError]);

    // Authoring ends here: raw calldata plus value becomes the same prepared
    // call for send and queue.
    const prepare = useCallback(async ({account, chainId: walletChainId}: CallWalletContext) => prepareRawCall({
        target: await contract.getAddress(),
        account,
        chainId: walletChainId,
        data,
        valueAmount,
        valueUnit,
    }), [contract, data, valueAmount, valueUnit]);

    return (
    <Paper variant="outlined" sx={{p: {xs: 2, md: 2.5}, borderRadius: 2.5}}>
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
                            actions.setResult(null);
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
                    simulationAvailable={simulationAvailable}
                    onChainAvailable={!disabled && typeof contract.runner?.call === "function"}
                    loading={actions.readActionsLoading}
                    onSimulated={() => {
                        if (!chainId) return;
                        void actions.runSimulated(
                            async () => ({to: await contract.getAddress(), data: normalizeReadData(data)}),
                            (completed) => ({
                                kind: "raw",
                                data: completed.result.returnData,
                                source: {kind: "simulated", queuedCallCount: completed.queuedCallCount},
                            }),
                            "Simulated raw call failed",
                        );
                    }}
                    onOnChain={() => {
                        if (!guardRunner(false)) return;
                        void actions.runOnchainRead(async (): Promise<CallResultData> => ({
                            kind: "raw",
                            data: await contract.runner!.call!({to: await contract.getAddress(), data: normalizeReadData(data)}),
                            source: {kind: "onchain"},
                        }), "Raw call failed");
                    }}
                    onPinWatch={() => void actions.pinWatch(async (context) => prepareRawWatch({target: await contract.getAddress(), context, data}))}
                    canPinWatch={watchPin.canPin}
                />
            ) : (
                <CallActionButtons
                    isSending={actions.isResponseLoading}
                    isQueueing={actions.isQueueing}
                    sendDisabled={disabled || actions.isResponseLoading || actions.isQueueing}
                    queueDisabled={disabled || actions.isQueueing || actions.isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                    onSend={() => {
                        if (!guardRunner(true)) return;
                        void actions.sendNow(prepare);
                    }}
                    onQueue={() => void actions.queueCall(prepare)}
                />
            )}
            {queued && <Alert severity="success" action={<Button size="small" onClick={planUi.requestExecution}>Review</Button>}>Added to execution.</Alert>}
            {watchPin.notice && (
                <Alert severity="info" onClose={watchPin.clearNotice} action={<Button size="small" onClick={planUi.requestExecution}>Review</Button>}>
                    {watchPin.notice} Raw watches are treated as read-only and evaluated after ABI watches.
                </Alert>
            )}
            <CallResult result={result} />
        </Stack>
        <ErrorDialog error={error} onClose={() => setError(null)}/>
        <ApprovalRecoveryDialog
            request={actions.approvalRequest}
            onClose={actions.clearApprovalRequest}
            onOriginalResult={actions.setResult}
        />
    </Paper>
    );
}
