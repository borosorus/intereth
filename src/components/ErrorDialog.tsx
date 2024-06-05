import { Dialog, DialogTitle, Paper, Typography } from "@mui/material";

export default function ErrorDialog({error, setError}: {error: string, setError: React.Dispatch<React.SetStateAction<string>>}){
    return (
        <Dialog open={error !== ''} onClose={() => setError('')}>
            <Paper sx={{p: 2}}>
                <DialogTitle sx={{ m: 'auto', p: 2 }} id="customized-dialog-title">The call returned an error</DialogTitle>
                <Typography color='error'>{error}</Typography>
            </Paper>
        </Dialog>
    )
}