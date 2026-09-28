import { AppBar, Box, Stack, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from "@mui/material";
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
            <Toolbar sx={{display: "flex", gap: {xs: 1.25, sm: 2}, px: {xs: 2, sm: 3, md: 4}, minHeight: {xs: 64, sm: 72}, flexWrap: "wrap", rowGap: {xs: 1, sm: 0}}}>
              <Stack direction="row" spacing={{xs: 1, sm: 1.5}} alignItems="center" sx={{minWidth: 0}}>
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
              <Box sx={{display: "flex", justifyContent: "center", order: {xs: 3, sm: 0}, flex: {xs: "1 0 100%", sm: 1}}}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={activeView}
                  onChange={(_, view: WorkspaceView | null) => view && setActiveView(view)}
                  aria-label="Workspace view"
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "99px",
                    bgcolor: "background.paper",
                    p: 0.25,
                    gap: 0.25,
                    "& .MuiToggleButton-root": {
                      border: 0,
                      borderRadius: "99px !important",
                      gap: 0.75,
                      fontWeight: 700,
                      px: 1.75,
                      color: "text.secondary",
                      "&.Mui-selected": {bgcolor: "secondary.main", color: "#fff", "&:hover": {bgcolor: "secondary.dark"}},
                    },
                  }}
                >
                  <ToggleButton value="explore">
                    <ExploreOutlinedIcon fontSize="small" />
                    Explore
                  </ToggleButton>
                  <ToggleButton value="execution" aria-label={planCount > 0 ? `Execution (${planCount} in plan)` : "Execution"}>
                    <PlaylistPlayIcon fontSize="small" />
                    Execution
                    {planCount > 0 && <Box component="span" sx={{opacity: 0.75}}>({planCount})</Box>}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box sx={{flex: "0 0 auto", ml: "auto"}}><ConnectionButton/></Box>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
