import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Chip, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItemButton, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { DynamicContract } from "../App";
import ResponsiveDialog from "./ResponsiveDialog";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function chainId(contract: DynamicContract) {
    return contract.isStatic ? contract.providerDetails?.chainId ?? "Unknown chain" : contract.walletChainId;
}

export default function ContractNavigation({contracts, selectedId, onSelect, onRename, onDelete, onAdd}: {
    contracts: DynamicContract[];
    selectedId: string;
    onSelect: (id: string) => void;
    onRename: (id: string, label: string) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
}) {
    const [renaming, setRenaming] = useState<DynamicContract | null>(null);
    const [label, setLabel] = useState("");
    useEffect(() => setLabel(renaming?.label ?? ""), [renaming]);
    const selected = contracts.find((contract) => contract.id === selectedId) ?? contracts[0];

    const saveLabel = () => {
        if (!renaming || !label.trim()) return;
        onRename(renaming.id, label.trim());
        setRenaming(null);
    };

    return (
        <>
            <Box sx={{display: {xs: "block", md: "none"}, minWidth: 0}}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Select sx={{minWidth: 0, flex: 1}} size="small" value={selected.id} onChange={(event) => onSelect(event.target.value)} aria-label="Selected contract">
                        {contracts.map((contract) => (
                            <MenuItem key={contract.id} value={contract.id}>{contract.label} · {shortAddress(contract.address)}</MenuItem>
                        ))}
                    </Select>
                    <IconButton color="secondary" aria-label="Add contract" onClick={onAdd}><AddIcon /></IconButton>
                </Stack>
                {selected && (
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between" sx={{mt: 0.5, pl: 1}} aria-label="Selected contract actions">
                        <Typography variant="caption" color="text.secondary" noWrap sx={{minWidth: 0}}>
                            Chain {chainId(selected)} · {selected.isStatic ? "Read-only" : "Wallet"}
                        </Typography>
                        <Box sx={{display: "flex", flex: "0 0 auto"}}>
                            <IconButton size="small" aria-label={`Rename ${selected.label}`} onClick={() => setRenaming(selected)}><EditOutlinedIcon fontSize="small" /></IconButton>
                            <IconButton size="small" aria-label={`Delete ${selected.label}`} onClick={() => onDelete(selected.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Box>
                    </Stack>
                )}
            </Box>
            <Paper variant="outlined" sx={{display: {xs: "none", md: "block"}, borderRadius: 2.5, overflow: "hidden", alignSelf: "start", position: "sticky", top: 108}}>
                <Box sx={{p: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                    <Box><Typography variant="subtitle2" sx={{fontWeight: 800}}>Contracts</Typography><Typography variant="caption" color="text.secondary">{contracts.length} open {contracts.length === 1 ? "instance" : "instances"}</Typography></Box>
                    <IconButton size="small" color="secondary" aria-label="Add contract" onClick={onAdd}><AddIcon /></IconButton>
                </Box>
                <List disablePadding>
                    {contracts.map((contract) => (
                        <ListItemButton key={contract.id} selected={contract.id === selectedId} onClick={() => onSelect(contract.id)} sx={{alignItems: "flex-start", gap: 0.5, py: 1.25}}>
                            <Box sx={{minWidth: 0, flex: 1}}>
                                <Typography variant="body2" sx={{fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{contract.label}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">{shortAddress(contract.address)}</Typography>
                                <Stack direction="row" spacing={0.5} sx={{mt: 0.75}} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" variant="outlined" label={`Chain ${chainId(contract)}`} />
                                    <Chip size="small" color={contract.isStatic ? "primary" : "secondary"} variant="outlined" label={contract.isStatic ? "Read-only" : "Wallet"} />
                                </Stack>
                            </Box>
                            <Stack spacing={0.25}>
                                <IconButton size="small" aria-label={`Rename ${contract.label}`} onClick={(event) => {event.stopPropagation(); setRenaming(contract);}}><EditOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" aria-label={`Delete ${contract.label}`} onClick={(event) => {event.stopPropagation(); onDelete(contract.id);}}><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </Stack>
                        </ListItemButton>
                    ))}
                </List>
            </Paper>
            <ResponsiveDialog open={Boolean(renaming)} onClose={() => setRenaming(null)}>
                <DialogTitle>Rename contract</DialogTitle>
                <DialogContent><TextField autoFocus fullWidth label="Contract label" value={label} onChange={(event) => setLabel(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveLabel()} sx={{mt: 0.5}} /></DialogContent>
                <DialogActions><Button onClick={() => setRenaming(null)}>Cancel</Button><Button variant="contained" disabled={!label.trim()} onClick={saveLabel}>Save</Button></DialogActions>
            </ResponsiveDialog>
        </>
    );
}
