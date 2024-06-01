import { Box, Toolbar, Typography, AppBar } from "@mui/material";
import ConnectionButton from "./ConnectionButton";

export default function Bar(){
    return (
      <Box>
        <AppBar position="static">
          <Toolbar sx={{justifyContent: 'space-between'}}>
            <Typography variant="h6" component="div">
              Intereth
            </Typography>
            <ConnectionButton/>
          </Toolbar>
        </AppBar>
      </Box>
    );
}