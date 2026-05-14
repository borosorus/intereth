import { Accordion, AccordionDetails, AccordionSummary, Button, CircularProgress, Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { ethers } from "ethers";
import ParamInput from "./ParamInput";
import { useConnectWallet } from "@web3-onboard/react";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";

interface DynamicFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
}

function DynamicFunctionItem({contract, frag}: DynamicFunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const [args, setArgs] = useState<Array<string>>(frag.inputs.map(() => ''));
    const isStateModifying = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";

    useEffect(() => {
        if(!expanded && isStateModifying){
            setResponse('');
            setIsResponseLoading(false);
        }
    }, [expanded, isStateModifying]);

    const call = useCallback(async () => {
        try{
            setIsResponseLoading(true);
            setResponse('');
            if(isStateModifying){
                const resp: ethers.ContractTransactionResponse = await contract.getFunction(frag)(...args);
                const receipt: ethers.ContractTransactionReceipt | null = await resp.wait(1, 60000);
                if(receipt){
                    setResponse(`Transaction ${receipt.status ? "succeeded" : "failed"} hash: ${receipt.hash}`);
                }
            }else{
                const resp = await contract.getFunction(frag).staticCall(...args);
                setResponse(resp.toString());
            }
        }
        catch(error){
            setError((error as Error).toString());
        } finally {
            setIsResponseLoading(false);
        }
    }, [args, contract, frag, isStateModifying]);

    const handleInputChange = (ind: number, value: string) => {
        setArgs((current) => current.map((el, index) => (ind === index) ? value : el));
    }

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{fontWeight: 600}}>{frag.format("full")}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
                    <Stack spacing={1}>
                        {frag.inputs.map((input, index) => <ParamInput key={input.format("full")} id={index} param={input} setValue={handleInputChange} args={args}/>)}
                        <Button variant="contained" color="secondary" sx={{alignSelf: 'flex-start'}} onClick={() => call()}>Call</Button>
                    </Stack>
                </Paper>
                {isResponseLoading ? <CircularProgress size={24} /> : <Typography sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{response}</Typography>}
            </AccordionDetails>
            <ErrorDialog error={error} setError={setError}/>
        </Accordion>
    );
}

interface DynamicContractItemProps {
    contract: ethers.BaseContract; 
    del: () => void;
}

export default function DynamicContractItem({contract, del}: DynamicContractItemProps){
    const [{wallet}] = useConnectWallet();
    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');
    const [chainId, setChainId] = useState<string>('');
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

    useEffect(() => {
        if(wallet?.provider){
            (new ethers.BrowserProvider(wallet.provider)).getSigner()
                .then((signer) => setSigner(signer));
        }else {
            setSigner(null);
        }
     }, [wallet]);

    useEffect(() => {
        contract.getAddress().then((a) => setAddress(a));
    }, [contract]);

    useEffect(() => {
        if(signer) {
            signer.provider?.getNetwork().then((n) => setChainId(n.chainId.toString()));
        } else {
            setChainId('');
        }
    }, [signer]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={6}>
                        <Typography sx={{m: 1, fontWeight: 600}}>{address}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Typography sx={{m: 1, width: 1}} color="text.secondary">RPC: Browser Wallet</Typography>
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
            {signer ? (
              <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
                <Stack spacing={1.5}>
                  {contract.interface.fragments
                      .filter((f) => f.type === "function")
                      .map((f)=> <DynamicFunctionItem key={f.format("minimal")} frag={f as ethers.FunctionFragment} contract={contract.connect(signer)}/>)}
                </Stack>
              </Paper>
            ) : (
                <Typography color="text.secondary">Please connect your browser wallet to interact.</Typography>
            )}
            <RawCall contract={contract}/>
            </AccordionDetails>
      </Accordion>);
}
