import { Button, CircularProgress, Stack } from "@mui/material";

export type ReadLoadingMode = "simulated" | "onchain" | null;

interface ReadActionsProps {
    simulationAvailable: boolean;
    onChainAvailable: boolean;
    loading: ReadLoadingMode;
    onSimulated: () => void;
    onOnChain: () => void;
    onPinWatch?: () => void;
    canPinWatch?: boolean;
}

// Read actions come from capabilities, not modes: on-chain reads whenever a
// runner can answer, speculative reads whenever queued-state simulation is
// ready for this queue revision, and pinning whenever the plan is editable.
export default function ReadActions({
    simulationAvailable,
    onChainAvailable,
    loading,
    onSimulated,
    onOnChain,
    onPinWatch,
    canPinWatch = false,
}: ReadActionsProps) {
    const styling = {py: 1.2, borderRadius: 2, textTransform: "none" as const, fontWeight: 700};

    if (!simulationAvailable) {
        return (
            <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                <Button
                    variant="contained"
                    color="secondary"
                    fullWidth
                    disabled={!onChainAvailable || loading !== null}
                    onClick={onOnChain}
                    sx={styling}
                >
                    {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : "Run on-chain"}
                </Button>
                {onPinWatch && (
                    <Button variant="text" fullWidth disabled={!canPinWatch || loading !== null} onClick={onPinWatch} sx={{textTransform: "none", fontWeight: 700}}>
                        Pin watch
                    </Button>
                )}
            </Stack>
        );
    }

    return (
        <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
            <Button
                variant="contained"
                color="info"
                fullWidth
                disabled={loading !== null}
                onClick={onSimulated}
                sx={styling}
            >
                {loading === "simulated" ? <CircularProgress size={20} color="inherit" /> : "Run speculative"}
            </Button>
            <Button
                variant="outlined"
                color="secondary"
                fullWidth
                disabled={!onChainAvailable || loading !== null}
                onClick={onOnChain}
                sx={styling}
            >
                {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : "Run on-chain"}
            </Button>
            {onPinWatch && (
                <Button variant="text" fullWidth disabled={!canPinWatch || loading !== null} onClick={onPinWatch} sx={{textTransform: "none", fontWeight: 700}}>
                    Pin watch
                </Button>
            )}
        </Stack>
    );
}
