import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { useSimulation } from "../../simulation/context";
import SimulationEndpointStatus from "../simulation/SimulationEndpointStatus";
import { StateBadge, simulationPresentation } from "../StateBadge";

export default function SimulationControls() {
    const simulation = useSimulation();
    const presentation = simulationPresentation(simulation.status);

    return (
        <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
            <Stack spacing={1.25}>
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap"}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Queued-state simulation</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Automatically refreshed after queue changes.
                        </Typography>
                    </Box>
                    <StateBadge {...presentation} />
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
