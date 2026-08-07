import { Alert, Box, Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Button, CircularProgress, Stack } from "@mui/material";
import { ethers } from "ethers";
import { useCallback, useState } from "react";
import ErrorDialog from "./ErrorDialog";
import TransactionValueInput from "./TransactionValueInput";
import CallResult from "./CallResult";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { ValueUnit } from "../calls/parameters";
import { prepareRawCall } from "../calls/prepareCall";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";

export default function RawCall({contract, isStaticOnly, disabled = false}: {contract: ethers.BaseContract, isStaticOnly?: boolean, disabled?: boolean}){
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [isQueueing, setIsQueueing] = useState(false);
    const [queued, setQueued] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);

    const [data, setData] = useState('');
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");
    const [staticCall, setStatic] = useState(isStaticOnly ?? false);
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();

    const call = useCallback(async () => {
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
                if (!wallet.account || !wallet.chainId) {
                    throw Object.assign(new Error("The connected wallet is not ready to send this transaction."), {code: "WALLET_DISCONNECTED"});
                }
                const prepared = prepareRawCall({
                    target: contractAddress,
                    account: wallet.account,
                    chainId: wallet.chainId,
                    data,
                    valueAmount,
                    valueUnit,
                });
                const resp: ethers.TransactionResponse = await runner!.sendTransaction!({
                    to: prepared.to,
                    data: prepared.data,
                    value: prepared.value,
                });
                setResult({kind: "transaction", status: "submitted", hash: resp.hash});
                const receipt: ethers.TransactionReceipt | null = await resp.wait(1, 60000);
                setResult(receipt ? {
                    kind: "transaction",
                    status: receipt.status === 1 ? "confirmed" : "failed",
                    hash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                } : {kind: "transaction", status: "pending", hash: resp.hash});
            } else {
                const callData = data.trim() || "0x";
                try {
                    ethers.dataLength(callData);
                } catch {
                    throw Object.assign(new Error("Calldata must be a valid even-length hexadecimal value prefixed with 0x."), {code: "INVALID_ARGUMENT"});
                }
                const resp = await runner!.call!({to: contractAddress, data: callData});
                setResult({kind: "raw", data: resp});
            }
        } catch (error) {
            const normalized = normalizeError(error, staticCall ? "Raw call failed" : "Transaction failed");
            setResult((current) => current?.kind === "transaction"
                ? {...current, status: normalized.code === "CALL_EXCEPTION" ? "failed" : "pending"}
                : current);
            setError(normalized);
        } finally {
            setIsResponseLoading(false);
        }
    }, [contract, data, staticCall, valueAmount, valueUnit, wallet.account, wallet.chainId]);

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
                        control={<Switch checked={staticCall} onChange={() => setStatic(!staticCall)} />}
                        label="Static call"
                    />
                )}
            </Box>
            <Stack spacing={1.5}>
                <FormControl fullWidth>
                    <InputLabel>Hex calldata</InputLabel>
                    <Input value={data} onChange={(e) => setData(e.target.value)} />
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
                <Button
                    variant="contained"
                    color="secondary"
                    fullWidth
                    disabled={disabled || isResponseLoading}
                    onClick={() => call()}
                    sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                >
                    {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Run call"}
                </Button>
            ) : (
                <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                    <Button
                        variant="contained"
                        color="secondary"
                        fullWidth
                        disabled={disabled || isQueueing || isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                        onClick={addToQueue}
                        sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                    >
                        {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to queue"}
                    </Button>
                    <Button
                        variant="outlined"
                        color="secondary"
                        fullWidth
                        disabled={disabled || isResponseLoading || isQueueing}
                        onClick={() => call()}
                        sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                    >
                        {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Send immediately"}
                    </Button>
                </Stack>
            )}
            {queued && <Alert severity="success">Added to transaction queue.</Alert>}
            <CallResult result={result} />
        </Stack>
        <ErrorDialog error={error} onClose={() => setError(null)}/>
    </Paper>
    );
}
