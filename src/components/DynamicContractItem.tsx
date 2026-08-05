import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress, Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { ethers } from "ethers";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";
import CallResult from "./CallResult";
import CopyButton from "./CopyButton";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { buildParamValues, createEmptyParamValue, ParamValue, ValueUnit } from "../calls/parameters";
import { prepareAbiCall } from "../calls/prepareCall";
import { useTransactionPlan } from "../transaction-plan/context";
import FunctionCallEditor from "./FunctionCallEditor";

interface DynamicFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
}

export function DynamicFunctionItem({contract, frag}: DynamicFunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [isQueueing, setIsQueueing] = useState(false);
    const [queued, setQueued] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));
    const isStateModifying = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";

    useEffect(() => {
        if(!expanded && isStateModifying){
            setResult(null);
            setIsResponseLoading(false);
            setQueued(false);
        }
    }, [expanded, isStateModifying]);

    const call = useCallback(async () => {
        try {
            setIsResponseLoading(true);
            setResult(null);
            setError(null);
            if (isStateModifying) {
                if (!wallet.account || !wallet.chainId || typeof contract.runner?.sendTransaction !== "function") {
                    throw Object.assign(new Error("The connected wallet is not ready to send this transaction."), {code: "WALLET_DISCONNECTED"});
                }
                const prepared = prepareAbiCall({
                    fragment: frag,
                    target: await contract.getAddress(),
                    account: wallet.account,
                    chainId: wallet.chainId,
                    argumentValues: args,
                    valueAmount,
                    valueUnit,
                });
                const resp: ethers.TransactionResponse = await contract.runner.sendTransaction({
                    to: prepared.to,
                    data: prepared.data,
                    value: prepared.value,
                });
                setResult({kind: "transaction", status: "submitted", hash: resp.hash});
                const receipt: ethers.TransactionReceipt | null = await resp.wait(1, 60000);
                setResult(receipt ? {
                    kind: "transaction",
                    status: receipt.status === 1 ? "confirmed" : "failed",
                    hash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                } : {kind: "transaction", status: "pending", hash: resp.hash});
            } else {
                const callArgs = buildParamValues(frag.inputs, args);
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
    }, [args, contract, frag, isStateModifying, valueAmount, valueUnit, wallet.account, wallet.chainId]);

    const addToQueue = useCallback(async () => {
        try {
            setIsQueueing(true);
            setQueued(false);
            setError(null);
            if (!wallet.account || !wallet.chainId) {
                throw Object.assign(new Error("Connect a wallet before adding calls to the plan."), {code: "WALLET_DISCONNECTED"});
            }
            const prepared = prepareAbiCall({
                fragment: frag,
                target: await contract.getAddress(),
                account: wallet.account,
                chainId: wallet.chainId,
                argumentValues: args,
                valueAmount,
                valueUnit,
            });
            transactionPlan.dispatch({type: "ADD_CALL", call: prepared});
            setQueued(true);
        } catch (queueError) {
            setError(normalizeError(queueError, "Could not add call"));
        } finally {
            setIsQueueing(false);
        }
    }, [args, contract, frag, transactionPlan, valueAmount, valueUnit, wallet.account, wallet.chainId]);

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
                        <FunctionCallEditor
                            fragment={frag}
                            arguments={args}
                            onArgumentsChange={setArgs}
                            valueAmount={valueAmount}
                            valueUnit={valueUnit}
                            onValueAmountChange={setValueAmount}
                            onValueUnitChange={setValueUnit}
                        />
                        {isStateModifying ? (
                            <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    fullWidth
                                    disabled={isQueueing || isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                                    onClick={addToQueue}
                                    sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                                >
                                    {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to queue"}
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    fullWidth
                                    disabled={isResponseLoading || isQueueing}
                                    onClick={() => call()}
                                    sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                                >
                                    {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Send immediately"}
                                </Button>
                            </Stack>
                        ) : (
                            <Button
                                variant="contained"
                                color="secondary"
                                fullWidth
                                disabled={isResponseLoading}
                                onClick={() => call()}
                                sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                            >
                                {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Run call"}
                            </Button>
                        )}
                        {queued && <Alert severity="success">Added to transaction queue.</Alert>}
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
    const {signer, chainId: walletChainId, error: walletError, clearError: clearWalletError} = useWalletSession();
    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');
    const [metadataError, setMetadataError] = useState<NormalizedError | null>(null);

    useEffect(() => {
        contract.getAddress()
            .then((nextAddress) => setAddress(nextAddress))
            .catch((error) => {
                setAddress('Address unavailable');
                setMetadataError(normalizeError(error, "Contract details unavailable"));
            });
    }, [contract]);

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
                        <Typography sx={{m: 1, width: 1}} color="text.secondary">Chain ID: {walletChainId ?? ''}</Typography>
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
            <ErrorDialog error={metadataError ?? walletError} onClose={() => {
                setMetadataError(null);
                clearWalletError();
            }} />
      </Accordion>);
}
