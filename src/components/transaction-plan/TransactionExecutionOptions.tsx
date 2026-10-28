import { Alert, Box, Button, Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useEffect, useState } from "react";
import { useTransactionPlan } from "../../transaction-plan/context";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import WorkspaceSectionHeader from "../WorkspaceSectionHeader";
import InfoHint from "../InfoHint";
import AtomicBatchExecution, { AtomicBatchController } from "./AtomicBatchExecution";
import SequentialExecution from "./SequentialExecution";

type ExecutionMode = "atomic" | "sequential";

export default function TransactionExecutionOptions({controller}: {controller: AtomicBatchController}) {
    const {state} = useTransactionPlan();
    const wallet = useWalletSession();
    const context = state.plan.context;
    const currentSequentialRecord = state.sequentialExecution.calls.at(-1);
    const safeOwnerCanSign = Boolean(wallet.account && wallet.safeAccount?.owners.some((owner) => owner.toLowerCase() === wallet.account!.toLowerCase()));
    const safeBatchAvailable = wallet.safeAccount?.source === "safe-app"
        ? Boolean(wallet.safeAppSdk)
        : Boolean(wallet.injectedProvider && wallet.safeOwnerConnected && safeOwnerCanSign);
    const capability = controller.capability;
    const atomicCapabilityAvailable = capability.status === "supported" || capability.status === "ready";
    const capabilityPending = capability.status === "unchecked" || capability.status === "checking";
    const atomicAvailable = wallet.isSafeMode ? safeBatchAvailable : atomicCapabilityAvailable || capabilityPending;
    const trackingMode: ExecutionMode | null = controller.execution.status !== "idle"
        ? "atomic"
        : state.sequentialExecution.status !== "idle"
            ? (wallet.isSafeMode && currentSequentialRecord?.safeBatch ? "atomic" : "sequential")
            : null;
    const defaultMode: ExecutionMode = atomicAvailable ? "atomic" : "sequential";
    const [modePreference, setModePreference] = useState<ExecutionMode | null>(null);
    const mode = trackingMode ?? (modePreference === "atomic" && !atomicAvailable ? "sequential" : modePreference ?? defaultMode);

    useEffect(() => {
        setModePreference(null);
    }, [context?.account, context?.chainId, wallet.account, wallet.chainId, wallet.isSafeMode, wallet.provider, wallet.safeAccount?.address]);

    const atomicUnavailable = !wallet.isSafeMode
        && !trackingMode
        && !atomicCapabilityAvailable
        && !capabilityPending;
    const atomicCheckFailed = atomicUnavailable && capability.status === "error";
    const safeBatchUnavailable = Boolean(wallet.isSafeMode && !trackingMode && !safeBatchAvailable);
    const sequentialComponentMode = wallet.isSafeMode ? mode : "sequential";
    const modeDescription = mode === "atomic"
        ? wallet.isSafeMode ? "Submit all calls together as one Safe transaction." : "Submit all calls as one atomic wallet batch."
        : wallet.isSafeMode ? "Submit separate Safe transactions in plan order." : "Submit separate wallet transactions in plan order.";

    return (
        <Stack spacing={1.5}>
            <WorkspaceSectionHeader
                title="Run plan"
                titleVariant="subtitle2"
                description={modeDescription}
            />
            <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                disabled={Boolean(trackingMode)}
                onChange={(_, nextMode: ExecutionMode | null) => {
                    if (nextMode) setModePreference(nextMode);
                }}
                aria-label="Execution method"
                sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2.5,
                    bgcolor: "#f1f5f9",
                    p: 0.25,
                    gap: 0.25,
                    width: {xs: "100%", sm: "fit-content"},
                    "& .MuiToggleButton-root": {
                        border: 0,
                        borderRadius: "8px !important",
                        fontWeight: 700,
                        px: {xs: 2, sm: 2.5},
                        minWidth: {xs: 0, sm: 132},
                        flex: {xs: 1, sm: "0 1 auto"},
                        color: "text.secondary",
                        "&.Mui-selected": {bgcolor: "secondary.main", color: "#fff", "&:hover": {bgcolor: "secondary.dark"}},
                    },
                }}
            >
                <ToggleButton value="atomic" disabled={Boolean(trackingMode) || !atomicAvailable}>
                    Atomic
                </ToggleButton>
                <ToggleButton value="sequential" disabled={Boolean(trackingMode)}>
                    Sequential
                </ToggleButton>
            </ToggleButtonGroup>

            {atomicUnavailable && (
                <Alert
                    severity={atomicCheckFailed ? "warning" : "info"}
                    action={<Stack direction="row" spacing={0.5} alignItems="center">
                        <Button color="inherit" size="small" disabled={!controller.walletReady} onClick={() => void controller.checkCapability()}>
                            Check again
                        </Button>
                        <InfoHint
                            label="About atomic availability"
                            content={atomicCheckFailed
                                ? "The wallet could not confirm whether atomic batching is supported. Sequential mode is selected until a fresh capability check succeeds."
                                : "The connected wallet did not report atomic batching support on the plan network. Sequential execution sends each call separately; use Send now in an individual function or raw-call form to submit a single call outside the plan."}
                        />
                    </Stack>}
                >
                    {atomicCheckFailed
                        ? "Atomic support unknown. Sequential selected."
                        : "Atomic unavailable. Sequential selected."}
                </Alert>
            )}
            {safeBatchUnavailable && (
                <Alert severity="info">
                    Safe multi-call execution needs the Safe app or a connected Safe owner. Individual Safe transactions are selected.
                </Alert>
            )}

            <Box sx={{display: mode === "atomic" && !wallet.isSafeMode ? "block" : "none"}} aria-hidden={mode !== "atomic" || wallet.isSafeMode}>
                <AtomicBatchExecution controller={controller} />
            </Box>
            <Box sx={{display: wallet.isSafeMode || mode === "sequential" ? "block" : "none"}} aria-hidden={!wallet.isSafeMode && mode !== "sequential"}>
                <SequentialExecution mode={sequentialComponentMode} />
            </Box>
        </Stack>
    );
}
