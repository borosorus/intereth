import { Alert, Box, Divider, Stack, Typography } from "@mui/material";
import AtomicBatchExecution, { AtomicBatchController } from "./AtomicBatchExecution";
import SequentialExecution from "./SequentialExecution";

export default function TransactionExecutionOptions({controller}: {controller: AtomicBatchController}) {
    const capability = controller.capability;
    const atomicUnavailable = controller.execution.status === "idle"
        && (capability.status === "unsupported" || capability.status === "unavailable");

    return (
        <Stack spacing={1.5}>
            {atomicUnavailable ? (
                <>
                    <Divider />
                    <Box>
                        <Typography variant="subtitle1" sx={{fontWeight: 800}}>Atomic execution</Typography>
                        <Typography variant="caption" color="text.secondary">All queued calls execute together or not at all.</Typography>
                    </Box>
                    <Alert severity="info">
                        Atomic batching is unavailable in this wallet on the plan network. You can send the same plan as individual transactions below.
                    </Alert>
                </>
            ) : (
                <AtomicBatchExecution controller={controller} />
            )}
            <SequentialExecution />
        </Stack>
    );
}
