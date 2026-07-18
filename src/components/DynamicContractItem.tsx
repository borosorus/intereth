import { Accordion, AccordionDetails, AccordionSummary, Box, Button, CircularProgress, Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { ethers } from "ethers";
import ParamInput, { buildParamValue, createEmptyParamValue, ParamValue } from "./ParamInput";
import { useConnectWallet } from "@web3-onboard/react";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";
import TransactionValueInput, { toWeiValue } from "./TransactionValueInput";
import CallResult from "./CallResult";
import CopyButton from "./CopyButton";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";

interface DynamicFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
}

function DynamicFunctionItem({contract, frag}: DynamicFunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<"ether" | "gwei" | "wei">("wei");

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));
    const isStateModifying = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";
    const isPayable = frag.stateMutability === "payable";
    const buttonLabel = isStateModifying ? "Send transaction" : "Run call";

    useEffect(() => {
        if(!expanded && isStateModifying){
            setResult(null);
            setIsResponseLoading(false);
        }
    }, [expanded, isStateModifying]);

    const call = useCallback(async () => {
        try {
            setIsResponseLoading(true);
            setResult(null);
            setError(null);
            const callArgs = frag.inputs.map((input, index) => buildParamValue(input, args[index] ?? createEmptyParamValue(input)));
            if (isStateModifying) {
                const overrides = isPayable ? { value: toWeiValue(valueAmount, valueUnit) } : undefined;
                const resp: ethers.ContractTransactionResponse = await contract.getFunction(frag)(...(overrides ? [...callArgs, overrides] : callArgs));
                setResult({kind: "transaction", status: "submitted", hash: resp.hash});
                const receipt: ethers.ContractTransactionReceipt | null = await resp.wait(1, 60000);
                setResult(receipt ? {
                    kind: "transaction",
                    status: receipt.status === 1 ? "confirmed" : "failed",
                    hash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                } : {kind: "transaction", status: "pending", hash: resp.hash});
            } else {
                const resp = await contract.getFunction(frag).staticCall(...callArgs);
                setResult({kind: "function", outputs: frag.outputs, value: resp});
            }
        } catch (error) {
            const normalized = normalizeError(error, isStateModifying ? "Transaction failed" : "Call failed");
            setResult((current) => current?.kind === "transaction"
                ? {...current, status: normalized.code === "CALL_EXCEPTION" ? "failed" : "pending"}
                : current);
            setError(normalized);
        } finally {
            setIsResponseLoading(false);
        }
    }, [args, contract, frag, isPayable, isStateModifying, valueAmount, valueUnit]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Stack spacing={0.25}>
                    <Typography sx={{fontWeight: 700}}>{frag.name || frag.format("sighash")}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {frag.format("full")}
                    </Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
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
                        {isPayable && (
                            <TransactionValueInput
                                amount={valueAmount}
                                unit={valueUnit}
                                onAmountChange={setValueAmount}
                                onUnitChange={setValueUnit}
                                label="Transaction value"
                            />
                        )}
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            disabled={isResponseLoading}
                            onClick={() => call()}
                            sx={{mt: 1, py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                        >
                            {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : buttonLabel}
                        </Button>
                    </Stack>
                </Paper>
                <CallResult result={result} />
            </AccordionDetails>
            <ErrorDialog error={error} onClose={() => setError(null)}/>
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
    const [metadataError, setMetadataError] = useState<NormalizedError | null>(null);

    useEffect(() => {
        if(wallet?.provider){
            (new ethers.BrowserProvider(wallet.provider)).getSigner()
                .then((nextSigner) => setSigner(nextSigner))
                .catch((error) => {
                    setSigner(null);
                    setMetadataError(normalizeError(error, "Wallet connection failed"));
                });
        }else {
            setSigner(null);
        }
     }, [wallet]);

    useEffect(() => {
        contract.getAddress()
            .then((nextAddress) => setAddress(nextAddress))
            .catch((error) => {
                setAddress('Address unavailable');
                setMetadataError(normalizeError(error, "Contract details unavailable"));
            });
    }, [contract]);

    useEffect(() => {
        if(signer) {
            signer.provider?.getNetwork()
                .then((network) => setChainId(network.chainId.toString()))
                .catch((error) => {
                    setChainId('');
                    setMetadataError(normalizeError(error, "Network details unavailable"));
                });
        } else {
            setChainId('');
        }
    }, [signer]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header" expandIcon={<ExpandMoreIcon />}>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={6}>
                        <Box sx={{m: 1, display: "flex", alignItems: "center", gap: 0.5}}>
                            <Typography sx={{fontWeight: 700, wordBreak: "break-all"}}>{address}</Typography>
                            {ethers.isAddress(address) && <CopyButton value={address} label="Copy contract address" />}
                        </Box>
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
                          aria-label="Delete contract instance"
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
            <ErrorDialog error={metadataError} onClose={() => setMetadataError(null)} />
      </Accordion>);
}
