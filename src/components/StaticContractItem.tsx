import { Accordion, AccordionDetails, AccordionSummary, Button, Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import { JsonRpcProvider, ethers } from "ethers";
import { useEffect, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ParamInput from "./ParamInput";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";

interface StaticFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
}

function StaticFunctionItem({contract, frag}: StaticFunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const [args, setArgs] = useState<Array<string>>(frag.inputs.map(() => ''));

    const isDisabled = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";

    const call = async () => {
        try{
            const resp = await contract.getFunction(frag)(...args);
            setResponse(resp.toString());
        }
        catch(error){
            setError((error as Error).toString());
        }
    }

    const handleInputChange = (ind: number, value: string) => {
        setArgs((current) => current.map((el, index) => (ind === index) ? value : el));
    }

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography color={isDisabled ? 'text.secondary' : 'text.primary'} sx={{fontWeight: 600}}>{frag.format("full")}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                {isDisabled ? (
                    <Typography color="text.secondary">Connect a browser wallet to make state-modifying calls.</Typography>
                )
                : (
                    <>
                        {frag.inputs.map((input, index) => <ParamInput key={input.format("full")} id={index} param={input} setValue={handleInputChange} args={args}/>)}
                        <Button variant="contained" color="secondary" sx={{alignSelf: 'flex-start'}} onClick={() => call()}>Call</Button>
                        <Typography sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{response}</Typography>
                    </>
                )}
            </AccordionDetails>
            <ErrorDialog error={error} setError={setError}/>
        </Accordion>
    );
}

interface StaticContractItemProps {
    contract: ethers.BaseContract; 
    del: () => void;
}

export default function StaticContractItem({contract, del}: StaticContractItemProps){
    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');
    const [chainId, setChainId] = useState<string>('');
    const [rpcUrl, setRpcUrl] = useState<string>('');

    useEffect(() => {
        contract.getAddress().then((a) => setAddress(a));
        contract.runner?.provider?.getNetwork().then((n) => setChainId(n.chainId.toString()));
        const provider = contract.runner?.provider as (JsonRpcProvider & { connection?: { url?: string } }) | undefined;
        setRpcUrl(provider?.connection?.url ?? 'Unknown RPC');
    }, [contract]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={6}>
                        <Typography sx={{m: 1, fontWeight: 600}}>{address}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Typography sx={{m: 1, width: 1}} color="text.secondary">RPC: {rpcUrl}</Typography>
                    </Grid>
                    <Grid item xs={10} md={2}>
                        <Typography sx={{m: 1, width: 1}} color="text.secondary">Chain ID: {chainId}</Typography>
                    </Grid>
                    <Grid item xs={2} md={1} sx={{display: 'flex', justifyContent: 'flex-end'}}>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            del();
                          }}
                        >
                            <DeleteIcon fontSize="small"/>
                        </IconButton>
                    </Grid>
                </Grid>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
              <Stack spacing={1.5}>
                {contract.interface.fragments
                    .filter((f) => f.type === "function")
                    .map((f)=> <StaticFunctionItem key={f.format("minimal")} frag={f as ethers.FunctionFragment} contract={contract}/>)}
              </Stack>
            </Paper>
            <RawCall contract={contract} isStaticOnly={true}/>
            </AccordionDetails>
      </Accordion>);
}
