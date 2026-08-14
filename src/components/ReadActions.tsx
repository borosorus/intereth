import { Button, CircularProgress, Stack } from "@mui/material";
import { useWorkspaceMode } from "../workspace/context";

export type ReadLoadingMode = "simulated" | "onchain" | null;

interface ReadActionsProps {
    simulationEnabled: boolean;
    simulationAvailable: boolean;
    onChainAvailable: boolean;
    loading: ReadLoadingMode;
    onSimulated: () => void;
    onOnChain: () => void;
    onPinWatch?: () => void;
    canPinWatch?: boolean;
}

export default function ReadActions({
    simulationAvailable,
    onChainAvailable,
    loading,
    onSimulated,
    onOnChain,
    onPinWatch,
    canPinWatch = false,
}: ReadActionsProps) {
    const workspace = useWorkspaceMode();

    if (workspace.mode === "interact") {
        return (
            <Button
                variant="contained"
                color="secondary"
                fullWidth
                disabled={!onChainAvailable || loading !== null}
                onClick={onOnChain}
                sx={{py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 700}}
            >
                {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : "Run on-chain"}
            </Button>
        );
    }

    if (!simulationAvailable) {
        return (
            <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                <Button
                    variant="contained"
                    color="info"
                    fullWidth
                    disabled={!onChainAvailable || loading !== null}
                    onClick={onOnChain}
                    sx={{py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 700}}
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
                sx={{py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 700}}
            >
                {loading === "simulated" ? <CircularProgress size={20} color="inherit" /> : "Run speculative"}
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
            {onPinWatch && (
                <Button variant="text" fullWidth disabled={!canPinWatch || loading !== null} onClick={onPinWatch} sx={{textTransform: "none", fontWeight: 700}}>
                    Pin watch
                </Button>
            )}
        </Stack>
    );
}
