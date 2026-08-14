import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useTransactionPlan } from "../transaction-plan/context";
import { useWorkspaceMode } from "../workspace/context";

export default function WorkspaceEmptyGuidance() {
    const workspace = useWorkspaceMode();
    const {state} = useTransactionPlan();
    const empty = workspace.mode === "interact"
        ? state.plan.calls.length === 0
        : state.plan.calls.length === 0 && state.plan.watches.length === 0;
    if (!empty) return null;

    const simulate = workspace.mode === "simulate";
    return (
        <Paper
            variant="outlined"
            sx={{p: 1.75, borderRadius: 2.5, borderColor: simulate ? "info.light" : "secondary.light", bgcolor: simulate ? "rgba(33,150,243,0.055)" : "rgba(255,87,34,0.05)"}}
        >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{color: simulate ? "info.main" : "secondary.main", mt: 0.15}}>
                    {simulate ? <ScienceOutlinedIcon /> : <BoltOutlinedIcon />}
                </Box>
                <Box sx={{minWidth: 0, flex: 1}}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 0.35}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>{simulate ? "Build speculative state" : "Start interacting"}</Typography>
                        <Chip size="small" color={simulate ? "info" : "secondary"} variant="outlined" label={simulate ? "Simulate" : "Interact"} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {simulate
                            ? "Pin a read to watch its base and speculative values, or add a write to the queue to model state changes."
                            : "Run read functions against canonical state. For writes, send now through your wallet or add calls to the queue for atomic execution."}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}
