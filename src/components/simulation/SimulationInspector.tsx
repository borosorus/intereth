import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Chip,
    Divider,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { ethers } from "ethers";
import { useSimulation } from "../../simulation/context";
import { BalanceChange, DecodedEvent, DecodedValue, PlanSimulatedCall, TokenMetadata } from "../../simulation/types";
import { useTransactionPlan } from "../../transaction-plan/context";
import {
    formatBalanceChangeAmount,
    formatEventArgument,
    metadataForToken,
    tokenDescription,
    tokenLabel,
} from "../../simulation/tokenFormatting";

function safeJson(value: unknown) {
    const seen = new WeakSet<object>();
    try {
        return JSON.stringify(value, (_, nested) => {
            if (typeof nested === "bigint") return nested.toString();
            if (typeof nested === "object" && nested !== null) {
                if (seen.has(nested)) return "[Circular]";
                seen.add(nested);
            }
            return nested;
        }, 2);
    } catch {
        return String(value);
    }
}

function quantity(value: string) {
    try {
        return ethers.getBigInt(value).toLocaleString("en-US");
    } catch {
        return value;
    }
}

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function CodeBlock({children}: {children: string}) {
    return (
        <Box
            component="pre"
            sx={{m: 0, p: 1.25, maxHeight: 280, overflow: "auto", borderRadius: 1.5, bgcolor: "grey.100", fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere"}}
        >
            {children}
        </Box>
    );
}

function ValueRows({values, empty, format}: {values: DecodedValue[]; empty: string; format?: (value: DecodedValue) => string}) {
    if (values.length === 0) return <Typography variant="caption" color="text.secondary">{empty}</Typography>;
    return (
        <Stack spacing={0.5}>
            {values.map((value, index) => (
                <Box key={`${value.name}:${index}`} sx={{pl: 1, borderLeft: "2px solid", borderColor: "divider"}}>
                    <Typography variant="caption" color="text.secondary">{value.name} · {value.type}</Typography>
                    <Typography variant="body2" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>{format ? format(value) : value.value}</Typography>
                </Box>
            ))}
        </Stack>
    );
}

function EventDetails({event, chainId, metadataByAddress}: {
    event: DecodedEvent;
    chainId: string;
    metadataByAddress: Record<string, TokenMetadata>;
}) {
    const metadata = metadataForToken(metadataByAddress, chainId, event.address);
    return (
        <Paper variant="outlined" sx={{p: 1.25, borderRadius: 1.5}}>
            <Stack spacing={0.75}>
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap"}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 700}}>{event.name}</Typography>
                    <Chip size="small" variant="outlined" label={event.kind === "abi" ? "ABI" : event.kind === "erc20-transfer" ? "ERC-20" : "Native"} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>{event.signature} · {event.address}</Typography>
                <ValueRows
                    values={event.arguments}
                    empty="No event arguments"
                    format={(argument) => formatEventArgument(event, argument, metadata, true)}
                />
            </Stack>
        </Paper>
    );
}

function CallInspector({call, label, target, chainId, metadataByAddress}: {
    call: PlanSimulatedCall;
    label: string;
    target: string;
    chainId: string;
    metadataByAddress: Record<string, TokenMetadata>;
}) {
    return (
        <Accordion disableGutters elevation={0} sx={{border: "1px solid", borderColor: "divider", borderRadius: "8px !important", "&:before": {display: "none"}}}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, width: 1, pr: 1, flexWrap: "wrap"}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 800, overflowWrap: "anywhere"}}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">{quantity(call.gasUsed)} gas · {shortAddress(target)}</Typography>
                    </Box>
                    <Chip size="small" label={call.status === "0x1" ? "Success" : "Reverted"} color={call.status === "0x1" ? "success" : "error"} />
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{pt: 0}}>
                <Stack spacing={1.5}>
                    {call.maxUsedGas && (
                        <Typography variant="caption" color="text.secondary">Maximum gas observed: {quantity(call.maxUsedGas)}</Typography>
                    )}
                    {call.decodedRevert && (
                        <Alert severity="error">
                            <Typography variant="subtitle2" sx={{fontWeight: 800}}>{call.decodedRevert.name}</Typography>
                            <Typography variant="body2">{call.decodedRevert.message}</Typography>
                            {call.decodedRevert.arguments.length > 0 && <Box sx={{mt: 1}}><ValueRows values={call.decodedRevert.arguments} empty="" /></Box>}
                        </Alert>
                    )}
                    {call.status === "0x1" && (
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 800, mb: 0.75}}>Return data</Typography>
                            {call.decodedReturn
                                ? <ValueRows values={call.decodedReturn} empty="This function has no return values." />
                                : <CodeBlock>{call.returnData}</CodeBlock>}
                        </Box>
                    )}
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 800, mb: 0.75}}>Events</Typography>
                        {call.decodedEvents.length > 0
                            ? <Stack spacing={0.75}>{call.decodedEvents.map((event, index) => (
                                <EventDetails
                                    key={`${event.address}:${event.signature}:${index}`}
                                    event={event}
                                    chainId={chainId}
                                    metadataByAddress={metadataByAddress}
                                />
                            ))}</Stack>
                            : <Typography variant="caption" color="text.secondary">No decoded events.</Typography>}
                        {call.logs.length > call.decodedEvents.length && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{mt: 0.75}}>
                                {call.logs.length - call.decodedEvents.length} additional raw {(call.logs.length - call.decodedEvents.length) === 1 ? "log" : "logs"} in the advanced view.
                            </Typography>
                        )}
                    </Box>
                    <Accordion disableGutters elevation={0} sx={{"&:before": {display: "none"}}}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{px: 0, minHeight: 40}}>
                            <Typography variant="subtitle2">Advanced raw result</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{px: 0, pt: 0}}>
                            <Stack spacing={1}>
                                <Box><Typography variant="caption" color="text.secondary">Return / revert data</Typography><CodeBlock>{call.returnData}</CodeBlock></Box>
                                <Box><Typography variant="caption" color="text.secondary">Raw logs</Typography><CodeBlock>{safeJson(call.logs.map((log) => log.raw))}</CodeBlock></Box>
                                <Box><Typography variant="caption" color="text.secondary">Raw call result</Typography><CodeBlock>{safeJson(call.raw)}</CodeBlock></Box>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}

