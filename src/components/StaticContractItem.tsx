import { AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useEffect, useId, useMemo, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ParamInput, { createEmptyParamValue, ParamValue } from "./ParamInput";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";
import { ProviderDetails } from "../presets";
import CallResult from "./CallResult";
import CopyButton from "./CopyButton";
import { useCallActions } from "./useCallActions";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { useSimulation } from "../simulation/context";
import { decodeFunctionRead, encodeFunctionRead } from "../calls/readCall";
import ReadActions from "./ReadActions";
import { prepareAbiWatch } from "../simulation/watchExpressions";
import { FunctionAccordion, FunctionMutabilityBadge } from "./ContractFunctionSection";
import { monoFont } from "../ui/theme";
import ContractFunctionBrowser from "./ContractFunctionBrowser";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";

interface StaticFunctionItemProps {
    contract: ethers.BaseContract;
    frag: ethers.FunctionFragment;
    chainId: string;
}

export function StaticFunctionItem({contract, frag, chainId}: StaticFunctionItemProps){
    const accordionId = useId();
    const summaryId = `${accordionId}-summary`;
    const contentId = `${accordionId}-content`;
    const [expanded, setExpanded] = useState(false);
    const actions = useCallActions({chainId});
    const planUi = useTransactionPlanUi();
    const {watchPin, result, error, setError} = actions;

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));

    const isDisabled = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";
    const simulationAvailable = !isDisabled && actions.simulationAvailable;

    return (
        <FunctionAccordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
            <AccordionSummary aria-controls={contentId} id={summaryId} expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{width: 1}}>
                    <Typography color={isDisabled ? 'text.secondary' : 'text.primary'} sx={{fontWeight: 700, overflowWrap: "anywhere", minWidth: 0, flex: 1}}>
                        {frag.format("sighash")}
                    </Typography>
                    <Box sx={{pr: 0.5}}>
                        <FunctionMutabilityBadge fragment={frag} />
                    </Box>
                </Stack>
            </AccordionSummary>
            <AccordionDetails id={contentId} aria-labelledby={summaryId} sx={{display: 'flex', flexDirection: 'column', gap: 1, pt: 0}}>
                <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>
                    {frag.format("full")}
                </Typography>
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
                            <ReadActions
                                simulationAvailable={simulationAvailable}
                                onChainAvailable={typeof contract.runner?.call === "function"}
                                loading={actions.readActionsLoading}
                                onSimulated={() => void actions.runSimulated(
                                    async () => ({to: await contract.getAddress(), data: encodeFunctionRead(frag, args).data}),
                                    (completed) => ({
                                        kind: "function",
                                        outputs: frag.outputs,
                                        value: decodeFunctionRead(frag, completed.result.returnData),
                                        source: {kind: "simulated", queuedCallCount: completed.queuedCallCount},
                                    }),
                                    "Simulated read failed",
                                )}
                                onOnChain={() => void actions.runOnchainRead(async (): Promise<CallResultData> => {
                                    const encoded = encodeFunctionRead(frag, args);
                                    const resp = await contract.getFunction(frag)(...encoded.args);
                                    return {kind: "function", outputs: frag.outputs, value: resp, source: {kind: "onchain"}};
                                })}
                                onPinWatch={() => void actions.pinWatch(async (context) => prepareAbiWatch({fragment: frag, argumentValues: args, target: await contract.getAddress(), context}))}
                                canPinWatch={watchPin.canPin}
                            />
                            {watchPin.notice && <Alert severity="info" onClose={watchPin.clearNotice} action={<Button size="small" onClick={planUi.requestExecution}>Review</Button>}>{watchPin.notice}</Alert>}
                        </Stack>
                        <CallResult result={result} />
                    </>
                )}
            </AccordionDetails>
            <ErrorDialog error={error} onClose={() => setError(null)}/>
        </FunctionAccordion>
    );
}

interface StaticContractItemProps {
    contractId?: string;
    contract: ethers.BaseContract; 
    providerDetails?: ProviderDetails;
}

export default function StaticContractItem({contractId = "static-contract", contract, providerDetails}: StaticContractItemProps){
    const [address, setAddress] = useState('loading...');
    const [detectedChainId, setDetectedChainId] = useState<string>('');
    const [metadataError, setMetadataError] = useState<NormalizedError | null>(null);
    const simulation = useSimulation();

    useEffect(() => {
        contract.getAddress()
            .then((nextAddress) => setAddress(nextAddress))
            .catch((error) => {
                setAddress('Address unavailable');
                setMetadataError(normalizeError(error, "Contract details unavailable"));
            });
        if (!providerDetails?.chainId) {
            contract.runner?.provider?.getNetwork()
                .then((network) => setDetectedChainId(network.chainId.toString()))
                .catch((error) => setMetadataError(normalizeError(error, "Network details unavailable")));
        }
    }, [contract, providerDetails?.chainId]);

    const chainId = providerDetails?.chainId || detectedChainId;
    const functions = useMemo(
        () => contract.interface.fragments.filter((fragment): fragment is ethers.FunctionFragment => fragment.type === "function"),
        [contract.interface],
    );

    return (
        <Stack spacing={2}>
            <Box sx={{display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0}}>
                <Box sx={{display: "flex", alignItems: "center", gap: 0.5, minWidth: 0}}>
                    <Typography variant="subtitle1" sx={{fontFamily: monoFont, fontWeight: 700, wordBreak: "break-all"}}>{address}</Typography>
                    {ethers.isAddress(address) && <CopyButton value={address} label="Copy contract address" />}
                </Box>
                <Chip size="small" variant="outlined" label={chainId ? `Chain ${chainId}` : "Detecting chain"} />
                <Chip size="small" variant="outlined" label={providerDetails?.label ?? "Read-only"} />
                {providerDetails?.url && <CopyButton value={providerDetails.url} label="Copy RPC URL" variant="url" />}
            </Box>
            {simulation.active && chainId && simulation.chainId !== chainId && (
                <Alert severity="info">Speculative simulation belongs to chain {simulation.chainId}; this contract is on chain {chainId}.</Alert>
            )}
            <ContractFunctionBrowser
                    contractId={contractId}
                    readDescription={chainId && simulation.canSimulateChain(chainId)
                        ? "Read canonical state or speculative plan state without sending a transaction."
                        : "Read canonical on-chain state without sending a transaction."}
                    functions={functions}
                    renderFunction={(fragment) => (
                        <StaticFunctionItem key={fragment.format("minimal")} frag={fragment} contract={contract} chainId={chainId} />
                    )}
                    writeTitle="Write functions · wallet required"
                    writeDescription="Add this contract using Browser Wallet to call these functions."
                    writeCollapsible
                />
            <RawCall contract={contract} isStaticOnly={true} chainId={chainId}/>
            <ErrorDialog error={metadataError} onClose={() => setMetadataError(null)} />
        </Stack>
    );
}
