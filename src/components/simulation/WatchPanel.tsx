import { DeleteOutline, Refresh } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, IconButton, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ethers } from "ethers";
import { useSimulation } from "../../simulation/context";
import { WatchResultValue } from "../../simulation/types";
import { useTransactionPlan } from "../../transaction-plan/context";
import { WatchExpression } from "../../transaction-plan/types";
import SimulationEndpointStatus from "./SimulationEndpointStatus";
import { StateBadge, watchPresentation } from "../StateBadge";
import InfoHint from "../InfoHint";
import { accordionSurfaceSx, monoFont, nestedSurfaceSx } from "../../ui/styles";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function blockLabel(value: string) {
    try {
        return ethers.getBigInt(value).toLocaleString("en-US");
    } catch {
        return value;
    }
}

function ResultValue({result, emptyLabel}: {result?: WatchResultValue; emptyLabel: string}) {
    if (!result) return <Typography variant="caption" color="text.secondary">{emptyLabel}</Typography>;
    if (!result.values) {
        return <Typography variant="body2" sx={{fontFamily: monoFont, overflowWrap: "anywhere"}}>{result.returnData}</Typography>;
    }
    return (
        <Stack spacing={0.25}>
            {result.values.map((value, index) => (
                <Typography key={`${value.name}:${index}`} variant="body2" sx={{overflowWrap: "anywhere"}}>
                    {result.values!.length > 1 && <strong>{value.name}: </strong>}{value.value}
                </Typography>
            ))}
        </Stack>
    );
}

function WatchCard({watch}: {watch: WatchExpression}) {
    const simulation = useSimulation();
    const transactionPlan = useTransactionPlan();
    const evaluation = simulation.watchEvaluations[watch.id];
    const label = watch.display.functionSignature ?? "Raw read";
    const status = evaluation?.status ?? (simulation.status === "ready" ? "loading" : "stale");
    const presentation = watchPresentation(status);
    const hasQueuedCalls = simulation.queuedCallCount > 0;

    return (
        <Paper variant="outlined" sx={nestedSurfaceSx}>
            <Stack spacing={1}>
                <Box sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 800, overflowWrap: "anywhere"}}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">{shortAddress(watch.to)}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <StateBadge {...presentation} />
                        <IconButton
                            size="small"
                            aria-label={`Remove watch ${label}`}
                            disabled={!transactionPlan.canEdit}
                            onClick={() => transactionPlan.dispatch({type: "REMOVE_WATCH", watchId: watch.id})}
                        >
                            <DeleteOutline fontSize="small" />
                        </IconButton>
                    </Stack>
                </Box>
                {watch.display.arguments && watch.display.arguments.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere"}}>
                        {watch.display.arguments.map((argument) => `${argument.name}: ${argument.value}`).join(" · ")}
                    </Typography>
                )}
                {evaluation?.status === "error" && <Alert severity="error">{evaluation.error?.message ?? "Watch evaluation failed."}</Alert>}
                {evaluation?.status === "blocked" && <Alert severity="warning">Speculative value is unavailable because a plan call reverted.</Alert>}
                <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", sm: "1fr 1fr"}, gap: 1.5}}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">On-chain at base block</Typography>
                        <ResultValue result={evaluation?.base} emptyLabel="Not evaluated" />
                    </Box>
                    {hasQueuedCalls ? <Box>
                        <Typography variant="caption" color="info.main" sx={{fontWeight: 700}}>Speculative after plan</Typography>
                        <ResultValue result={evaluation?.simulated} emptyLabel={evaluation?.status === "blocked" ? "Blocked" : "Not evaluated"} />
                    </Box> : <Box>
                        <Typography variant="caption" color="text.secondary">Speculative value</Typography>
                        <Typography variant="body2" color="text.secondary">No plan calls</Typography>
                    </Box>}
                </Box>
            </Stack>
        </Paper>
    );
}

export default function WatchPanel() {
    const transactionPlan = useTransactionPlan();
    const simulation = useSimulation();
    const watches = transactionPlan.state.plan.watches;
    const watchBaseBlock = Object.values(simulation.watchEvaluations).find((evaluation) => evaluation.baseBlockNumber)?.baseBlockNumber;

    if (watches.length === 0) return null;

    return (
        <Accordion disableGutters elevation={0} sx={accordionSurfaceSx}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="watches-content" id="watches-header">
                <Box sx={{display: "flex", alignItems: "center", gap: 1, minWidth: 0, pr: 1}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Watches</Typography>
                        <Typography variant="caption" color="text.secondary">Pinned read expressions</Typography>
                    </Box>
                    <Chip size="small" variant="outlined" color="secondary" label={watches.length} />
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{pt: 0}}>
                <Stack spacing={1.5}>
                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap"}}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <InfoHint
                                label="About watches"
                                content="Watches are pinned read expressions. On-chain values come from the pinned base block; speculative values recompute after the plan calls on that same base block."
                            />
                            <Typography variant="caption" color="text.secondary">Track on-chain and speculative values</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {(simulation.snapshot || watchBaseBlock) && (
                                <Typography variant="caption" color="text.secondary">Base block {blockLabel(simulation.snapshot?.baseBlockNumber ?? watchBaseBlock!)}</Typography>
                            )}
                            <Button size="small" startIcon={<Refresh />} disabled={!simulation.watchActive} onClick={simulation.retry}>
                                Refresh
                            </Button>
                        </Stack>
                    </Box>
                    <SimulationEndpointStatus showReady={false} />
                    <Stack spacing={1}>{watches.map((watch) => <WatchCard key={watch.id} watch={watch} />)}</Stack>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
