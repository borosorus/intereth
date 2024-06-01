import { Accordion, AccordionDetails, AccordionSummary, Button, FormControl, Input, InputLabel, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useMemo, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DynamicContract } from "../App";

interface FunctionItemProps {
    contract: DynamicContract; 
    frag: ethers.FunctionFragment;
}

interface ParamInputProps {
    param: ethers.ParamType;
    id: number;
    setValue: (id: number, value: string) => void;
    args: string[];
}

//TODO Input for each type, parsing
function ParamInput({param, id, setValue, args}: ParamInputProps) {
    return (
        <FormControl sx={{width: 0.5, m: 1}}>
            <InputLabel htmlFor="my-input">{param.format("full")}</InputLabel>
            <Input id="my-input" aria-describedby="my-helper-text" value={args[id]} onChange={(e) => setValue(id, e.target.value)}/>
        </FormControl>
    );
}

export default function FunctionItem({contract, frag}: FunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [response, setResponse] = useState('');

    const [args, setArgs] = useState<Array<string>>(frag.inputs.map(() => ''));

    const isDisabled = useMemo(() => contract.isStatic && (frag.stateMutability === "nonpayable" || frag.stateMutability === "payable"), [contract, frag]);

    const call = async () => {
        try{
            const resp = await contract.contract.getFunction(frag)(...args);
            setResponse(resp.toString());
        }
        catch(error){
            setResponse((error as Error).toString());
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
                    <Typography>You need to be connected to make state modifying calls.</Typography>
                )
                : (
                    <>
                        {frag.inputs.map((input, index) => <ParamInput key={input.format("full")} id={index} param={input} setValue={handleInputChange} args={args}/>)}
                        <Button variant="outlined" sx={{m: 'auto', maxWidth: 1}} onClick={() => call()}>Call</Button>
                        <Typography>{response}</Typography>
                    </>
                )}
            </AccordionDetails>
        </Accordion>
    );
}