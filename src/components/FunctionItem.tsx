import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardActions, CardContent, FormControl, Input, InputLabel, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface FunctionItemProps {
    contract: ethers.Contract; 
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

    //TODO handle state modif funcs
    const call = () => {
        contract.getFunction(frag)(...args).then((r) => setResponse(r.toString()));
    }

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
                <Typography>{response}</Typography>
            </AccordionDetails>
        </Accordion>
    );
}