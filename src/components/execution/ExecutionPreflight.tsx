import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { shortAddress } from "../../calls/displayValues";
import { chainsById } from "../../chainConfig";
import { useSimulation } from "../../simulation/context";
import { compactNetBalanceChanges, estimatedFee, summarizePlan } from "../../simulation/planSummary";
import { formatBalanceChangeAmount, metadataForToken } from "../../simulation/tokenFormatting";
import { useTransactionPlan } from "../../transaction-plan/context";
import { monoFont, nestedSurfaceSx } from "../../ui/styles";

function decimalQuantity(value: bigint | string) {
    try {
        return BigInt(value).toLocaleString("en-US");
    } catch {
        return String(value);
    }
}

export default function ExecutionPreflight() {
    const simulation = useSimulation();
    const {state} = useTransactionPlan();
    const calls = state.plan.calls;
    const snapshot = simulation.snapshot;
    if (calls.length === 0) return null;

    if (!snapshot) {
        return (
            <Paper variant="outlined" sx={nestedSurfaceSx}>
                <Stack spacing={0.75}>
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>Plan preflight</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {simulation.error?.message
                            ?? (simulation.status === "waiting" || simulation.status === "simulating"
                                ? "Preparing the plan verdict and fee estimate…"
                                : "No simulation snapshot is available for this plan.")}
                    </Typography>
                </Stack>
            </Paper>
        );
    }

    const summary = summarizePlan(snapshot);
    const stale = simulation.status !== "ready" || snapshot.revision !== simulation.revision;
    const targets = calls.map((call) => call.to);
    const compact = compactNetBalanceChanges(summary.netBalanceChanges, snapshot.account, targets);
    const gasPriceWei = simulation.feeEstimate?.status === "ready"
        ? simulation.feeEstimate.gasPriceWei
        : null;
    const fee = gasPriceWei !== null ? estimatedFee(summary.totalGas, BigInt(gasPriceWei)) : null;
    const nativeToken = chainsById.get(snapshot.chainId)?.token ?? "native token";

    return (
        <Paper variant="outlined" sx={nestedSurfaceSx}>
            <Stack spacing={1.25}>
                <Box>
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>Plan preflight</Typography>
                    <Typography variant="caption" color="text.secondary">
                        Simulation snapshot at base block {decimalQuantity(snapshot.baseBlockNumber)}
                    </Typography>
                </Box>
                <Alert severity={summary.reverted > 0 ? "error" : stale ? "warning" : "success"}>
                    {summary.reverted > 0
                        ? `${summary.reverted} of ${summary.totalCalls} ${summary.totalCalls === 1 ? "call reverts" : "calls revert"} in simulation.`
                        : stale
                            ? "The current plan no longer matches this snapshot."
                            : `All ${summary.totalCalls} ${summary.totalCalls === 1 ? "call succeeds" : "calls succeed"} in simulation.`}
                </Alert>
                {summary.reverted > 0 && stale && (
                    <Alert severity="warning">This snapshot is stale; the verdict may not reflect the current plan.</Alert>
                )}
                <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", sm: "1fr 1fr"}, gap: 1.5}}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Total simulated gas</Typography>
                        <Typography variant="body2" sx={{fontFamily: monoFont, fontWeight: 700}}>
                            {decimalQuantity(summary.totalGas)}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Estimated fee</Typography>
                        {fee !== null
                            ? <Typography variant="body2" sx={{fontFamily: monoFont, fontWeight: 700}}>{ethers.formatEther(fee)} {nativeToken}</Typography>
                            : <Typography variant="body2" color="text.secondary">
                                {simulation.feeEstimate?.status === "loading" ? "Estimating…" : "Unavailable"}
                            </Typography>}
                    </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                    Gas uses maxUsedGas when provided. The fee estimate uses the current eth_gasPrice and may change before submission.
                </Typography>
                <Stack spacing={0.5}>
                    <Typography variant="subtitle2" sx={{fontWeight: 700}}>Net balance effects</Typography>
                    {compact.changes.length === 0
                        ? <Typography variant="caption" color="text.secondary">No supported balance changes detected.</Typography>
                        : compact.changes.map((change) => {
                            const metadata = change.asset === "erc20"
                                ? metadataForToken(simulation.tokenMetadataByAddress, snapshot.chainId, change.tokenAddress)
                                : undefined;
                            const target = targets.some((address) => address.toLowerCase() === change.account.toLowerCase());
                            const role = change.account.toLowerCase() === snapshot.account.toLowerCase()
                                ? "Plan sender"
                                : target ? "Call target" : shortAddress(change.account);
                            return (
                                <Box key={`${change.asset}:${change.tokenAddress ?? "native"}:${change.account}`} sx={{display: "flex", flexDirection: {xs: "column", sm: "row"}, justifyContent: "space-between", gap: {xs: 0.25, sm: 1}}}>
                                    <Typography variant="caption" color="text.secondary">{role}</Typography>
                                    <Typography variant="body2" sx={{fontFamily: monoFont, fontWeight: 700, overflowWrap: "anywhere"}}>
                                        {formatBalanceChangeAmount(change, metadata)}
                                    </Typography>
                                </Box>
                            );
                        })}
                    {compact.omitted > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            …and {compact.omitted} more {compact.omitted === 1 ? "effect" : "effects"}.
                        </Typography>
                    )}
                </Stack>
            </Stack>
        </Paper>
    );
}
