import { Accordion, AccordionDetails, AccordionSummary, Button, CircularProgress, Grid, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
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
    const isStateModifying = useMemo(() => (frag.stateMutability === "nonpayable" || frag.stateMutability === "payable"), []);

    useEffect(() => {
        if(!expanded && isStateModifying){
            setResponse('');
            setIsResponseLoading(false);
        }
    }, [expanded, isStateModifying]);

    const call = useMemo(() => async () => {
        try{
            setIsResponseLoading(true);
            if(isStateModifying){
                const resp: ethers.ContractTransactionResponse = await contract.getFunction(frag)(...args);
                const receipt: ethers.ContractTransactionReceipt | null = await resp.wait(1, 60000);
                if(receipt){
                    setResponse(`Transaction ${receipt.status ? "succeeded" : "failed"} hash: ${receipt.hash}`);
                }
            }else{
                setIsResponseLoading(true)
                const resp = await contract.getFunction(frag).staticCall(...args);
                setResponse(resp.toString());
            }
            setIsResponseLoading(false);
        }
        catch(error){
            if(isStateModifying) setIsResponseLoading(false);
            setError((error as Error).toString());
        }
    }, [contract, isStateModifying, args]);

    const handleInputChange = (ind: number, value: string) => {
        setArgs(args.map((el, index) => (ind === index) ? value : el));
    }

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1, m: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography>{frag.format("full")}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column'}}>
                {frag.inputs.map((input, index) => <ParamInput key={input.format("full")} id={index} param={input} setValue={handleInputChange} args={args}/>)}
                <Button variant="outlined" sx={{m: 'auto', maxWidth: 1}} onClick={() => call()}>Call</Button>
                {isResponseLoading ? <CircularProgress /> : <Typography>{response}</Typography>}
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
        if(signer) {
            contract.connect(signer).getAddress().then((a) => setAddress(a));
            signer.provider.getNetwork().then((n) => setChainId(n.chainId.toString()));
        }
    }, [signer]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={6}>
                        <Typography sx={{m: 1}}>{address}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Typography sx={{m: 1, width: 1}}>RPC: Browser Wallet</Typography>
                    </Grid>
                    <Grid item xs={10} md={2}>
                        <Typography sx={{m: 1, width: 1}}>Chain ID: {chainId}</Typography>
                    </Grid>
                    <Grid item xs={2} md={1} sx={{display: 'flex', flexDirection: 'revert'}}>
                        <DeleteIcon sx={{m: 'auto'}} onClick={() => del()}/>
                    </Grid>
                </Grid>
            </AccordionSummary>
            <AccordionDetails>
            {signer ? contract.interface.fragments
                .filter((f) => f.type === "function")
                .map((f)=> <DynamicFunctionItem key={f.format("minimal")} frag={f as ethers.FunctionFragment} contract={contract.connect(signer)}/>) :
                "Please connect to your browser wallet to interact."    
            }
            <RawCall contract={contract}/>
            </AccordionDetails>
      </Accordion>);
}