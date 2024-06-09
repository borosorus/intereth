import { Paper, Typography, FormControl, InputLabel, Input, FormControlLabel, Switch, Button, CircularProgress } from "@mui/material";
import { JsonRpcApiProvider, JsonRpcProvider, ethers } from "ethers";
import { useMemo, useState } from "react";
import ErrorDialog from "./ErrorDialog";

export default function RawCall({contract, isStaticOnly}: {contract: ethers.BaseContract, isStaticOnly?: boolean}){
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const [data, setData] = useState('');
    const [value, setValue] = useState('');
    const [staticCall, setStatic] = useState(isStaticOnly ?? false);

    const call = useMemo(() => async () => {
        if((isStaticOnly || contract.runner?.sendTransaction) && contract.runner?.call){
            try{
                setIsResponseLoading(true);
                const contractAddress = await contract.getAddress();
                if(!staticCall){
                    const resp: ethers.TransactionResponse = await contract.runner.sendTransaction!({to: contractAddress, data: data, value: value});
                    const receipt: ethers.TransactionReceipt | null = await resp.wait(1, 60000);
                    if(receipt){
                        setResponse(`Transaction ${receipt.status ? "succeeded" : "failed"} hash: ${receipt.hash}`);
                    }
                }else{
                    const resp = await contract.runner.call({to: contractAddress, data: data});
                    setResponse(resp.toString());
                        
                }
                setIsResponseLoading(false);
            }
            catch(error){
                setIsResponseLoading(false);
                setError((error as Error).toString());
            }
        }else{
            setError("Failed to find a runner for the transaction");
        }
    }, [contract, staticCall, data]);

    return (
    <Paper sx={{m: 1, p: 1}}>
        <Typography sx={{textAlign: 'center', width: 1}}>Raw Call</Typography>
        <FormControl sx={{width: 0.5, m: 1}}>
            <InputLabel>Hex Calldata</InputLabel>
            <Input value={data} onChange={(e) => setData(e.target.value)}/>
        </FormControl>
        {!staticCall && (<FormControl sx={{width: 0.5, m: 1}}>
            <InputLabel>Wei Value</InputLabel>
            <Input value={value} onChange={(e) => setValue(e.target.value)}/>
        </FormControl>)}
        {!isStaticOnly && (<FormControlLabel control={<Switch checked={staticCall} onChange={() => setStatic(!staticCall)}/>} label="Static Call" />)}
        <Button variant="outlined" sx={{m: 'auto', maxWidth: 1}} onClick={() => call()}>Call</Button>
        {isResponseLoading ? <CircularProgress /> : <Typography>{response}</Typography>}
        <ErrorDialog error={error} setError={setError}/>
    </Paper>
    );
}