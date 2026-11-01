import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Button, Chip, IconButton, List, ListItem, Stack, Typography } from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import { monoFont } from "../ui/styles";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function SavedContractsList({contracts, onUse, onRemove, compact = false}: {
    contracts: SavedContract[];
    onUse: (entry: SavedContract) => void;
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
                            <Typography variant="body2" sx={{fontFamily: monoFont, overflowWrap: "anywhere"}}>
                                {compact ? shortAddress(entry.address) : entry.address}
                            </Typography>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                <Chip size="small" variant="outlined" label={`Chain ${entry.chainId}`} />
                            </Stack>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={compact ? {alignSelf: "flex-end"} : undefined}>
                            <Button size="small" variant="contained" color="secondary" onClick={() => onUse(entry)}>
                                Use
                            </Button>
                            <IconButton
                                edge="end"
                                size="small"
                                color="error"
                                aria-label={`Remove saved contract ${shortAddress(entry.address)} on chain ${entry.chainId}`}
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
