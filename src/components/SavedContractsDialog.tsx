import { Button, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import ResponsiveDialog from "./ResponsiveDialog";
import SavedContractsList from "./SavedContractsList";

export default function SavedContractsDialog({open, contracts, onClose, onUse, onRemove}: {
    open: boolean;
    contracts: SavedContract[];
    onClose: () => void;
    onUse: (entry: SavedContract) => void;
    onRemove: (entry: SavedContract) => void;
}) {
    return (
        <ResponsiveDialog open={open} onClose={onClose} maxWidth="sm" aria-labelledby="saved-contracts-title">
            <DialogTitle id="saved-contracts-title">Saved contracts</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                        Saved contracts keep only the label, address, ABI, and chain ID. Choosing one fills the add-contract form so you can pick the network and connection.
                    </Typography>
                    {contracts.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No saved contracts yet. Use the bookmark action on an open contract to save its label, address, and interface here.
                        </Typography>
                    ) : (
                        <SavedContractsList contracts={contracts} onUse={onUse} onRemove={onRemove} />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose}>Close</Button>
            </DialogActions>
        </ResponsiveDialog>
    );
}
