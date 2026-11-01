import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import { Badge, Box, Button, Chip, IconButton, List, ListItemButton, MenuItem, Paper, Stack, Typography } from "@mui/material";
import { ContractInstance } from "../contracts/workspace";
import { DropdownOptionContent, SelectControl } from "./inputs/FormFields";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

// Tighter form for the collapsed mobile switcher, where "label · shortAddress"
// does not fit next to the add button on a 320px screen.
function tinyAddress(address: string) {
    return /^0x[0-9a-fA-F]{40}$/.test(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : shortAddress(address);
}

function chainId(contract: ContractInstance) {
    return contract.isStatic ? contract.providerDetails?.chainId ?? "Unknown chain" : contract.walletChainId;
}

export default function ContractNavigation({contracts, selectedId, onSelect, onDelete, onAdd, onSave, onOpenSaved, savedCount}: {
    contracts: ContractInstance[];
    selectedId: string;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
    onSave: (id: string) => void;
    onOpenSaved: () => void;
    savedCount: number;
}) {
    const selected = contracts.find((contract) => contract.id === selectedId) ?? contracts[0];

    return (
        <>
            <Box sx={{display: {xs: "block", md: "none"}, minWidth: 0}}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{flex: 1, minWidth: 0}}>
                    <SelectControl
                        label="Selected contract"
                        visuallyHiddenLabel
                        size="small"
                        value={selected.id}
                        onChange={(event) => onSelect(event.target.value as string)}
                        renderValue={() => selected?.label ?? ""}
                        sx={{minWidth: 0}}
                    >
                        {contracts.map((contract) => (
                            <MenuItem key={contract.id} value={contract.id}>
                                <DropdownOptionContent primary={contract.label} secondary={shortAddress(contract.address)} />
                            </MenuItem>
                        ))}
                    </SelectControl>
                    </Box>
                    <IconButton color="secondary" aria-label={savedCount > 0 ? `Saved contracts (${savedCount})` : "Saved contracts"} onClick={onOpenSaved}>
                        <Badge badgeContent={savedCount} color="secondary" max={99}>
                            <BookmarksOutlinedIcon />
                        </Badge>
                    </IconButton>
                    <IconButton color="secondary" aria-label="Add contract" onClick={onAdd}><AddIcon /></IconButton>
                </Stack>
                {selected && (
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between" sx={{mt: 0.5}} aria-label="Selected contract actions">
                        <Typography variant="caption" color="text.secondary" sx={{minWidth: 0, lineHeight: 1.5}}>
                            Chain {chainId(selected)} · {selected.isStatic ? "Read-only RPC" : "Connected account"} · {tinyAddress(selected.address)}
                        </Typography>
                        <Box sx={{display: "flex", flex: "0 0 auto"}}>
                            <IconButton size="small" color="secondary" aria-label={`Save ${selected.label}`} onClick={() => onSave(selected.id)}><BookmarkAddOutlinedIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" aria-label={`Remove ${selected.label}`} onClick={() => onDelete(selected.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Box>
                    </Stack>
                )}
            </Box>
            <Paper variant="outlined" sx={{display: {xs: "none", md: "block"}, borderRadius: 2.5, overflow: "hidden", alignSelf: "start", position: "sticky", top: 88, borderColor: "#cbd5e1", bgcolor: "#fbfcfe"}}>
                <Box sx={{p: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "rgba(99, 102, 241, 0.04)"}}>
                    <Stack spacing={1}>
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 800}}>Contracts</Typography>
                            <Typography variant="caption" color="text.secondary">{contracts.length} open {contracts.length === 1 ? "instance" : "instances"}</Typography>
                        </Box>
                        <Stack spacing={0.75}>
                            <Button
                                size="small"
                                variant="contained"
                                color="secondary"
                                startIcon={<AddIcon fontSize="small" />}
                                onClick={onAdd}
                                fullWidth
                                sx={{justifyContent: "flex-start", textTransform: "none"}}
                            >
                                Add contract
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<BookmarksOutlinedIcon fontSize="small" />}
                                onClick={onOpenSaved}
                                fullWidth
                                sx={{justifyContent: "flex-start", textTransform: "none"}}
                            >
                                Saved contracts{savedCount > 0 ? ` (${savedCount})` : ""}
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
                <List disablePadding>
                    {contracts.map((contract) => (
                        <ListItemButton key={contract.id} selected={contract.id === selectedId} onClick={() => onSelect(contract.id)} sx={{alignItems: "flex-start", gap: 1, py: 1.5}}>
                            <Stack spacing={0.75} sx={{minWidth: 0, flex: 1}}>
                                <Typography variant="body2" sx={{fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{contract.label}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">{shortAddress(contract.address)}</Typography>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" variant="outlined" label={`Chain ${chainId(contract)}`} />
                                    <Chip size="small" color={contract.isStatic ? "primary" : "secondary"} variant="outlined" label={contract.isStatic ? "Read-only RPC" : "Connected account"} />
                                </Stack>
                            </Stack>
                            <Stack direction="row" spacing={0.25} sx={{flex: "0 0 auto"}}>
                                <IconButton size="small" color="secondary" aria-label={`Save ${contract.label}`} onClick={(event) => {event.stopPropagation(); onSave(contract.id);}}><BookmarkAddOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" color="error" aria-label={`Remove ${contract.label}`} onClick={(event) => {event.stopPropagation(); onDelete(contract.id);}}><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </Stack>
                        </ListItemButton>
                    ))}
                </List>
            </Paper>
        </>
    );
}
