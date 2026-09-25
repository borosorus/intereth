import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Grid, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ethers } from "ethers";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";
import CallResult from "./CallResult";
import CopyButton from "./CopyButton";
import CallActionButtons from "./CallActionButtons";
import { CallWalletContext, useCallActions } from "./useCallActions";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { buildParamValues, createEmptyParamValue, ParamValue, ValueUnit } from "../calls/parameters";
import { decoderAbiForInterface, prepareAbiCall } from "../calls/prepareCall";
import FunctionCallEditor from "./FunctionCallEditor";
import { useSimulation } from "../simulation/context";
import { decodeFunctionRead, encodeFunctionRead } from "../calls/readCall";
import ReadActions from "./ReadActions";
import ApprovalRecoveryDialog from "./ApprovalRecoveryDialog";
import { useWorkspaceMode } from "../workspace/context";
import { prepareAbiWatch } from "../simulation/watchExpressions";
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
    const actions = useCallActions({chainId});
    const {wallet, transactionPlan, watchPin, result, error, setError, queued, resetWriteState} = actions;
    const [valueAmount, setValueAmount] = useState('');
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));
    const isStateModifying = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";
    const simulationAvailable = !isStateModifying && actions.simulationAvailable;

    useEffect(() => {
        if(!expanded && isStateModifying){
            resetWriteState();
        }
    }, [expanded, isStateModifying, resetWriteState]);

    // Authoring ends here: this factory is the only place ABI arguments are
    // turned into a call. Send and queue act on the same prepared call.
    const prepare = useCallback(async ({account, chainId: walletChainId}: CallWalletContext) => prepareAbiCall({
        fragment: frag,
        decoderAbi: decoderAbiForInterface(contract.interface),
        target: await contract.getAddress(),
        account,
        chainId: walletChainId,
        argumentValues: args,
        valueAmount,
        valueUnit,
    }), [args, contract, frag, valueAmount, valueUnit]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls={contentId} id={summaryId} expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{width: 1}}>
                    <Typography sx={{fontWeight: 700, overflowWrap: "anywhere", minWidth: 0, flex: 1}}>{frag.format("sighash")}</Typography>
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
                            <CallActionButtons
                                isSending={actions.isResponseLoading}
                                isQueueing={actions.isQueueing}
                                sendDisabled={disabled || actions.isResponseLoading || actions.isQueueing}
                                queueDisabled={disabled || actions.isQueueing || actions.isResponseLoading || !transactionPlan.canEdit || !wallet.account || !wallet.chainId}
                                onSend={() => void actions.sendNow(prepare)}
                                onQueue={() => void actions.queueCall(prepare)}
                            />
                        ) : (
                            <ReadActions
                                simulationAvailable={simulationAvailable}
                                onChainAvailable={!disabled && typeof contract.runner?.call === "function"}
                                loading={actions.readActionsLoading}
                                onSimulated={() => {
                                    if (!chainId) return;
                                    void actions.runSimulated(
                                        async () => ({to: await contract.getAddress(), data: encodeFunctionRead(frag, args).data}),
                                        (completed) => ({
                                            kind: "function",
                                            outputs: frag.outputs,
                                            value: decodeFunctionRead(frag, completed.result.returnData),
                                            source: {kind: "simulated", queuedCallCount: completed.queuedCallCount},
                                        }),
                                        "Simulated read failed",
                                    );
                                }}
                                onOnChain={() => void actions.runOnchainRead(async (): Promise<CallResultData> => {
                                    const callArgs = buildParamValues(frag.inputs, args);
                                    const resp = await contract.getFunction(frag).staticCall(...callArgs);
                                    return {kind: "function", outputs: frag.outputs, value: resp, source: {kind: "onchain"}};
                                })}
                                onPinWatch={() => void actions.pinWatch(async (context) => prepareAbiWatch({fragment: frag, argumentValues: args, target: await contract.getAddress(), context}))}
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
                request={actions.approvalRequest}
                onClose={actions.clearApprovalRequest}
                onOriginalResult={actions.setResult}
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
                        <Typography sx={{m: 1}} color="text.secondary">RPC: Browser Wallet</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Typography sx={{m: 1}} color="text.secondary">Chain ID: {contractChainId}</Typography>
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
