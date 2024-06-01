import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardActions, CardContent, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface FunctionItemProps {
    contract: ethers.Contract; 
    frag: ethers.FunctionFragment;
}

export default function FunctionItem({contract, frag}: FunctionItemProps){
    const [expanded, setExpanded] = useState(false);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 1, m: 1}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Typography>{frag.format("full")}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Button variant="outlined">Call</Button>
            </AccordionDetails>
        </Accordion>
    );
}