import { Box, Container, Stack, Typography } from "@mui/material";

export default function Title(){

    return (
        <Container sx={{width: '100%', margin: 'auto'}}>
            <Stack direction='row' spacing={2} justifyContent={'center'} sx={{display: 'flex', alignItems: 'center'}}>
                <Box
                    component="img"
                    src= "/eth-logo.png"
                    alt="Ethereum Logo"
                    sx={{ width: 60}}
                />
                <Typography variant="h4">
                    EVM Playground
                </Typography>
            </Stack>
        </Container>

    )
}
