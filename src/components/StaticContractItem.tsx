import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Grid, IconButton, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ParamInput, { createEmptyParamValue, ParamValue } from "./ParamInput";
import ErrorDialog from "./ErrorDialog";
import RawCall from "./RawCall";
import { ProviderDetails } from "../presets";
import CallResult from "./CallResult";
import CopyButton from "./CopyButton";
import { CallResultData, NormalizedError, normalizeError } from "../callUtils";
import { useSimulation } from "../simulation/context";
import { decodeFunctionRead, encodeFunctionRead } from "../calls/readCall";
import ReadActions, { ReadLoadingMode } from "./ReadActions";
import { useSimulatedRead } from "../simulation/useSimulatedRead";
import { useWorkspaceMode } from "../workspace/context";
import { prepareAbiWatch } from "../simulation/watchExpressions";
import { usePinWatch } from "../simulation/usePinWatch";
import { FunctionMutabilityBadge } from "./ContractFunctionSection";
import ContractFunctionBrowser from "./ContractFunctionBrowser";

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
    const [loading, setLoading] = useState<ReadLoadingMode>(null);
    const [result, setResult] = useState<CallResultData | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const simulatedRead = useSimulatedRead(chainId);
    const workspace = useWorkspaceMode();
    const watchPin = usePinWatch(chainId);

    const [args, setArgs] = useState<ParamValue[]>(() => frag.inputs.map((input) => createEmptyParamValue(input)));

    const isDisabled = frag.stateMutability === "nonpayable" || frag.stateMutability === "payable";
    const simulationAvailable = workspace.mode === "simulate" && !isDisabled && simulatedRead.available;

    useEffect(() => {
        setResult((current) => current?.kind !== "transaction" && current?.source.kind === "simulated" ? null : current);
    }, [simulatedRead.revision, workspace.mode]);

    const call = useCallback(async () => {
        try {
            setLoading("onchain");
            setResult(null);
            setError(null);
            const encoded = encodeFunctionRead(frag, args);
            const resp = await contract.getFunction(frag)(...encoded.args);
            setResult({kind: "function", outputs: frag.outputs, value: resp, source: {kind: "onchain"}});
        } catch (error) {
            setError(normalizeError(error));
        } finally {
            setLoading(null);
        }
    }, [args, contract, frag]);

    const runSimulated = useCallback(async () => {
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
    }, [args, contract, frag, simulatedRead]);

    const pinWatch = useCallback(async () => {
        try {
            await watchPin.pin(async (context) => prepareAbiWatch({fragment: frag, argumentValues: args, target: await contract.getAddress(), context}));
        } catch (watchError) {
            setError(normalizeError(watchError, "Could not pin watch"));
        }
    }, [args, contract, frag, watchPin]);

    return (
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls={contentId} id={summaryId} expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{width: 1}}>
                    <Stack spacing={0.25} sx={{minWidth: 0}}>
                        <Typography color={isDisabled ? 'text.secondary' : 'text.primary'} sx={{fontWeight: 700}}>
                            {frag.name || frag.format("sighash")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>
                            {frag.format("full")}
                        </Typography>
                    </Stack>
                    <Box sx={{pr: 0.5}}>
                        <FunctionMutabilityBadge fragment={frag} />
                    </Box>
                </Stack>
            </AccordionSummary>
            <AccordionDetails id={contentId} aria-labelledby={summaryId} sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
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
                                simulationEnabled={simulatedRead.enabled}
                                simulationAvailable={simulationAvailable}
                                onChainAvailable={typeof contract.runner?.call === "function"}
                                loading={simulatedRead.loading ? "simulated" : loading}
                                onSimulated={() => void runSimulated()}
                                onOnChain={() => void call()}
                                onPinWatch={() => void pinWatch()}
                                canPinWatch={watchPin.canPin}
                            />
                            {watchPin.notice && <Alert severity="info" onClose={watchPin.clearNotice}>{watchPin.notice}</Alert>}
                        </Stack>
                        <CallResult result={result} />
                    </>
                )}
            </AccordionDetails>
            <ErrorDialog error={error} onClose={() => setError(null)}/>
        </Accordion>
    );
}

interface StaticContractItemProps {
    contractId?: string;
    contract: ethers.BaseContract; 
    del: () => void;
    providerDetails?: ProviderDetails;
}

export default function StaticContractItem({contractId = "static-contract", contract, del, providerDetails}: StaticContractItemProps){
    const accordionId = useId();
    const summaryId = `${accordionId}-summary`;
    const contentId = `${accordionId}-content`;
    const [expanded, setExpanded] = useState(false);
    const [address, setAddress] = useState('loading...');
    const [detectedChainId, setDetectedChainId] = useState<string>('');
    const [metadataError, setMetadataError] = useState<NormalizedError | null>(null);
    const simulation = useSimulation();
    const workspace = useWorkspaceMode();

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
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{borderRadius: 2, overflow: 'hidden'}}>
            <AccordionSummary aria-controls={contentId} id={summaryId} expandIcon={<ExpandMoreIcon />}>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={6}>
                        <Stack spacing={0.25} sx={{m: 1}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                <Typography sx={{fontWeight: 700, wordBreak: "break-all"}}>{address}</Typography>
                                {ethers.isAddress(address) && <CopyButton value={address} label="Copy contract address" />}
                            </Box>
                            <Typography variant="caption" color="text.secondary">Read-only contract</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} md={3} sx={{minWidth: 0}}>
                        <Stack spacing={0.25} sx={{m: 1, minWidth: 0}}>
                            <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700}}>
                                {providerDetails?.label ?? "RPC provider"}
                            </Typography>
                            {providerDetails?.url ? (
                                <Box sx={{minWidth: 0, fontSize: "0.75rem"}}>
                                    <CopyButton value={providerDetails.url} label="Copy RPC URL" variant="url" />
                                </Box>
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
            <AccordionDetails id={contentId} aria-labelledby={summaryId} sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {workspace.mode === "simulate" && simulation.active && chainId && simulation.chainId !== chainId && (
                <Alert severity="info">Queued-state simulation belongs to chain {simulation.chainId}; this contract is on chain {chainId}.</Alert>
            )}
            <ContractFunctionBrowser
                    contractId={contractId}
                    readDescription={workspace.mode === "simulate"
                        ? "Read canonical state or speculative queued state without sending a transaction."
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
            </AccordionDetails>
            <ErrorDialog error={metadataError} onClose={() => setMetadataError(null)} />
      </Accordion>);
}