function signedRawAmount(delta: bigint, asset: BalanceChange["asset"]) {
    return `Raw amount: ${delta > BigInt(0) ? "+" : ""}${delta.toString()} ${asset === "native" ? "wei" : "base units"}`;
}

function addressRole(address: string, planAccount: string, queuedTargets: Set<string>) {
    const normalized = address.toLowerCase();
    if (normalized === planAccount.toLowerCase()) return {label: "Plan sender", color: "primary" as const};
    if (queuedTargets.has(normalized)) return {label: "Queued call target", color: "info" as const};
    return {label: "Other address", color: "default" as const};
}

function BalanceSummary({changes, chainId, metadataByAddress, resolving, planAccount, queuedTargets}: {
    changes: BalanceChange[];
    chainId: string;
    metadataByAddress: Record<string, TokenMetadata>;
    resolving: boolean;
    planAccount: string;
    queuedTargets: Set<string>;
}) {
    return (
        <Paper variant="outlined" sx={{p: 1.5, borderRadius: 2}}>
            <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{fontWeight: 800}}>Net balance changes after queue</Typography>
                <Typography variant="caption" color="text.secondary">
                    Speculative net changes per address across successful queued calls. Positive amounts were received; negative amounts were sent.
                </Typography>
                {resolving && changes.some((change) => change.asset === "erc20") && (
                    <Typography variant="caption" color="text.secondary">Resolving token metadata…</Typography>
                )}
                {changes.length === 0
                    ? <Typography variant="body2" color="text.secondary">No supported balance changes detected.</Typography>
                    : changes.map((change) => {
                        const delta = BigInt(change.delta);
                        const tokenAddress = change.tokenAddress ?? "";
                        const metadata = change.asset === "erc20" ? metadataForToken(metadataByAddress, chainId, tokenAddress) : undefined;
                        const formatted = formatBalanceChangeAmount(change, metadata);
                        const role = addressRole(change.account, planAccount, queuedTargets);
                        const showSeparateRawAmount = change.asset === "native" || Boolean(metadata);
                        return (
                            <Box
                                key={`${change.asset}:${change.tokenAddress ?? "native"}:${change.account}`}
                                aria-label={`${role.label} ${change.account}: ${formatted}`}
                                sx={{display: "flex", flexDirection: {xs: "column", sm: "row"}, alignItems: {xs: "stretch", sm: "flex-start"}, justifyContent: "space-between", gap: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: "action.hover"}}
                            >
                                <Box sx={{minWidth: 0}}>
                                    <Chip size="small" variant="outlined" color={role.color} label={role.label} sx={{mb: 0.5, fontWeight: 700}} />
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>
                                        {change.account}
                                    </Typography>
                                    <Typography variant="body2" sx={{fontWeight: 700, mt: 0.5}}>
                                        {change.asset === "native" ? "Native asset" : tokenLabel(tokenAddress, metadata)}
                                    </Typography>
                                    {change.asset === "erc20" && (
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{overflowWrap: "anywhere"}}>
                                            {tokenDescription(tokenAddress, metadata)}
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{flex: "0 0 auto", textAlign: {xs: "left", sm: "right"}, maxWidth: "100%"}}>
                                    <Typography variant="body2" color={delta > BigInt(0) ? "success.main" : "error.main"} sx={{fontFamily: "monospace", fontWeight: 800}}>
                                        {formatted}
                                    </Typography>
                                    {showSeparateRawAmount && (
                                        <Typography variant="caption" color="text.secondary" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>
                                            {signedRawAmount(delta, change.asset)}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
            </Stack>
        </Paper>
    );
}

export default function SimulationInspector() {
    const simulation = useSimulation();
    const {state} = useTransactionPlan();
    const snapshot = simulation.snapshot;
    if (!snapshot) {
        return <Alert severity="info">The detailed inspector will appear after the transaction plan has been simulated.</Alert>;
    }
    const callsById = new Map(state.plan.calls.map((call) => [call.id, call]));
    const queuedTargets = new Set(state.plan.calls.map((call) => call.to.toLowerCase()));

    return (
        <Stack spacing={1.5}>
            <Box>
                <Typography variant="subtitle1" sx={{fontWeight: 800}}>Detailed simulation</Typography>
                <Typography variant="caption" color="text.secondary">Speculative only · base block {quantity(snapshot.baseBlockNumber)}</Typography>
            </Box>
            {(simulation.status === "stale" || simulation.status === "simulating" || simulation.status === "error") && (
                <Alert severity="warning">These details are from the last successful snapshot and may not match the current queue.</Alert>
            )}
            <Stack spacing={1}>
                {snapshot.calls.map((call, index) => {
                    const queuedCall = callsById.get(call.callId);
                    return (
                        <CallInspector
                            key={call.callId}
                            call={call}
                            label={`${index + 1}. ${queuedCall?.display.functionSignature ?? "Previous raw transaction"}`}
                            target={queuedCall?.to ?? call.logs[0]?.address ?? snapshot.account}
                            chainId={snapshot.chainId}
                            metadataByAddress={simulation.tokenMetadataByAddress}
                        />
                    );
                })}
            </Stack>
            <BalanceSummary
                changes={snapshot.balanceChanges}
                chainId={snapshot.chainId}
                metadataByAddress={simulation.tokenMetadataByAddress}
                resolving={simulation.tokenMetadataResolving}
                planAccount={snapshot.account}
                queuedTargets={queuedTargets}
            />
            <Divider />
            <Accordion disableGutters elevation={0} sx={{"&:before": {display: "none"}}}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{px: 0}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>Raw simulation response</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{px: 0, pt: 0}}><CodeBlock>{safeJson(snapshot.raw)}</CodeBlock></AccordionDetails>
            </Accordion>
        </Stack>
    );
}
