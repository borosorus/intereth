import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

export default function ErrorDialog({error, setError}: {error: string, setError: React.Dispatch<React.SetStateAction<string>>}){
    return (
        <Dialog open={error !== ''} onClose={() => setError('')} maxWidth="sm" fullWidth>
            <DialogTitle>Error</DialogTitle>
            <DialogContent>
                <Typography color="error" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                    {error}
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setError('')} variant="contained">Close</Button>
            </DialogActions>
        </Dialog>
    )
}
