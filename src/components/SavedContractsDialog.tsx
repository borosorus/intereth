import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
    Button,
    Chip,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    Stack,
    Typography,
} from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import ResponsiveDialog from "./ResponsiveDialog";
import { monoFont } from "../ui/styles";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

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
                        <List dense disablePadding aria-label="Saved contract addresses">
                            {contracts.map((entry) => (
                                <ListItem key={`${entry.chainId}:${entry.address}`} divider sx={{display: "block", py: 1.25}}>
                                    <Stack direction={{xs: "column", sm: "row"}} spacing={{xs: 1, sm: 2}} alignItems={{xs: "stretch", sm: "center"}}>
                                        <Stack spacing={0.35} sx={{minWidth: 0, flex: 1}}>
                                            <Typography variant="body2" sx={{fontWeight: 700, overflowWrap: "anywhere"}}>{entry.label}</Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{fontFamily: monoFont, overflowWrap: "anywhere"}}>
                                                {shortAddress(entry.address)}
                                            </Typography>
                                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                                <Chip size="small" variant="outlined" label={`Chain ${entry.chainId}`} />
                                                <Chip size="small" variant="outlined" color={entry.access === "wallet" ? "secondary" : "primary"} label={entry.access === "wallet" ? "Connected account" : "Read-only RPC"} />
                                            </Stack>
                                        </Stack>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <Button size="small" variant="contained" color="secondary" onClick={() => onOpen(entry)}>
                                                Open
                                            </Button>
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                color="error"
                                                aria-label={`Remove saved contract ${entry.label}`}
                                                onClick={() => onRemove(entry)}
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    </Stack>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose}>Close</Button>
            </DialogActions>
        </ResponsiveDialog>
    );
}
