import { Button, CircularProgress } from "@mui/material";
import ActionButtonRow from "./ActionButtonRow";
import { actionButtonSx } from "../ui/styles";

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
    if (!simulationAvailable) {
        return (
            <ActionButtonRow>
                <Button
                    variant="contained"
                    color="secondary"
                    fullWidth
                    disabled={!onChainAvailable || loading !== null}
                    onClick={onOnChain}
                    sx={actionButtonSx}
                >
                    {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : "Call on-chain"}
                </Button>
                {onPinWatch && (
                    <Button variant="text" fullWidth disabled={!canPinWatch || loading !== null} onClick={onPinWatch} sx={actionButtonSx}>
                        Pin watch
                    </Button>
                )}
            </ActionButtonRow>
        );
    }

    return (
        <ActionButtonRow>
            <Button
                variant="contained"
                color="info"
                fullWidth
                disabled={loading !== null}
                onClick={onSimulated}
                sx={actionButtonSx}
            >
                {loading === "simulated" ? <CircularProgress size={20} color="inherit" /> : "Run speculative"}
            </Button>
            <Button
                variant="outlined"
                color="secondary"
                fullWidth
                disabled={!onChainAvailable || loading !== null}
                onClick={onOnChain}
                sx={actionButtonSx}
            >
                {loading === "onchain" ? <CircularProgress size={20} color="inherit" /> : "Call on-chain"}
            </Button>
            {onPinWatch && (
                <Button variant="text" fullWidth disabled={!canPinWatch || loading !== null} onClick={onPinWatch} sx={actionButtonSx}>
                    Pin watch
                </Button>
            )}
        </ActionButtonRow>
    );
}
