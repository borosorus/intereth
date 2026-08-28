import { Alert, Box, Divider, Stack, Typography } from "@mui/material";
import { useTransactionPlan } from "../../transaction-plan/context";
import AtomicBatchExecution, { AtomicBatchController } from "./AtomicBatchExecution";
import SequentialExecution from "./SequentialExecution";

export default function TransactionExecutionOptions({controller}: {controller: AtomicBatchController}) {
    const {state} = useTransactionPlan();
    const capability = controller.capability;
    const sequentialTracked = state.sequentialExecution.status !== "idle";
    const atomicUnavailable = controller.execution.status === "idle"
        && (capability.status === "unsupported" || capability.status === "unavailable");

    return (
        <Stack spacing={1.5}>
            {sequentialTracked ? (
                <>
                    <Divider />
                    <Box>
                        <Typography variant="subtitle1" sx={{fontWeight: 800}}>Atomic execution</Typography>
                        <Typography variant="caption" color="text.secondary">All queued calls execute together or not at all.</Typography>
                    </Box>
                    <Alert severity="info">Atomic submission is unavailable while an individual-transaction execution is being tracked.</Alert>
                </>
            ) : atomicUnavailable ? (
                <>
                    <Divider />
                    <Box>
                        <Typography variant="subtitle1" sx={{fontWeight: 800}}>Atomic execution</Typography>
                        <Typography variant="caption" color="text.secondary">All queued calls execute together or not at all.</Typography>
                    </Box>
                    <Alert severity="info">
                        Atomic batching is unavailable in this wallet on the plan network. Send the queued plan as individual transactions below. Use Send now from individual function or raw-call forms if you only want to submit a single call outside the plan.
                    </Alert>
                </>
            ) : (
                <AtomicBatchExecution controller={controller} />
            )}
            <SequentialExecution />
        </Stack>
    );
}
