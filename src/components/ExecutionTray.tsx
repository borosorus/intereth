import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef } from "react";
import { shortAddress } from "../calls/displayValues";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import { executionPresentation, StateBadge, StateKind } from "./StateBadge";

// Slim bridge between the two views: while Explore is shown, this keeps the
// pending plan visible where the user is working and makes the next step
// (reviewing it in Execution) one click away. It only exists when there is
// something in the plan, and it mirrors the plan's execution state so a
// locked or troubled batch never looks like an idle draft.
export default function ExecutionTray({onHeightChange}: {onHeightChange?: (height: number) => void} = {}) {
    const {state, sessionStatus} = useTransactionPlan();
    const {requestExecution} = useTransactionPlanUi();
    const calls = state.plan.calls.length;
    const watches = state.plan.watches.length;
    const visible = calls > 0 || watches > 0;
    const regionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = regionRef.current;
        if (!node || !onHeightChange) return undefined;
        const report = () => onHeightChange(node.offsetHeight);
        report();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(report) : undefined;
        observer?.observe(node);
        window.addEventListener("resize", report);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", report);
        };
    }, [onHeightChange, visible]);

    if (!visible) return null;
    const context = state.plan.context;
    const counts = [
        calls > 0 ? `${calls} ${calls === 1 ? "call" : "calls"}` : null,
        watches > 0 ? `${watches} pinned ${watches === 1 ? "watch" : "watches"}` : null,
    ].filter(Boolean).join(" · ");

    let status: {kind: StateKind; label: string} | null = null;
    if (state.execution.status !== "idle") status = executionPresentation(state.execution.status);
    else if (state.sequentialExecution.status === "active") status = {kind: "wallet", label: "Sending one by one"};
    else if (sessionStatus === "chain_mismatch") status = {kind: "warning", label: "Wrong network"};
    else if (sessionStatus === "account_mismatch") status = {kind: "warning", label: "Wrong account"};
    else if (sessionStatus === "disconnected") status = {kind: "warning", label: "Wallet disconnected"};

    return (
        <Box ref={regionRef} sx={{position: "sticky", bottom: {xs: "calc(8px + env(safe-area-inset-bottom))", sm: 12}, zIndex: 1, pt: 1}}>
            <Paper variant="outlined" elevation={2} sx={{borderRadius: 2.5, px: 2, py: 1.25, bgcolor: "background.paper"}}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" rowGap={1}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" rowGap={0.5} sx={{minWidth: 0, maxWidth: "100%"}}>
                        <PlaylistPlayIcon fontSize="small" color="secondary" sx={{flex: "0 0 auto"}} />
                        <Typography variant="body2" sx={{fontWeight: 700, flex: "0 0 auto"}}>{counts}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{whiteSpace: "nowrap", display: {xs: "none", sm: "inline"}}}>in your plan</Typography>
                        {status && <StateBadge {...status} />}
                        {context && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{minWidth: 0}}>
                                · chain {context.chainId} · {shortAddress(context.account)}
                            </Typography>
                        )}
                    </Stack>
                    <Button size="small" variant="contained" onClick={requestExecution} sx={{flex: "0 0 auto"}}>
                        Review execution
                    </Button>
                </Stack>
            </Paper>
        </Box>
    );
}
