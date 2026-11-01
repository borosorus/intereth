import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Button, Chip, IconButton, List, ListItem, Stack, Typography } from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import { monoFont } from "../ui/styles";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function SavedContractsList({contracts, onOpen, onRemove, compact = false}: {
    contracts: SavedContract[];
    onOpen: (entry: SavedContract) => void;
    onRemove: (entry: SavedContract) => void;
    compact?: boolean;
}) {
    return (
        <List dense disablePadding aria-label="Saved contract addresses">
            {contracts.map((entry) => (
                <ListItem key={`${entry.chainId}:${entry.address}`} divider sx={{display: "block", py: 1.25}}>
                    <Stack
                        direction={compact ? "column" : {xs: "column", sm: "row"}}
                        spacing={compact ? 1 : {xs: 1, sm: 2}}
                        alignItems={compact ? "stretch" : {xs: "stretch", sm: "center"}}
                    >
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
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={compact ? {alignSelf: "flex-end"} : undefined}>
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
    );
}
