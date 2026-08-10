import { Box, Button, Chip, Collapse, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { NormalizedError } from "../callUtils";
import CopyButton from "./CopyButton";
import ResponsiveDialog from "./ResponsiveDialog";

interface ErrorDialogProps {
    error: NormalizedError | null;
    onClose: () => void;
}

export default function ErrorDialog({error, onClose}: ErrorDialogProps) {
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        setShowDetails(false);
    }, [error]);

    return (
        <ResponsiveDialog open={error !== null} onClose={onClose} maxWidth="sm">
            <DialogTitle>{error?.title ?? "Error"}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5}>
                    <Typography color="error.main" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                        {error?.message}
                    </Typography>
                    {error?.code && <Chip label={error.code} size="small" variant="outlined" color="error" sx={{alignSelf: "flex-start"}} />}
                    {error?.details && (
                        <Box>
                            <Button size="small" onClick={() => setShowDetails((current) => !current)} sx={{textTransform: "none", px: 0}}>
                                {showDetails ? "Hide technical details" : "Show technical details"}
                            </Button>
                            <Collapse in={showDetails}>
                                <Box sx={{mt: 1, p: 1.5, borderRadius: 1.5, backgroundColor: "rgba(15, 23, 42, 0.05)"}}>
                                    <Typography
                                        variant="caption"
                                        component="pre"
                                        sx={{m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"}}
                                    >
                                        {error.details}
                                    </Typography>
                                </Box>
                            </Collapse>
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                {error?.details && <CopyButton value={error.details} label="Copy details" variant="text" />}
                <Button onClick={onClose} variant="contained">Close</Button>
            </DialogActions>
        </ResponsiveDialog>
    );
}
