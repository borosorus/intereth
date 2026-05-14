import { Box, Toolbar, Typography, AppBar } from "@mui/material";
import ConnectionButton from "./ConnectionButton";

export default function Bar(){
    return (
      <Box sx={{position: 'sticky', top: 0, zIndex: (theme) => theme.zIndex.appBar}}>
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
          <Toolbar sx={{justifyContent: 'space-between', minHeight: {xs: 64, sm: 72}}}>
            <Box>
              <Typography variant="h6" component="div" sx={{fontWeight: 700, letterSpacing: -0.2}}>
                intereth
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Contract explorer and call console
              </Typography>
            </Box>
            <ConnectionButton/>
          </Toolbar>
        </AppBar>
      </Box>
    );
}
