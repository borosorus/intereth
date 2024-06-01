import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FunctionItem from "./FunctionItem";
import { DynamicContract } from "../App";
import DeleteIcon from '@mui/icons-material/Delete';

interface ContractItemProps {
    contract: DynamicContract; 
    del: () => void;
}

export default function ContractItem(
    {contract, del}: ContractItemProps
    ){

    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');

    contract.contract.getAddress().then((a) => setAddress(a));

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography>{address}</Typography>
                <Box sx={{width: 1}}/>
                <DeleteIcon onClick={() => del()}/>
            </AccordionSummary>
            <AccordionDetails>
            {contract.contract.interface.fragments
                .filter((f) => f.type === "function")
                .map((f)=> <FunctionItem key={f.format("minimal")} frag={f as ethers.FunctionFragment} contract={contract}/>)}
            </AccordionDetails>
      </Accordion>);
}