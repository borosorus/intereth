import { Alert, Divider, Stack } from "@mui/material";
import { useTransactionPlan } from "../../transaction-plan/context";
import WorkspaceSectionHeader from "../WorkspaceSectionHeader";
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
                    <WorkspaceSectionHeader
                        title="Safe execution"
                        description="Send the whole plan in one Safe multi-call transaction, or execute calls separately in order. Multi-owner Safe approvals apply to the selected option."
                    />
                </>
            ) : sequentialTracked ? (
                <>
                    <Divider />
                    <WorkspaceSectionHeader
                        title="Atomic execution"
                        hintLabel="About atomic execution"
                        hintContent="All plan calls execute together or not at all. If any call fails, the whole batch is reverted."
                    />
                    <Alert severity="info">Atomic submission is unavailable while an individual-transaction execution is being tracked.</Alert>
                </>
            ) : atomicUnavailable ? (
                <>
                    <Divider />
                    <WorkspaceSectionHeader
                        title="Atomic execution"
                        hintLabel="About atomic execution"
                        hintContent="All plan calls execute together or not at all. If any call fails, the whole batch is reverted."
                    />
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
