import { Alert, Box, Button, Chip, FormControlLabel, Paper, Stack, Switch, Typography } from "@mui/material";
import { useSimulation } from "../../simulation/context";

export default function SimulationControls() {
    const simulation = useSimulation();

    return (
        <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
            <Stack spacing={1.25}>
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Queued-state simulation</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Run reads after the queued calls using the latest chain state.
                        </Typography>
                    </Box>
                    <Chip
                        size="small"
                        label={simulation.status === "checking"
                            ? "Checking"
                            : simulation.status === "ready" ? "Ready" : simulation.status === "error" ? "Unavailable" : "Off"}
                        color={simulation.status === "ready" ? "success" : simulation.status === "error" ? "error" : "default"}
                    />
                </Box>
                <FormControlLabel
                    control={(
                        <Switch
                            checked={simulation.enabled}
                            disabled={simulation.status === "checking" || (!simulation.enabled && !simulation.canEnable)}
                            onChange={(_, checked) => checked ? void simulation.enable() : simulation.disable()}
                            inputProps={{"aria-label": "Enable queued-state simulation"}}
                        />
                    )}
                    label="Use simulation for contract reads"
                />
                {!simulation.configured && (
                    <Alert severity="info">No simulation RPC is configured for this network.</Alert>
                )}
                {simulation.error && (
                    <Alert
                        severity="error"
                        action={<Button color="inherit" size="small" disabled={!simulation.canEnable} onClick={() => void simulation.retry()}>Retry</Button>}
                    >
                        {simulation.error.message}
                    </Alert>
                )}
            </Stack>
        </Paper>
    );
}
