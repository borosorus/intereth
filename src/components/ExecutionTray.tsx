import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef } from "react";
import { shortAddress } from "../calls/displayValues";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import { actionButtonSx, workspaceSurfaceSx } from "../ui/styles";
import { planExecutionPresentation, StateBadge } from "./StateBadge";

// Floating plan summary for Explore. App keeps it at the lower right on
// narrow screens and floats it along the right edge on desktop.
export default function ExecutionTray({onHeightChange}: {onHeightChange?: (height: number) => void}) {
    const {state, sessionStatus} = useTransactionPlan();
    const {requestExecution} = useTransactionPlanUi();
    const calls = state.plan.calls.length;
    const watches = state.plan.watches.length;
    const visible = calls > 0 || watches > 0;
    const regionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = regionRef.current;
        if (!node || !onHeightChange) return undefined;
        const report = () => onHeightChange(node.parentElement?.clientHeight || node.offsetHeight);
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

    const status = planExecutionPresentation({
        execution: state.execution,
        sequential: state.sequentialExecution,
        sessionStatus,
        totalCalls: calls,
    });

    return (
        <Box ref={regionRef} sx={{minWidth: 0}}>
            <Paper variant="outlined" sx={{...workspaceSurfaceSx, p: {xs: 1.25, sm: 1.5, lg: 2}, boxShadow: "0 10px 28px rgba(15, 23, 42, 0.16)"}}>
                <Stack spacing={{xs: 1, sm: 1.25, lg: 1.5}} sx={{minWidth: 0}}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{minWidth: 0}}>
                        <PlaylistPlayIcon fontSize="small" color="secondary" sx={{flex: "0 0 auto"}} />
                        <Box sx={{minWidth: 0}}>
                            <Typography variant="subtitle2" sx={{fontWeight: 700}}>Execution plan</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{overflowWrap: "anywhere"}}>{counts}</Typography>
                        </Box>
                    </Stack>
                    {status && (
                        <Box sx={{
                            alignSelf: "flex-start",
                            maxWidth: "100%",
                            "& .MuiChip-root": {height: "auto", maxWidth: "100%"},
                            "& .MuiChip-label": {display: "block", whiteSpace: "normal", overflowWrap: "anywhere", py: 0.5},
                        }}>
                            <StateBadge {...status} />
                        </Box>
                    )}
                    {context && (
                        <Typography variant="caption" color="text.secondary" sx={{overflowWrap: "anywhere", minWidth: 0}}>
                            Chain {context.chainId} · {shortAddress(context.account)}
                        </Typography>
                    )}
                    <Button variant="contained" color="secondary" onClick={requestExecution} sx={actionButtonSx}>
                        Review execution
                    </Button>
                </Stack>
            </Paper>
        </Box>
    );
}
