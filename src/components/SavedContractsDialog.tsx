import { Button, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import ResponsiveDialog from "./ResponsiveDialog";
import SavedContractsList from "./SavedContractsList";

export default function SavedContractsDialog({open, contracts, onClose, onOpen, onRemove}: {
    open: boolean;
    contracts: SavedContract[];
    onClose: () => void;
    onOpen: (entry: SavedContract) => void;
    onRemove: (entry: SavedContract) => void;
}) {
    return (
        <ResponsiveDialog open={open} onClose={onClose} maxWidth="sm" aria-labelledby="saved-contracts-title">
            <DialogTitle id="saved-contracts-title">Saved contracts</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                        Saved contracts stay in this browser. Opening a wallet contract without a matching wallet and network opens it read-only.
                    </Typography>
                    {contracts.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No saved contracts yet. Use the bookmark action on an open contract to save its address, interface, and network here.
                        </Typography>
                    ) : (
                        <SavedContractsList contracts={contracts} onOpen={onOpen} onRemove={onRemove} />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose}>Close</Button>
            </DialogActions>
        </ResponsiveDialog>
    );
}
