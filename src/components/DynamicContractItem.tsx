import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { usePinWatch } from "../simulation/usePinWatch";
import { FunctionMutabilityBadge } from "./ContractFunctionSection";
import ContractFunctionBrowser from "./ContractFunctionBrowser";

interface DynamicFunctionItemProps {
    contract: ethers.BaseContract; 
    frag: ethers.FunctionFragment;
    disabled?: boolean;
    chainId?: string;
}

export function DynamicFunctionItem({contract, frag, disabled = false, chainId}: DynamicFunctionItemProps){
    const accordionId = useId();
    const summaryId = `${accordionId}-summary`;
    const contentId = `${accordionId}-content`;
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
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const simulatedRead = useSimulatedRead(chainId);
    const workspace = useWorkspaceMode();
    const watchPin = usePinWatch(chainId);

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));
    const isStateModifying = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";
    const simulationAvailable = workspace.mode === "simulate" && !isStateModifying && simulatedRead.available;

    useEffect(() => {
        setResult((current) => current?.kind !== "transaction" && current?.source.kind === "simulated" ? null : current);
        if (workspace.mode === "simulate") setApprovalRecovery(null);
    }, [simulatedRead.revision, workspace.mode]);

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
        try {
            await watchPin.pin(async (context) => prepareAbiWatch({fragment: frag, argumentValues: args, target: await contract.getAddress(), context}));
        } catch (watchError) {
            setError(normalizeError(watchError, "Could not pin watch"));
        }
    }, [args, contract, frag, watchPin]);

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
            <AccordionSummary aria-controls={contentId} id={summaryId} expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{width: 1}}>
                    <Typography sx={{fontWeight: 700, overflowWrap: "anywhere"}}>{frag.format("sighash")}</Typography>
                    <Box sx={{pr: 0.5}}>
                        <FunctionMutabilityBadge fragment={frag} />
                    </Box>
                </Stack>
            </AccordionSummary>
            <AccordionDetails id={contentId} aria-labelledby={summaryId} sx={{display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0}}>
                    <Stack spacing={1.5}>
                        <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>
                            {frag.format("full")}
                        </Typography>
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
                                {workspace.mode === "interact" && (
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        fullWidth
                                        disabled={disabled || isResponseLoading || isQueueing}
                                        onClick={() => call()}
                                        sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                                    >
                                        {isResponseLoading ? <CircularProgress size={20} color="inherit" /> : "Send now"}
                                    </Button>
                                )}
                                <Button
                                    variant={workspace.mode === "simulate" ? "contained" : "outlined"}
                                    color={workspace.mode === "simulate" ? "info" : "secondary"}
                                    fullWidth
                                    disabled={disabled || isQueueing || isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                                    onClick={addToQueue}
                                    sx={{py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700}}
                                >
                                    {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to queue"}
                                </Button>
                            </Stack>
                        ) : (
                            <ReadActions
                                simulationAvailable={simulationAvailable}
                                onChainAvailable={!disabled && typeof contract.runner?.call === "function"}
                                loading={simulatedRead.loading ? "simulated" : isResponseLoading ? readLoading : null}
                                onSimulated={() => void runSimulated()}
                                onOnChain={() => void call()}
                                onPinWatch={() => void pinWatch()}
                                canPinWatch={watchPin.canPin}
                            />
                        )}
                        {queued && <Alert severity="success">Added to transaction queue.</Alert>}
                        {watchPin.notice && <Alert severity="info" onClose={watchPin.clearNotice}>{watchPin.notice}</Alert>}
                    </Stack>
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
    contractId?: string;
    contract: ethers.BaseContract; 
    walletChainId: string;
}

export default function DynamicContractItem({contractId = "wallet-contract", contract, walletChainId: contractChainId}: DynamicContractItemProps){
    const {signer, chainId: activeWalletChainId, error: walletError, clearError: clearWalletError} = useWalletSession();
    const [address, setAddress] = useState('loading...');
    const [metadataError, setMetadataError] = useState<NormalizedError | null>(null);
    const simulation = useSimulation();
    const workspace = useWorkspaceMode();
    const walletReady = Boolean(signer && activeWalletChainId === contractChainId);
    const activeContract = useMemo(
        () => contract.connect(walletReady ? signer : null),
        [contract, signer, walletReady],
    );
    const functions = useMemo(
        () => contract.interface.fragments.filter((fragment): fragment is ethers.FunctionFragment => fragment.type === "function"),
        [contract.interface],
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
        <Paper variant="outlined" sx={{borderRadius: 2.5, overflow: 'hidden'}}>
            <Box sx={{p: 1.5, borderBottom: 1, borderColor: "divider"}}>
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
                    <Grid item xs={12} md={3}>
                        <Typography sx={{m: 1, width: 1}} color="text.secondary">Chain ID: {contractChainId}</Typography>
                    </Grid>
                </Grid>
            </Box>
            <Stack spacing={2} sx={{p: {xs: 1.5, md: 2}}}>
            {!walletReady && (
                <Alert severity="info">
                    Connect a browser wallet on chain {contractChainId} to send transactions or run on-chain reads.
                    {workspace.mode === "simulate" && simulation.canSimulateChain(contractChainId) ? " Queued-state simulated reads remain available." : ""}
                </Alert>
            )}
            {workspace.mode === "simulate" && simulation.active && simulation.chainId !== contractChainId && (
                <Alert severity="info">Queued-state simulation belongs to chain {simulation.chainId}; this contract is on chain {contractChainId}.</Alert>
            )}
            <ContractFunctionBrowser
                    contractId={contractId}
                    readDescription={workspace.mode === "simulate"
                        ? "Read canonical state or speculative queued state without modifying the contract."
                        : "Read canonical on-chain state without modifying the contract."}
                    functions={functions}
                    renderFunction={(fragment) => (
                        <DynamicFunctionItem
                            key={fragment.format("minimal")}
                            frag={fragment}
                            contract={activeContract}
                            disabled={!walletReady}
                            chainId={contractChainId}
                        />
                    )}
                    writeDescription="These calls can modify state and may require wallet confirmation."
                />
            <RawCall contract={activeContract} disabled={!walletReady} chainId={contractChainId}/>
            </Stack>
            <ErrorDialog error={metadataError ?? walletError} onClose={() => {
                setMetadataError(null);
                clearWalletError();
            }} />
      </Paper>);
}
