import { Box, Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Button, CircularProgress, Stack } from "@mui/material";
import { ethers } from "ethers";
import { useCallback, useState } from "react";
import ErrorDialog from "./ErrorDialog";

export default function RawCall({contract, isStaticOnly}: {contract: ethers.BaseContract, isStaticOnly?: boolean}){
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const [data, setData] = useState('');
    const [value, setValue] = useState('');
    const [staticCall, setStatic] = useState(isStaticOnly ?? false);
    const actionLabel = staticCall ? "Run call" : "Send transaction";

    const call = useCallback(async () => {
        const runner = contract.runner;
        const sendRunner = runner?.sendTransaction;
        const callRunner = runner?.call;
        const hasTxRunner = Boolean(sendRunner);
        const hasCallRunner = Boolean(callRunner);
        if (!hasCallRunner || (!staticCall && !hasTxRunner)) {
            setError("Failed to find a runner for the transaction");
            return;
        }

        try {
            setIsResponseLoading(true);
            setResponse('');
            const contractAddress = await contract.getAddress();
            if (!staticCall) {
                const transactionValue = value.trim() === "" ? "0" : value.trim();
                const resp: ethers.TransactionResponse = await sendRunner!({to: contractAddress, data, value: transactionValue});
                const receipt: ethers.TransactionReceipt | null = await resp.wait(1, 60000);
                if (receipt) {
                    setResponse(`Transaction ${receipt.status ? "succeeded" : "failed"} hash: ${receipt.hash}`);
                }
            } else {
                const resp = await callRunner!({to: contractAddress, data});
                setResponse(resp.toString());
            }
        } catch (error) {
            setError((error as Error).toString());
        } finally {
            setIsResponseLoading(false);
        }
    }, [contract, data, staticCall, value]);

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
                    <FormControl fullWidth>
                        <InputLabel>Value in wei</InputLabel>
                        <Input value={value} onChange={(e) => setValue(e.target.value)} />
                    </FormControl>
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
            {response && (
                <Paper variant="outlined" sx={{p: 1.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)'}}>
                    <Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                        {response}
                    </Typography>
                </Paper>
            )}
        </Stack>
        <ErrorDialog error={error} setError={setError}/>
    </Paper>
    );
}
