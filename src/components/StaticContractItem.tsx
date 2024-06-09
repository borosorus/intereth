import { Accordion, AccordionDetails, AccordionSummary, Button, Typography } from "@mui/material";
import { JsonRpcProvider, ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
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

    const isDisabled = useMemo(() => (frag.stateMutability === "nonpayable" || frag.stateMutability === "payable"), []);

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
        setArgs(args.map((el, index) => (ind === index) ? value : el));
    }

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1, m: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography color={isDisabled ? 'red' : 'black'} >{frag.format("full")}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column'}}>
                {isDisabled ? (
                    <Typography>You need to use connect to a browser wallet to make state modifying calls.</Typography>
                )
                : (
                    <>
                        {frag.inputs.map((input, index) => <ParamInput key={input.format("full")} id={index} param={input} setValue={handleInputChange} args={args}/>)}
                        <Button variant="outlined" sx={{m: 'auto', maxWidth: 1}} onClick={() => call()}>Call</Button>
                        <Typography>{response}</Typography>
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
        setRpcUrl((contract.runner?.provider as JsonRpcProvider)._getConnection().url);
    }, []);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{m: 1}}>{address}</Typography>
                <Typography sx={{m: 1, width: 1}}>RPC: {rpcUrl}</Typography>
                <Typography sx={{m: 1, width: 1}}>Chain ID: {chainId}</Typography>
                <DeleteIcon sx={{m: 'auto'}} onClick={() => del()}/>
            </AccordionSummary>
            <AccordionDetails>
            {contract.interface.fragments
                .filter((f) => f.type === "function")
                .map((f)=> <StaticFunctionItem key={f.format("minimal")} frag={f as ethers.FunctionFragment} contract={contract}/>)}
            <RawCall contract={contract} isStaticOnly={true}/>
            </AccordionDetails>
      </Accordion>);
}