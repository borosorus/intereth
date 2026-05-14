import { Box, Container, Stack, Typography } from "@mui/material";

export default function Title(){

    return (
        <Container sx={{width: '100%', margin: 'auto', px: 0}}>
            <Stack
                direction={{xs: 'column', sm: 'row'}}
                spacing={2}
                justifyContent="center"
                alignItems="center"
                sx={{py: {xs: 1, md: 2}}}
            >
                <Box
                    component="img"
                    src={`${process.env.PUBLIC_URL}/intereth-mark.svg`}
                    alt="Intereth logo"
                    sx={{ width: 40, height: 40 }}
                />
                <Box sx={{textAlign: {xs: 'center', sm: 'left'}}}>
                    <Typography variant="h3" sx={{fontWeight: 700, letterSpacing: -0.8}}>
                        Intereth
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Inspect contracts, run calls, and switch providers without leaving the page.
                    </Typography>
                </Box>
            </Stack>
        </Container>

    )
}
