import { Box, Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Button, CircularProgress, Stack } from "@mui/material";
import { ethers } from "ethers";
import { useCallback, useState } from "react";
import ErrorDialog from "./ErrorDialog";
import TransactionValueInput, { toWeiValue } from "./TransactionValueInput";
import CallResult from "./CallResult";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";

export default function RawCall({contract, isStaticOnly}: {contract: ethers.BaseContract, isStaticOnly?: boolean}){
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);

    const [data, setData] = useState('');
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<"ether" | "gwei" | "wei">("wei");
    const [staticCall, setStatic] = useState(isStaticOnly ?? false);
    const actionLabel = staticCall ? "Run call" : "Send transaction";

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
            setResult(null);
            setError(null);
            const contractAddress = await contract.getAddress();
            const callData = data.trim() || "0x";
            if (!ethers.isHexString(callData)) {
                throw Object.assign(new Error("Calldata must be a valid even-length hexadecimal value prefixed with 0x."), {code: "INVALID_ARGUMENT"});
            }
            if (!staticCall) {
                const transactionValue = toWeiValue(valueAmount, valueUnit);
                const resp: ethers.TransactionResponse = await runner!.sendTransaction!({to: contractAddress, data: callData, value: transactionValue});
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
    }, [contract, data, staticCall, valueAmount, valueUnit]);

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
            <Button
                variant="contained"
                color="secondary"
                fullWidth
                disabled={isResponseLoading}
                onClick={() => call()}
                sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
            >
                {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : actionLabel}
            </Button>
            <CallResult result={result} />
        </Stack>
        <ErrorDialog error={error} onClose={() => setError(null)}/>
    </Paper>
    );
}
