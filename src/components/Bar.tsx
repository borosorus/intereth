import { AppBar, Box, Stack, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from "@mui/material";
import ConnectionButton from "./ConnectionButton";
import { WorkspaceMode, useWorkspaceMode } from "../workspace/context";

export default function Bar(){
    const workspace = useWorkspaceMode();

    return (
      <Box>
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(14px)',
            backgroundColor: 'rgba(244, 247, 251, 0.78)',
          }}
        >
            <Toolbar sx={{display: "flex", flexWrap: {xs: "wrap", sm: "nowrap"}, gap: {xs: 1.5, sm: 3}, px: {xs: 2, sm: 3, md: 4}, py: {xs: 1.5, sm: 0}, minHeight: {xs: 78, sm: 88}}}>
              <Stack direction="row" spacing={{xs: 1, sm: 1.5}} alignItems="center" sx={{minWidth: 0, flex: 1, order: 1}}>
                <Box
                  component="img"
                  src={`${process.env.PUBLIC_URL}/intereth-mark.svg`}
                  alt="Intereth logo"
                  sx={{width: {xs: 36, sm: 44}, height: {xs: 36, sm: 44}, flex: '0 0 auto'}}
                />
                <Box sx={{minWidth: 0}}>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{fontSize: {xs: '1.35rem', sm: '2rem'}, lineHeight: 1.05, fontWeight: 800, letterSpacing: -0.7}}
                  >
                    Intereth
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{mt: 0.35, fontSize: {xs: '0.68rem', sm: '0.875rem'}, lineHeight: 1.25}}
                  >
                    Inspect contracts, run calls, and switch providers without leaving the page.
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{order: {xs: 3, sm: 2}, width: {xs: "100%", sm: "auto"}, display: "flex", justifyContent: "center"}}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={workspace.mode}
                  onChange={(_, mode: WorkspaceMode | null) => {
                    if (mode) workspace.setMode(mode);
                  }}
                  aria-label="Workspace mode"
                  fullWidth
                  sx={{maxWidth: {xs: "none", sm: 280}, "& .MuiToggleButton-root": {px: {xs: 2, sm: 2.5}, textTransform: "none", fontWeight: 700}}}
                >
                  <ToggleButton value="interact">Interact</ToggleButton>
                  <ToggleButton value="simulate">Simulate</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box sx={{order: {xs: 2, sm: 3}, flex: "0 0 auto"}}><ConnectionButton/></Box>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
