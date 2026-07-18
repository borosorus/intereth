import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Grid, IconButton, Link, Paper, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ParamInput, { buildParamValue, createEmptyParamValue, ParamValue } from "./ParamInput";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { ProviderDetails } from "../presets";

interface StaticFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
}

function StaticFunctionItem({contract, frag}: StaticFunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));

    const isDisabled = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";

    const call = async () => {
        try{
            const callArgs = frag.inputs.map((input, index) => buildParamValue(input, args[index] ?? createEmptyParamValue(input)));
            const resp = await contract.getFunction(frag)(...callArgs);
            setResponse(resp.toString());
        }
        catch(error){
            setError((error as Error).toString());
        }
    }

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Stack spacing={0.25}>
                    <Typography color={isDisabled ? 'text.secondary' : 'text.primary'} sx={{fontWeight: 700}}>
                        {frag.name || frag.format("sighash")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {frag.format("full")}
                    </Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                {isDisabled ? (
                    <Typography color="text.secondary">Connect a browser wallet to make state-modifying calls.</Typography>
                )
                : (
                    <>
                        <Stack spacing={1.5}>
                            {frag.inputs.map((input, index) => (
                                <ParamInput
                                    key={`${input.name || input.type}-${index}`}
                                    param={input}
                                    value={args[index] ?? createEmptyParamValue(input)}
                                    onChange={(value) => {
                                        setArgs((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
                                    }}
                                    label={input.name || `Input ${index + 1}`}
                                />
                            ))}
                            <Button
                                variant="contained"
                                color="secondary"
                                fullWidth
                                onClick={() => call()}
                                sx={{mt: 1, py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                            >
                                Call function
                            </Button>
                        </Stack>
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
    providerDetails?: ProviderDetails;
}

export default function StaticContractItem({contract, del, providerDetails}: StaticContractItemProps){
    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');
    const [detectedChainId, setDetectedChainId] = useState<string>('');

    useEffect(() => {
        contract.getAddress().then((a) => setAddress(a));
        if (!providerDetails?.chainId) {
            contract.runner?.provider?.getNetwork().then((network) => setDetectedChainId(network.chainId.toString()));
        }
    }, [contract, providerDetails?.chainId]);

    const chainId = providerDetails?.chainId || detectedChainId;

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={6}>
                        <Stack spacing={0.25} sx={{m: 1}}>
                            <Typography sx={{fontWeight: 700, wordBreak: "break-all"}}>{address}</Typography>
                            <Typography variant="caption" color="text.secondary">Read-only contract</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} md={3} sx={{minWidth: 0}}>
                        <Stack spacing={0.25} sx={{m: 1, minWidth: 0}}>
                            <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700}}>
                                {providerDetails?.label ?? "RPC provider"}
                            </Typography>
                            {providerDetails?.url ? (
                                <Link
                                    href={providerDetails.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    color="text.secondary"
                                    underline="hover"
                                    sx={{display: "flex", alignItems: "center", gap: 0.4, minWidth: 0, fontSize: "0.75rem"}}
                                >
                                    <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                                        {providerDetails.url}
                                    </Box>
                                    <OpenInNewIcon sx={{fontSize: 13, flex: "0 0 auto"}} />
                                </Link>
                            ) : (
                                <Typography variant="caption" color="text.secondary">Unknown endpoint</Typography>
                            )}
                        </Stack>
                    </Grid>
                    <Grid item xs={10} md={2}>
                        <Box sx={{m: 1}}>
                            <Chip label={chainId ? `Chain ID ${chainId}` : "Detecting chain"} size="small" variant="outlined" />
                        </Box>
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
