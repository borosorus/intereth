import { Alert, Box, Divider, Stack, Typography } from "@mui/material";
import { useTransactionPlan } from "../../transaction-plan/context";
import InfoHint from "../InfoHint";
import AtomicBatchExecution, { AtomicBatchController } from "./AtomicBatchExecution";
import SequentialExecution from "./SequentialExecution";
import { useWalletSession } from "../../wallet/WalletSessionContext";

export default function TransactionExecutionOptions({controller}: {controller: AtomicBatchController}) {
    const {state} = useTransactionPlan();
    const wallet = useWalletSession();
    const capability = controller.capability;
    const sequentialTracked = state.sequentialExecution.status !== "idle";
    const atomicUnavailable = controller.execution.status === "idle"
        && (capability.status === "unsupported" || capability.status === "unavailable");

    return (
        <Stack spacing={1.5}>
            {wallet.isSafeMode ? (
                <>
                    <Divider />
                    <Box>
                        <Typography variant="subtitle1" sx={{fontWeight: 800}}>Safe execution</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Send the whole plan in one Safe multi-call transaction, or execute calls separately in order. Multi-owner Safe approvals apply to the selected option.
                        </Typography>
                    </Box>
                </>
            ) : sequentialTracked ? (
                <>
                    <Divider />
                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                        <Typography variant="subtitle1" sx={{fontWeight: 800}}>Atomic execution</Typography>
                        <InfoHint label="About atomic execution" content="All plan calls execute together or not at all. If any call fails, the whole batch is reverted." />
                    </Box>
                    <Alert severity="info">Atomic submission is unavailable while an individual-transaction execution is being tracked.</Alert>
                </>
            ) : atomicUnavailable ? (
                <>
                    <Divider />
                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                        <Typography variant="subtitle1" sx={{fontWeight: 800}}>Atomic execution</Typography>
                        <InfoHint label="About atomic execution" content="All plan calls execute together or not at all. If any call fails, the whole batch is reverted." />
                    </Box>
                    <Alert severity="info">
                        Atomic batching is unavailable in this wallet on the plan network. Send the plan as individual transactions below. Use Send now from individual function or raw-call forms if you only want to submit a single call outside the plan.
                    </Alert>
                </>
            ) : (
                <AtomicBatchExecution controller={controller} />
            )}
            <SequentialExecution />
        </Stack>
    );
}
