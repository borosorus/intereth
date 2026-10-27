import { Button, CircularProgress } from "@mui/material";
import ActionButtonRow from "./ActionButtonRow";
import { actionButtonSx } from "../ui/styles";

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
    return (
        <ActionButtonRow>
            <Button
                variant="contained"
                color="secondary"
                fullWidth
                disabled={sendDisabled}
                onClick={onSend}
                sx={actionButtonSx}
            >
                {isSending ? <CircularProgress size={20} color="inherit" /> : "Send now"}
            </Button>
            <Button
                variant="outlined"
                color="secondary"
                fullWidth
                disabled={queueDisabled}
                onClick={onQueue}
                sx={actionButtonSx}
            >
                {isQueueing ? <CircularProgress size={20} color="inherit" /> : "Add to execution"}
            </Button>
        </ActionButtonRow>
    );
}
