import {
    Box,
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Typography,
} from "@mui/material";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import { useState } from "react";
import { selectCallImpact } from "../../simulation/callImpact";
import { useSimulation } from "../../simulation/context";
import { shortAddress } from "../../calls/displayValues";
import { useTransactionPlan } from "../../transaction-plan/context";
import { useTransactionPlanUi } from "../../transaction-plan/uiContext";
import { executionPresentation, StateBadge } from "../StateBadge";
import WorkspaceSectionHeader from "../WorkspaceSectionHeader";
import ResponsiveDialog from "../ResponsiveDialog";
import SimulationInspector from "../simulation/SimulationInspector";
import WatchPanel from "../simulation/WatchPanel";
import InteractSimulationPreview from "../transaction-plan/InteractSimulationPreview";
import TransactionExecutionOptions from "../transaction-plan/TransactionExecutionOptions";
import { useAtomicBatchExecution } from "../transaction-plan/AtomicBatchExecution";
import PlanCallItem from "./PlanCallItem";
import SessionNotice from "./SessionNotice";

export default function ExecutionWorkspace({active = true}: {active?: boolean}) {
    const {state, dispatch} = useTransactionPlan();
    const {setActiveView} = useTransactionPlanUi();
    const simulation = useSimulation();
    const batchController = useAtomicBatchExecution(active);
    const [confirmClear, setConfirmClear] = useState(false);
    const calls = state.plan.calls;
    const watches = state.plan.watches;
    const context = state.plan.context;

    return (
        <Stack spacing={0} sx={{minWidth: 0}}>
            <Box sx={{pb: 2}}>
                <WorkspaceSectionHeader
                    title={<Typography component="span" variant="h5" sx={{fontWeight: 800, letterSpacing: -0.3}}>Execution</Typography>}
                    description={context
                        ? `Plan executes as ${shortAddress(context.account)} on chain ${context.chainId}.`
                        : "Calls you add from Explore run here, under one account and chain."}
                    action={state.execution.status !== "idle" ? (
                        <StateBadge {...executionPresentation(state.execution.status)} variant="filled" />
                    ) : undefined}
                />
            </Box>
            <Divider />

            <SessionNotice />

            <Box sx={{py: 2.5}}>
                <Stack spacing={1.5}>
                    <WorkspaceSectionHeader
                        title="Plan"
                        description={calls.length > 0 ? `${calls.length} ${calls.length === 1 ? "call" : "calls"}, executed top to bottom` : undefined}
                    />
                    {calls.length > 0 ? calls.map((call, index) => (
                        <PlanCallItem
                            key={call.id}
                            call={call}
                            index={index}
                            total={calls.length}
                            impact={selectCallImpact({callId: call.id, revision: simulation.revision, status: simulation.status, snapshot: simulation.snapshot})}
                            metadataByAddress={simulation.tokenMetadataByAddress}
                        />
                    )) : watches.length > 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            This plan has pinned watches but no plan calls. Add a state-changing call from Explore to simulate their combined effect.
                        </Typography>
                    ) : (
                        <Stack spacing={1.25} sx={{alignItems: "flex-start"}}>
                            <Typography variant="body2" color="text.secondary">
                                Nothing in the plan yet. Add state-changing calls from Explore with "Add to execution" to review them here before sending.
                            </Typography>
                            <Button size="small" variant="outlined" startIcon={<PlaylistAddCheckIcon />} onClick={() => setActiveView("explore")}>
                                Back to Explore
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </Box>

            <Divider />
            <Box sx={{py: 2.5}}>
                <WatchPanel emptyHint="Pin a read expression from Explore to track its on-chain and speculative values across this plan." />
            </Box>

            {calls.length > 0 && (
                <>
                    <Divider />
                    <Box sx={{py: 2.5}}>
                        <Stack spacing={1.5}>
                            <InteractSimulationPreview />
                            {simulation.snapshot && <SimulationInspector />}
                        </Stack>
                    </Box>
                    <Divider />
                    <Box sx={{py: 2.5}}>
                        <Stack spacing={1.5}>
                            <WorkspaceSectionHeader
                                title="Run plan"
                                description="Choose how the plan reaches the network: as an atomic wallet batch when supported, or as individual transactions one at a time."
                            />
                            <TransactionExecutionOptions controller={batchController} />
                        </Stack>
                    </Box>
                </>
            )}

            {(calls.length > 0 || watches.length > 0) && (
                <>
                    <Divider />
                    <Box sx={{py: 2}}>
                        <Button
                            color="error"
                            variant="outlined"
                            disabled={state.execution.status === "submitting"
                                || state.execution.status === "pending"
                                || state.sequentialExecution.status === "active"}
                            onClick={() => setConfirmClear(true)}
                        >
                            Clear plan
                        </Button>
                    </Box>
                </>
            )}

            <ResponsiveDialog open={confirmClear} onClose={() => setConfirmClear(false)}>
                <DialogTitle>Clear execution plan?</DialogTitle>
                <DialogContent>
                    <Typography>
                        This removes {[
                            calls.length > 0 ? `all ${calls.length} plan ${calls.length === 1 ? "call" : "calls"}` : null,
                            watches.length > 0 ? `${watches.length} pinned ${watches.length === 1 ? "watch" : "watches"}` : null,
                        ].filter(Boolean).join(" and ")}. This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            dispatch({type: "CLEAR_PLAN"});
                            setConfirmClear(false);
                        }}
                    >
                        Clear plan
                    </Button>
                </DialogActions>
            </ResponsiveDialog>
        </Stack>
    );
}
