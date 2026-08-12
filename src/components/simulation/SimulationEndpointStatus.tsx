import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { BrowserSimulationCapabilityStatus, useSimulation } from "../../simulation/context";

function unavailableMessage(status: BrowserSimulationCapabilityStatus | undefined) {
    if (status === "unsupported") {
        return "No compatible simulation RPC is available for this network. The connected wallet RPC does not support eth_simulateV1.";
    }
    if (status === "unavailable") {
        return "The connected wallet RPC could not be checked for eth_simulateV1 support.";
    }
    return "No compatible simulation RPC is available for this network. Connect a wallet in Simulate mode to check its RPC.";
}

export default function SimulationEndpointStatus({showReady = true}: {showReady?: boolean}) {
    const simulation = useSimulation();
    const endpointStatus = simulation.endpointStatus ?? (simulation.configured ? "ready" : "unavailable");

    if (endpointStatus === "idle") return null;
    if (endpointStatus === "checking") {
        return <Alert severity="info">Checking the connected wallet RPC for eth_simulateV1 support…</Alert>;
    }
    if (endpointStatus === "unavailable") {
        const canRetry = simulation.browserCapability?.status === "unsupported"
            || simulation.browserCapability?.status === "unavailable";
        return (
            <Alert
                severity="info"
                action={canRetry ? <Button color="inherit" size="small" onClick={simulation.retry}>Retry</Button> : undefined}
            >
                {unavailableMessage(simulation.browserCapability?.status)}
            </Alert>
        );
    }
    if (!showReady || !simulation.endpointSource) return null;

    const browser = simulation.endpointSource === "browser";
    return (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">Simulation RPC</Typography>
            <Chip size="small" variant="outlined" color={browser ? "secondary" : "default"} label={browser ? "Wallet RPC" : "Configured RPC"} />
            <Typography variant="caption" color="text.secondary">
                {browser ? "Provided by the connected wallet" : "Provided by Intereth for this chain"}
            </Typography>
        </Stack>
    );
}
