import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    Stack,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ethers } from "ethers";
import { useSimulation } from "../../simulation/context";
import { BalanceChange, PlanSimulatedCall, TokenMetadata } from "../../simulation/types";
import { useTransactionPlan } from "../../transaction-plan/context";
import { formatBalanceChangeAmount, formatEventArgument, metadataForToken, tokenLabel } from "../../simulation/tokenFormatting";

const statusLabels = {
    idle: "Unavailable",
    waiting: "Queued",
    simulating: "Previewing",
    ready: "Ready",
    stale: "Stale",
    error: "Unavailable",
} as const;

function decimalQuantity(value: string) {
    try {
        return ethers.getBigInt(value).toLocaleString("en-US");
    } catch {
        return value;
    }
}

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function CallPreview({
    call,
    label,
    chainId,
    metadataByAddress,
}: {
    call: PlanSimulatedCall;
    label: string;
    chainId: string;
    metadataByAddress: Record<string, TokenMetadata>;
}) {
    return (
        <Box sx={{py: 1.25}}>
            <Stack spacing={0.75}>
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                    <Typography variant="body2" sx={{fontWeight: 700, overflowWrap: "anywhere"}}>{label}</Typography>
                    <Chip
                        size="small"
                        label={call.status === "0x1" ? "Success" : "Reverted"}
                        color={call.status === "0x1" ? "success" : "error"}
                    />
                </Box>
                <Typography variant="caption" color="text.secondary">{decimalQuantity(call.gasUsed)} gas used</Typography>
                {call.decodedRevert && (
                    <Alert severity="error" variant="outlined" sx={{py: 0}}>
                        <strong>{call.decodedRevert.name}:</strong> {call.decodedRevert.message}
                    </Alert>
                )}
                {call.decodedEvents.length > 0 && (
                    <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">Emitted events</Typography>
                        {call.decodedEvents.map((event, index) => {
                            const metadata = metadataForToken(metadataByAddress, chainId, event.address);
                            return (
                            <Box key={`${event.address}:${event.signature}:${index}`} sx={{pl: 1, borderLeft: "2px solid", borderColor: "divider"}}>
                                <Typography variant="caption" sx={{fontWeight: 700}}>{event.name}</Typography>
                                {event.arguments.length > 0 && (
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{overflowWrap: "anywhere"}}>
                                        {event.arguments.map((argument) => `${argument.name}: ${formatEventArgument(event, argument, metadata)}`).join(" · ")}
                                    </Typography>
                                )}
                            </Box>
                            );
                        })}
                    </Stack>
                )}
                {call.logs.length > call.decodedEvents.length && (
                    <Typography variant="caption" color="text.secondary">
                        {call.logs.length - call.decodedEvents.length} undecoded {(call.logs.length - call.decodedEvents.length) === 1 ? "log" : "logs"}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}

function BalanceChangeRow({change, chainId, metadataByAddress}: {
    change: BalanceChange;
    chainId: string;
    metadataByAddress: Record<string, TokenMetadata>;
}) {
    const metadata = change.asset === "erc20" ? metadataForToken(metadataByAddress, chainId, change.tokenAddress) : undefined;
    const tokenAddress = change.tokenAddress ?? "";
    return (
        <Box sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1}}>
            <Typography variant="caption" color="text.secondary">
                {change.asset === "native" ? "Native asset" : `${tokenLabel(tokenAddress, metadata)} · ${shortAddress(tokenAddress)}`}
            </Typography>
            <Typography variant="body2" sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", textAlign: "right"}}>
                {formatBalanceChangeAmount(change, metadata)}
            </Typography>
        </Box>
    );
}

export default function InteractSimulationPreview() {
    const simulation = useSimulation();
    const {state} = useTransactionPlan();
    const snapshot = simulation.snapshot;
    const labels = new Map(state.plan.calls.map((call, index) => [
        call.id,
        `${index + 1}. ${call.display.functionSignature ?? "Raw transaction"}`,
    ]));
    const accountChanges = snapshot?.balanceChanges.filter(
        (change) => change.account.toLowerCase() === snapshot.account.toLowerCase(),
    ) ?? [];

    return (
        <Accordion
            disableGutters
            elevation={0}
            sx={{border: "1px solid", borderColor: "divider", borderRadius: "8px !important", "&:before": {display: "none"}}}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="interact-preview-content" id="interact-preview-header">
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, width: 1, pr: 1}}>
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Speculative preview</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {snapshot ? `Base block ${decimalQuantity(snapshot.baseBlockNumber)}` : "Queued writes only"}
                        </Typography>
                    </Box>
                    <Chip
                        size="small"
                        label={statusLabels[simulation.status]}
                        color={simulation.status === "ready" ? "success" : simulation.status === "error" ? "error" : "default"}
                    />
                </Box>
            </AccordionSummary>
            <AccordionDetails id="interact-preview-content" sx={{pt: 0}}>
                <Stack spacing={1.25}>
                    <Typography variant="caption" color="text.secondary">
                        Speculative results only. Execution still uses the connected wallet.
                    </Typography>
                    {!simulation.configured && (
                        <Alert severity="info">
                            No compatible simulation RPC is available. Switch to Simulate to check the connected wallet RPC.
                        </Alert>
                    )}
                    {(simulation.status === "waiting" || simulation.status === "simulating") && !snapshot && (
                        <Typography variant="body2">Preparing the queue preview…</Typography>
                    )}
                    {simulation.status === "stale" && snapshot && (
                        <Alert severity="warning">This preview is stale and does not match the current queue.</Alert>
                    )}
                    {simulation.status === "simulating" && snapshot && (
                        <Alert severity="info">Refreshing the preview; the results below are from the previous queue revision.</Alert>
                    )}
                    {simulation.status === "error" && snapshot && (
                        <Alert severity="warning">Showing the last successful preview. It may be stale.</Alert>
                    )}
                    {simulation.error && (
                        <Alert
                            severity="error"
                            action={<Button color="inherit" size="small" disabled={!simulation.active} onClick={simulation.retry}>Retry</Button>}
                        >
                            {simulation.error.message}
                        </Alert>
                    )}
                    {snapshot && (
                        <>
                            <Stack divider={<Divider flexItem />}>
                                {snapshot.calls.map((call, index) => (
                                    <CallPreview
                                        key={call.callId}
                                        call={call}
                                        label={labels.get(call.callId) ?? `${index + 1}. Previous queued call`}
                                        chainId={snapshot.chainId}
                                        metadataByAddress={simulation.tokenMetadataByAddress}
                                    />
                                ))}
                            </Stack>
                            <Divider />
                            <Stack spacing={0.75}>
                                <Typography variant="subtitle2" sx={{fontWeight: 800}}>Plan account balance changes</Typography>
                                {simulation.tokenMetadataResolving && accountChanges.some((change) => change.asset === "erc20") && (
                                    <Typography variant="caption" color="text.secondary">Resolving token metadata…</Typography>
                                )}
                                {accountChanges.length > 0
                                    ? accountChanges.map((change) => (
                                        <BalanceChangeRow
                                            key={`${change.asset}:${change.tokenAddress ?? "native"}`}
                                            change={change}
                                            chainId={snapshot.chainId}
                                            metadataByAddress={simulation.tokenMetadataByAddress}
                                        />
                                    ))
                                    : <Typography variant="caption" color="text.secondary">No supported balance changes detected.</Typography>}
                            </Stack>
                        </>
                    )}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
