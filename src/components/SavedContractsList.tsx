import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Button, Chip, IconButton, List, ListItem, Stack, Typography } from "@mui/material";
import { SavedContract } from "../contracts/savedContracts";
import CopyButton from "./CopyButton";
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
                <ListItem
                    key={`${entry.chainId}:${entry.address}`}
                    divider
                    sx={{display: "block", py: 1.5, px: 1.5, bgcolor: "white"}}
                >
                    <Stack spacing={0.8}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={0.75}>
                            <Typography variant="body2" sx={{fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                                {entry.label}
                            </Typography>
                            <Chip label={`Chain ${entry.chainId}`} size="small" variant="outlined" sx={{flex: "0 0 auto"}} />
                        </Stack>
                        <Stack
                            direction={{xs: "column", sm: "row"}}
                            spacing={1}
                            alignItems={{xs: "stretch", sm: "center"}}
                            justifyContent="space-between"
                            sx={{minWidth: 0}}
                        >
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{minWidth: 0}}>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        minWidth: 0,
                                        fontFamily: monoFont,
                                        fontSize: "0.72rem",
                                        lineHeight: 1.5,
                                        overflowWrap: "anywhere",
                                        whiteSpace: compact ? "nowrap" : undefined,
                                    }}
                                >
                                    {compact ? shortAddress(entry.address) : entry.address}
                                </Typography>
                                <CopyButton value={entry.address} label={`Copy ${entry.label} address`} />
                            </Stack>
                            <Box sx={{display: "flex", gap: 0.5, alignItems: "center", flex: "0 0 auto", alignSelf: {xs: "flex-end", sm: "auto"}}}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    aria-label={`Use saved contract ${shortAddress(entry.address)} on chain ${entry.chainId}`}
                                    onClick={() => onUse(entry)}
                                    sx={{fontWeight: 600, px: 1}}
                                >
                                    Use
                                </Button>
                                <IconButton
                                    size="small"
                                    color="error"
                                    aria-label={`Remove saved contract ${shortAddress(entry.address)} on chain ${entry.chainId}`}
                                    onClick={() => onRemove(entry)}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Stack>
                    </Stack>
                </ListItem>
            ))}
        </List>
    );
}
