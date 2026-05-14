import { Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Button, CircularProgress, Stack } from "@mui/material";
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
                const resp: ethers.TransactionResponse = await sendRunner!({to: contractAddress, data, value});
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
    <Paper sx={{mt: 2, p: {xs: 2, md: 3}, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.82)'}}>
        <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{fontWeight: 700}}>Raw Call</Typography>
            <FormControl fullWidth>
                <InputLabel>Hex Calldata</InputLabel>
                <Input value={data} onChange={(e) => setData(e.target.value)}/>
            </FormControl>
            {!staticCall && (<FormControl fullWidth>
                <InputLabel>Wei Value</InputLabel>
                <Input value={value} onChange={(e) => setValue(e.target.value)}/>
            </FormControl>)}
            {!isStaticOnly && (<FormControlLabel control={<Switch checked={staticCall} onChange={() => setStatic(!staticCall)}/>} label="Static Call" />)}
            <Button variant="contained" color="secondary" sx={{alignSelf: 'flex-start'}} onClick={() => call()}>Call</Button>
            {isResponseLoading ? <CircularProgress size={24} /> : <Typography sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{response}</Typography>}
        </Stack>
        <ErrorDialog error={error} setError={setError}/>
    </Paper>
    );
}
