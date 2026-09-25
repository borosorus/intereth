import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { useTransactionPlan } from "../transaction-plan/context";

export default function WorkspaceEmptyGuidance() {
    const {state} = useTransactionPlan();
    const empty = state.plan.calls.length === 0 && state.plan.watches.length === 0;
    if (!empty) return null;

    return (
        <Paper
            variant="outlined"
            sx={{p: 1.75, borderRadius: 2.5, borderColor: "secondary.light", bgcolor: "rgba(255,87,34,0.05)"}}
        >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{color: "secondary.main", mt: 0.15}}>
                    <BoltOutlinedIcon />
                </Box>
                <Box sx={{minWidth: 0, flex: 1}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 800, mb: 0.35}}>Start interacting</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Run read functions against canonical state, pin watches to track values across changes,
                        and for writes either send now through your wallet or add calls to a plan for review and atomic execution.
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}
