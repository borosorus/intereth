import { Button, CircularProgress, Stack } from "@mui/material";

export type ReadLoadingMode = "simulated" | "onchain" | null;

interface ReadActionsProps {
    simulationEnabled: boolean;
    simulationAvailable: boolean;
    onChainAvailable: boolean;
    loading: ReadLoadingMode;
    onSimulated: () => void;
    onOnChain: () => void;
}

export default function ReadActions({
    simulationEnabled,
    simulationAvailable,
    onChainAvailable,
    loading,
    onSimulated,
    onOnChain,
}: ReadActionsProps) {
    if (!simulationAvailable) {
        return (
            <Button
                variant="contained"
                color="secondary"
                fullWidth
                disabled={!onChainAvailable || loading !== null}
                onClick={onOnChain}
                sx={{py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 700}}
            >
                {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : simulationEnabled ? "Run on-chain" : "Run call"}
            </Button>
        );
    }

    return (
        <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
            <Button
                variant="contained"
                color="secondary"
                fullWidth
                disabled={loading !== null}
                onClick={onSimulated}
                sx={{py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 700}}
            >
                {loading === "simulated" ? <CircularProgress size={20} color="inherit" /> : "Run simulated"}
            </Button>
            <Button
                variant="outlined"
                color="secondary"
                fullWidth
                disabled={!onChainAvailable || loading !== null}
                onClick={onOnChain}
                sx={{py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 700}}
            >
                {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : "Run on-chain"}
            </Button>
        </Stack>
    );
}
