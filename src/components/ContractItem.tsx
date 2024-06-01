import { Accordion, AccordionDetails, AccordionSummary, Paper, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useMemo, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FunctionItem from "./FunctionItem";

interface ContractItemProps {
    contract: ethers.Contract; 
}

export default function ContractItem(
    {contract}: ContractItemProps
    ){

    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');

    contract.getAddress().then((a) => setAddress(a));

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography>{address}</Typography>
            </AccordionSummary>
            <AccordionDetails>
            {contract.interface.fragments
                .filter((f) => f.type === "function")
                .map((f)=> <FunctionItem key={f.format("minimal")} frag={f as ethers.FunctionFragment} contract={contract}/>)}
            </AccordionDetails>
      </Accordion>);
}