import { Paper, Stack, Typography } from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import SavedContractsList from "./SavedContractsList";
import { workspaceSurfaceSx } from "../ui/styles";

export default function SavedContractsRail({contracts, onOpen, onRemove}: {
    contracts: SavedContract[];
    onOpen: (entry: SavedContract) => void;
    onRemove: (entry: SavedContract) => void;
}) {
    return (
        <Paper
            component="aside"
            variant="outlined"
            aria-label="Saved contracts"
            sx={{...workspaceSurfaceSx, p: {xs: 1, sm: 1.5}, bgcolor: "#f8fafc", borderColor: "rgba(148, 163, 184, 0.3)", boxShadow: "none"}}
        >
            <Stack spacing={0.5}>
                <Typography variant="subtitle2" color="text.secondary" sx={{fontWeight: 700, px: 0.5, pb: 0.5}}>
                    Saved contracts{contracts.length > 0 ? ` (${contracts.length})` : ""}
                </Typography>
                {contracts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{px: 0.5}}>
                        No saved contracts yet. Bookmark a contract from the Contracts panel to reopen it here.
                    </Typography>
                ) : (
                    <SavedContractsList contracts={contracts} onOpen={onOpen} onRemove={onRemove} compact />
                )}
            </Stack>
        </Paper>
    );
}
