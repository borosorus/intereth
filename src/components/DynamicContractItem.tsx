import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress, Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { decoderAbiForInterface, prepareAbiCall } from "../calls/prepareCall";
import { useTransactionPlan } from "../transaction-plan/context";
import FunctionCallEditor from "./FunctionCallEditor";
import { useSimulation } from "../simulation/context";
import { decodeFunctionRead, encodeFunctionRead } from "../calls/readCall";
import ReadActions, { ReadLoadingMode } from "./ReadActions";
import { useSimulatedRead } from "../simulation/useSimulatedRead";
import ApprovalRecoveryDialog, { ApprovalRecoveryRequest } from "./ApprovalRecoveryDialog";
import { detectErc20ApprovalRequirement } from "../transactions/approvalRecovery";
import { sendPreparedTransaction } from "../transactions/sendTransaction";
import { QueuedCall } from "../transaction-plan/types";
import { useWorkspaceMode } from "../workspace/context";
import { prepareAbiWatch } from "../simulation/watchExpressions";

interface DynamicFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
    disabled?: boolean;
    chainId?: string;
}

export function DynamicFunctionItem({contract, frag, disabled = false, chainId}: DynamicFunctionItemProps){
    const [expanded, setExpanded] = useState(false);
    const [isResponseLoading, setIsResponseLoading] = useState(false);
    const [isQueueing, setIsQueueing] = useState(false);
    const [queued, setQueued] = useState(false);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");
    const [readLoading, setReadLoading] = useState<ReadLoadingMode>(null);
    const [approvalRecovery, setApprovalRecovery] = useState<ApprovalRecoveryRequest | null>(null);
    const [watchNotice, setWatchNotice] = useState<string | null>(null);
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const simulatedRead = useSimulatedRead(chainId);
    const workspace = useWorkspaceMode();

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));
    const isStateModifying = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";
    const simulationAvailable = workspace.mode === "simulate" && !isStateModifying && simulatedRead.available;

    useEffect(() => {
        setResult((current) => current?.kind !== "transaction" && current?.source.kind === "simulated" ? null : current);
    }, [simulatedRead.revision]);

    useEffect(() => {
        if(!expanded && isStateModifying){
            setResult(null);
            setIsResponseLoading(false);
            setQueued(false);
            setApprovalRecovery(null);
        }
    }, [expanded, isStateModifying]);

    const call = useCallback(async () => {
        let attemptedCall: QueuedCall | null = null;
        try {
            setIsResponseLoading(true);
            setResult(null);
            setError(null);
            if (isStateModifying) {
                if (!wallet.account || !wallet.chainId || !wallet.signer) {
                    throw Object.assign(new Error("The connected wallet is not ready to send this transaction."), {code: "WALLET_DISCONNECTED"});
                }
                attemptedCall = prepareAbiCall({
                    fragment: frag,
                    decoderAbi: decoderAbiForInterface(contract.interface),
                    target: await contract.getAddress(),
                    account: wallet.account,
                    chainId: wallet.chainId,
                    argumentValues: args,
                    valueAmount,
                    valueUnit,
                });
                await sendPreparedTransaction(wallet.signer, attemptedCall, setResult);
            } else {
                setReadLoading("onchain");
                const callArgs = buildParamValues(frag.inputs, args);
                const resp = await contract.getFunction(frag).staticCall(...callArgs);
                setResult({kind: "function", outputs: frag.outputs, value: resp, source: {kind: "onchain"}});
            }
        } catch (caughtError) {
            const approvalRequirement = attemptedCall ? detectErc20ApprovalRequirement(caughtError) : null;
            if (attemptedCall && approvalRequirement) {
                setApprovalRecovery({requirement: approvalRequirement, originalCall: attemptedCall});
                return;
            }
            const normalized = normalizeError(caughtError, isStateModifying ? "Transaction failed" : "Call failed");
            setResult((current) => current?.kind === "transaction"
                ? {...current, status: normalized.code === "CALL_EXCEPTION" ? "failed" : "pending"}
                : current);
            setError(normalized);
        } finally {
            setIsResponseLoading(false);
            setReadLoading(null);
        }
    }, [args, contract, frag, isStateModifying, valueAmount, valueUnit, wallet.account, wallet.chainId, wallet.signer]);

    const runSimulated = useCallback(async () => {
        if (!chainId) return;
        try {
            setResult(null);
            setError(null);
            const encoded = encodeFunctionRead(frag, args);
            const completed = await simulatedRead.run({
                to: await contract.getAddress(),
                data: encoded.data,
            });
            if (!completed) return;
            setResult({
                kind: "function",
                outputs: frag.outputs,
                value: decodeFunctionRead(frag, completed.result.returnData),
                source: {kind: "simulated", queuedCallCount: completed.queuedCallCount},
            });
        } catch (simulationError) {
            setError(normalizeError(simulationError, "Simulated read failed"));
        }
    }, [args, chainId, contract, frag, simulatedRead]);

    const pinWatch = useCallback(async () => {
        const context = transactionPlan.state.plan.context;
        if (!context || !chainId || context.chainId !== chainId) return;
        try {
            const watch = prepareAbiWatch({fragment: frag, argumentValues: args, target: await contract.getAddress(), context});
            const duplicate = transactionPlan.state.plan.watches.some((current) => current.to.toLowerCase() === watch.to.toLowerCase()
                && current.data.toLowerCase() === watch.data.toLowerCase()
                && current.value === watch.value);
            if (duplicate) {
                setWatchNotice("This watch is already pinned.");
                return;
            }
            transactionPlan.dispatch({type: "ADD_WATCH", watch});
            setWatchNotice("Watch pinned.");
        } catch (watchError) {
            setError(normalizeError(watchError, "Could not pin watch"));
        }
    }, [args, chainId, contract, frag, transactionPlan]);

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
                decoderAbi: decoderAbiForInterface(contract.interface),
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
                                    disabled={disabled || isQueueing || isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                                    onClick={addToQueue}
                                    sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                                >
                                    {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to queue"}
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    fullWidth
                                    disabled={disabled || isResponseLoading || isQueueing}
                                    onClick={() => call()}
                                    sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                                >
                                    {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Send immediately"}
                                </Button>
                            </Stack>
                        ) : (
                            <ReadActions
                                simulationEnabled={simulatedRead.enabled}
                                simulationAvailable={simulationAvailable}
                                onChainAvailable={!disabled && typeof contract.runner?.call === "function"}
                                loading={simulatedRead.loading ? "simulated" : isResponseLoading ? readLoading : null}
                                onSimulated={() => void runSimulated()}
                                onOnChain={() => void call()}
                                onPinWatch={() => void pinWatch()}
                                canPinWatch={workspace.mode === "simulate" && transactionPlan.canEdit && transactionPlan.state.plan.context?.chainId === chainId}
                            />
                        )}
                        {queued && <Alert severity="success">Added to transaction queue.</Alert>}
                        {watchNotice && <Alert severity="info" onClose={() => setWatchNotice(null)}>{watchNotice}</Alert>}
                    </Stack>
                </Paper>
                <CallResult result={result} />
            </AccordionDetails>
            <ErrorDialog error={error} onClose={() => setError(null)}/>
            <ApprovalRecoveryDialog
                request={approvalRecovery}
                onClose={() => setApprovalRecovery(null)}
                onOriginalResult={setResult}
            />
        </Accordion>
    );
}

