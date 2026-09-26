import { AppBar, Box, Stack, Toolbar, Typography } from "@mui/material";
import ConnectionButton from "./ConnectionButton";

export default function Bar(){
    return (
      <Box>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'secondary.light',
            backdropFilter: 'blur(14px)',
            backgroundColor: 'rgba(255, 245, 240, 0.92)',
          }}
        >
            <Toolbar sx={{display: "flex", gap: {xs: 1.25, sm: 2}, px: {xs: 2, sm: 3, md: 4}, py: {xs: 1.25, sm: 1}, minHeight: {xs: 106, sm: 88}}}>
              <Stack direction="row" spacing={{xs: 1, sm: 1.5}} alignItems="center" sx={{minWidth: 0, flex: 1}}>
                <Box
                  component="img"
                  src={`${import.meta.env.BASE_URL}intereth-mark.svg`}
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
              <Box sx={{flex: "0 0 auto", ml: "auto"}}><ConnectionButton/></Box>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
