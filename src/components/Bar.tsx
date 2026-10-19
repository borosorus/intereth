import { AppBar, Box, Stack, ToggleButton, ToggleButtonGroup, Toolbar, Tooltip, Typography } from "@mui/material";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import ConnectionButton from "./ConnectionButton";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi, WorkspaceView } from "../transaction-plan/uiContext";

export default function Bar(){
    const {state} = useTransactionPlan();
    const {activeView, setActiveView} = useTransactionPlanUi();
    const planCount = state.plan.calls.length + state.plan.watches.length;

    return (
      <Box>
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
            <Toolbar sx={{display: "flex", position: "relative", gap: {xs: 1.25, sm: 2}, px: {xs: 2, sm: 3, md: 4}, py: {xs: 1, sm: 0}, minHeight: {xs: 64, sm: 72}, flexWrap: "wrap", rowGap: {xs: 1, sm: 0}}}>
              <Stack direction="row" spacing={{xs: 1, sm: 1.5}} alignItems="center" sx={{minWidth: 0, flex: "0 1 auto"}}>
                <Box
                  component="img"
                  src={`${import.meta.env.BASE_URL}intereth-mark.svg`}
                  alt="Intereth logo"
                  sx={{width: {xs: 32, sm: 40}, height: {xs: 32, sm: 40}, flex: '0 0 auto'}}
                />
                <Box sx={{minWidth: 0, display: {xs: "none", md: "block"}}}>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{fontSize: '1.5rem', lineHeight: 1.05, fontWeight: 800, letterSpacing: -0.5}}
                  >
                    Intereth
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{display: "flex", alignItems: "center", justifyContent: "center", order: {xs: 3, lg: 0}, flex: {xs: "1 0 100%", lg: 0}, position: {xs: "static", lg: "absolute"}, left: {lg: "50%"}, top: {lg: 0}, bottom: {lg: 0}, transform: {lg: "translateX(-50%)"}}}>
                <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{width: {xs: "100%", lg: "auto"}, minWidth: 0}}
                >
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={activeView}
                      onChange={(_, view: WorkspaceView | null) => view && setActiveView(view)}
                      aria-label="Workspace view"
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2.5,
                        bgcolor: "#f1f5f9",
                        p: 0.25,
                        gap: 0.25,
                        width: {xs: "100%", lg: "auto"},
                        flex: {xs: 1, lg: "0 0 auto"},
                        "& .MuiToggleButton-root": {
                          border: 0,
                          borderRadius: "8px !important",
                          gap: 0.75,
                          fontWeight: 700,
                          px: {xs: 2, sm: 3.5},
                          flex: {xs: 1, lg: "0 1 auto"},
                          color: "text.secondary",
                          "&.Mui-selected": {bgcolor: "secondary.main", color: "#fff", "&:hover": {bgcolor: "secondary.dark"}},
                        },
                      }}
                    >
                      <ToggleButton value="explore" aria-label="Explore">
                        <Tooltip describeChild placement="bottom" title="Explore contract functions, read state, prepare transactions, or add calls to your plan.">
                          <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: 0.75}}>
                            <ExploreOutlinedIcon fontSize="small" />
                            Explore
                          </Box>
                        </Tooltip>
                      </ToggleButton>
                      <ToggleButton value="execution" aria-label={planCount > 0 ? `Execution (${planCount} in plan)` : "Execution"}>
                        <Tooltip describeChild placement="bottom" title="Review ordered calls and pinned reads, inspect projected state, and choose how to submit the plan.">
                          <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: 0.75}}>
                            <PlaylistPlayIcon fontSize="small" />
                            Execution
                            {planCount > 0 && <Box component="span" sx={{opacity: 0.75}}>({planCount})</Box>}
                          </Box>
                        </Tooltip>
                      </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
              </Box>
              <Box sx={{display: "flex", justifyContent: "flex-end", flex: "0 0 auto", ml: "auto"}}><ConnectionButton/></Box>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
