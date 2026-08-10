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
import { BalanceChange, DecodedEvent, DecodedValue, PlanSimulatedCall } from "../../simulation/types";
import { useTransactionPlan } from "../../transaction-plan/context";

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

function ValueRows({values, empty}: {values: DecodedValue[]; empty: string}) {
    if (values.length === 0) return <Typography variant="caption" color="text.secondary">{empty}</Typography>;
    return (
        <Stack spacing={0.5}>
            {values.map((value, index) => (
                <Box key={`${value.name}:${index}`} sx={{pl: 1, borderLeft: "2px solid", borderColor: "divider"}}>
                    <Typography variant="caption" color="text.secondary">{value.name} · {value.type}</Typography>
                    <Typography variant="body2" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>{value.value}</Typography>
                </Box>
            ))}
        </Stack>
    );
}

function EventDetails({event}: {event: DecodedEvent}) {
    return (
        <Paper variant="outlined" sx={{p: 1.25, borderRadius: 1.5}}>
            <Stack spacing={0.75}>
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 700}}>{event.name}</Typography>
                    <Chip size="small" variant="outlined" label={event.kind === "abi" ? "ABI" : event.kind === "erc20-transfer" ? "ERC-20" : "Native"} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>{event.signature} · {event.address}</Typography>
                <ValueRows values={event.arguments} empty="No event arguments" />
            </Stack>
        </Paper>
    );
}

function CallInspector({call, label, target}: {call: PlanSimulatedCall; label: string; target: string}) {
    return (
        <Accordion disableGutters elevation={0} sx={{border: "1px solid", borderColor: "divider", borderRadius: "8px !important", "&:before": {display: "none"}}}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, width: 1, pr: 1}}>
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
                            ? <Stack spacing={0.75}>{call.decodedEvents.map((event, index) => <EventDetails key={`${event.address}:${event.signature}:${index}`} event={event} />)}</Stack>
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

function BalanceSummary({changes}: {changes: BalanceChange[]}) {
    return (
        <Paper variant="outlined" sx={{p: 1.5, borderRadius: 2}}>
            <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{fontWeight: 800}}>Queue-wide balance changes</Typography>
                <Typography variant="caption" color="text.secondary">Derived speculatively from supported transfer events across successful calls.</Typography>
                {changes.length === 0
                    ? <Typography variant="body2" color="text.secondary">No supported balance changes detected.</Typography>
                    : changes.map((change) => {
                        const delta = BigInt(change.delta);
                        const formatted = change.asset === "native"
                            ? `${delta > BigInt(0) ? "+" : ""}${ethers.formatEther(delta)} native`
                            : `${delta > BigInt(0) ? "+" : ""}${delta.toString()} raw units`;
                        return (
                            <Box key={`${change.asset}:${change.tokenAddress ?? "native"}:${change.account}`} sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1}}>
                                <Box sx={{minWidth: 0}}>
                                    <Typography variant="body2" sx={{fontWeight: 700}}>{change.asset === "native" ? "Native asset" : `Token ${shortAddress(change.tokenAddress ?? "")}`}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>{change.account}</Typography>
                                </Box>
                                <Typography variant="body2" color={delta > BigInt(0) ? "success.main" : "error.main"} sx={{fontFamily: "monospace", textAlign: "right"}}>{formatted}</Typography>
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
                        />
                    );
                })}
            </Stack>
            <BalanceSummary changes={snapshot.balanceChanges} />
            <Divider />
            <Accordion disableGutters elevation={0} sx={{"&:before": {display: "none"}}}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{px: 0}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>Advanced raw simulation response</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{px: 0, pt: 0}}><CodeBlock>{safeJson(snapshot.raw)}</CodeBlock></AccordionDetails>
            </Accordion>
        </Stack>
    );
}
