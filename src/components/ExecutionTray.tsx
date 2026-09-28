import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { shortAddress } from "../calls/displayValues";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";

// Slim bridge between the two views: while Explore is shown, this keeps the
// pending plan visible where the user is working and makes the next step
// (reviewing it in Execution) one click away. It only exists when there is
// something in the plan.
export default function ExecutionTray() {
    const {state} = useTransactionPlan();
    const {requestExecution} = useTransactionPlanUi();
    const calls = state.plan.calls.length;
    const watches = state.plan.watches.length;
    if (calls === 0 && watches === 0) return null;
    const context = state.plan.context;
    const counts = [
        calls > 0 ? `${calls} ${calls === 1 ? "call" : "calls"}` : null,
        watches > 0 ? `${watches} pinned ${watches === 1 ? "watch" : "watches"}` : null,
    ].filter(Boolean).join(" · ");

    return (
        <Box sx={{position: "sticky", bottom: {xs: "calc(8px + env(safe-area-inset-bottom))", sm: 12}, zIndex: 1, pt: 1}}>
            <Paper variant="outlined" elevation={2} sx={{borderRadius: 2.5, px: 2, py: 1.25, bgcolor: "background.paper"}}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" rowGap={1}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{minWidth: 0}}>
                        <PlaylistPlayIcon fontSize="small" color="secondary" />
                        <Typography variant="body2" sx={{fontWeight: 700}}>{counts}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{whiteSpace: "nowrap"}}>in your plan</Typography>
                        {context && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{minWidth: 0}}>
                                · {shortAddress(context.account)} · chain {context.chainId}
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