interface DynamicContractItemProps {
    contract: ethers.BaseContract; 
    walletChainId: string;
    del: () => void;
}

export default function DynamicContractItem({contract, walletChainId: contractChainId, del}: DynamicContractItemProps){
    const {signer, chainId: activeWalletChainId, error: walletError, clearError: clearWalletError} = useWalletSession();
    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');
    const [metadataError, setMetadataError] = useState<NormalizedError | null>(null);
    const simulation = useSimulation();
    const workspace = useWorkspaceMode();
    const walletReady = Boolean(signer && activeWalletChainId === contractChainId);
    const activeContract = useMemo(
        () => contract.connect(walletReady ? signer : null),
        [contract, signer, walletReady],
    );

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
                        <Typography sx={{m: 1, width: 1}} color="text.secondary">Chain ID: {contractChainId}</Typography>
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
            {!walletReady && (
                <Alert severity="info">
                    Connect a browser wallet on chain {contractChainId} to send transactions or run on-chain reads.
                    {workspace.mode === "simulate" && simulation.canSimulateChain(contractChainId) ? " Queued-state simulated reads remain available." : ""}
                </Alert>
            )}
            {workspace.mode === "simulate" && simulation.active && simulation.chainId !== contractChainId && (
                <Alert severity="info">Queued-state simulation belongs to chain {simulation.chainId}; this contract is on chain {contractChainId}.</Alert>
            )}
            <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
              <Stack spacing={1.5}>
                {contract.interface.fragments
                    .filter((f) => f.type === "function")
                    .map((f)=> (
                        <DynamicFunctionItem
                            key={f.format("minimal")}
                            frag={f as ethers.FunctionFragment}
                            contract={activeContract}
                            disabled={!walletReady}
                            chainId={contractChainId}
                        />
                    ))}
              </Stack>
            </Paper>
            <RawCall contract={activeContract} disabled={!walletReady} chainId={contractChainId}/>
            </AccordionDetails>
            <ErrorDialog error={metadataError ?? walletError} onClose={() => {
                setMetadataError(null);
                clearWalletError();
            }} />
      </Accordion>);
}
