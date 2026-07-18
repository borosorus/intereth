import { AppBar, Box, Stack, Toolbar, Typography } from "@mui/material";
import ConnectionButton from "./ConnectionButton";

export default function Bar(){
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
            <Toolbar sx={{justifyContent: 'space-between', gap: {xs: 1.5, sm: 3}, px: {xs: 2, sm: 3, md: 4}, minHeight: {xs: 78, sm: 88}}}>
              <Stack direction="row" spacing={{xs: 1, sm: 1.5}} alignItems="center" sx={{minWidth: 0}}>
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
              <ConnectionButton/>
            </Toolbar>
        </AppBar>
      </Box>
    );
}
