import { Button, CircularProgress, Stack } from "@mui/material";

interface CallActionButtonsProps {
    isSending: boolean;
    isQueueing: boolean;
    sendDisabled: boolean;
    queueDisabled: boolean;
    onSend: () => void;
    onQueue: () => void;
}

// Send/queue controls for state-changing calls, shared by every authoring
// surface (ABI function, static function, raw calldata). Both actions are
// always offered; enablement comes from wallet and plan capabilities.
export default function CallActionButtons({
    isSending,
    isQueueing,
    sendDisabled,
    queueDisabled,
    onSend,
    onQueue,
}: CallActionButtonsProps) {
    const styling = {py: 1.2, borderRadius: 2, textTransform: "none" as const, fontWeight: 700};

    return (
        <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
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
            <Button
                variant="outlined"
                color="secondary"
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
