import { Button, CircularProgress, Stack } from "@mui/material";
import { useWorkspaceMode } from "../workspace/context";

interface CallActionButtonsProps {
    isSending: boolean;
    isQueueing: boolean;
    sendDisabled: boolean;
    queueDisabled: boolean;
    onSend: () => void;
    onQueue: () => void;
}

// Send/queue controls for state-changing calls, shared by every authoring
// surface (ABI function, static function, raw calldata).
export default function CallActionButtons({
    isSending,
    isQueueing,
    sendDisabled,
    queueDisabled,
    onSend,
    onQueue,
}: CallActionButtonsProps) {
    const workspace = useWorkspaceMode();
    const styling = {py: 1.2, borderRadius: 2, textTransform: "none" as const, fontWeight: 700};

    return (
        <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
            {workspace.mode === "interact" && (
                <Button
                    variant="contained"
                    color="secondary"
                    fullWidth
                    disabled={sendDisabled}
                    onClick={onSend}
                    sx={styling}
                >
                    {isSending ? <CircularProgress size={20} color="inherit" /> : "Send now"}
                </Button>
            )}
            <Button
                variant={workspace.mode === "simulate" ? "contained" : "outlined"}
                color={workspace.mode === "simulate" ? "info" : "secondary"}
                fullWidth
                disabled={queueDisabled}
                onClick={onQueue}
                sx={styling}
            >
                {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to queue"}
            </Button>
        </Stack>
    );
}
