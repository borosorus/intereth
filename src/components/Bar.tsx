import { AppBar, Box, Stack, Toolbar, Typography } from "@mui/material";
import ConnectionButton from "./ConnectionButton";
import WorkspaceModeControl from "./WorkspaceModeControl";
import { useWorkspaceMode } from "../workspace/context";

export default function Bar(){
    const workspace = useWorkspaceMode();
    const simulated = workspace.mode === "simulate";
    return (
      <Box>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: simulated ? 'info.light' : 'secondary.light',
            backdropFilter: 'blur(14px)',
            backgroundColor: simulated ? 'rgba(235, 246, 255, 0.92)' : 'rgba(255, 245, 240, 0.92)',
            transition: 'background-color 180ms ease, border-color 180ms ease',
          }}
        >
            <Toolbar sx={{display: "flex", flexWrap: {xs: "wrap", sm: "nowrap"}, gap: {xs: 1.25, sm: 2}, px: {xs: 2, sm: 3, md: 4}, py: {xs: 1.25, sm: 1}, minHeight: {xs: 106, sm: 88}}}>
              <Stack direction="row" spacing={{xs: 1, sm: 1.5}} alignItems="center" sx={{minWidth: 0, flex: {xs: "1 1 150px", sm: "1 1 0"}, order: 1}}>
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
                    sx={{display: {xs: "none", sm: "block"}, mt: 0.35, fontSize: '0.875rem', lineHeight: 1.25}}
                  >
                    Inspect contracts, run calls, and switch providers without leaving the page.
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{order: {xs: 3, sm: 2}, flex: {xs: "1 0 100%", sm: "0 1 620px"}, display: "flex", justifyContent: "center"}}>
                <WorkspaceModeControl />
              </Box>
              <Box sx={{flex: "0 0 auto", order: {xs: 2, sm: 3}, ml: {sm: "auto"}}}><ConnectionButton/></Box>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
