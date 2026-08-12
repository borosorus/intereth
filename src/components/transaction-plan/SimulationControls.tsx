import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useSimulation } from "../../simulation/context";
import SimulationEndpointStatus from "../simulation/SimulationEndpointStatus";

const statusLabels = {
    idle: "Idle",
    waiting: "Queued",
    simulating: "Simulating",
    ready: "Ready",
    stale: "Stale",
    error: "Unavailable",
} as const;

export default function SimulationControls() {
    const simulation = useSimulation();

    return (
        <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
            <Stack spacing={1.25}>
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Queued-state simulation</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Automatically refreshed after queue changes.
                        </Typography>
                    </Box>
                    <Chip
                        size="small"
                        label={statusLabels[simulation.status]}
                        color={simulation.status === "ready" ? "success" : simulation.status === "error" ? "error" : "default"}
                    />
                </Box>
                {simulation.snapshot && (
                    <Typography variant="caption" color="text.secondary">
                        Speculative snapshot from base block {ethers.getBigInt(simulation.snapshot.baseBlockNumber).toString()}.
                    </Typography>
                )}
                <SimulationEndpointStatus />
                {simulation.error && (
                    <Alert
                        severity="error"
                        action={<Button color="inherit" size="small" disabled={!simulation.active} onClick={simulation.retry}>Retry</Button>}
                    >
                        {simulation.error.message}
                    </Alert>
                )}
            </Stack>
        </Paper>
    );
}
