import { AppBar, Box, Stack, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from "@mui/material";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import ConnectionButton from "./ConnectionButton";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi, WorkspaceView } from "../transaction-plan/uiContext";

export default function Bar(){
    const {state} = useTransactionPlan();
    const {activeView, setActiveView} = useTransactionPlanUi();
    const planCount = state.plan.calls.length;

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
            <Toolbar sx={{display: "flex", gap: {xs: 1.25, sm: 2}, px: {xs: 2, sm: 3, md: 4}, minHeight: {xs: 64, sm: 72}}}>
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
              <Box sx={{flex: 1, display: "flex", justifyContent: {xs: "flex-start", sm: "center"}}}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={activeView}
                  onChange={(_, view: WorkspaceView | null) => view && setActiveView(view)}
                  aria-label="Workspace view"
                >
                  <ToggleButton value="explore" sx={{gap: 0.75, fontWeight: 700}}>
                    <ExploreOutlinedIcon fontSize="small" />
                    Explore
                  </ToggleButton>
                  <ToggleButton value="execution" sx={{gap: 0.75, fontWeight: 700}}>
                    <PlaylistPlayIcon fontSize="small" />
                    Execution
                    {planCount > 0 && <Box component="span" sx={{color: "secondary.main"}}>({planCount})</Box>}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box sx={{flex: "0 0 auto", ml: "auto"}}><ConnectionButton/></Box>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
