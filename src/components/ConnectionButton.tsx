import { useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, Menu, MenuItem, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import LogoutIcon from "@mui/icons-material/Logout";
import { ethers } from "ethers";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import CopyButton from "./CopyButton";
import { NormalizedError, normalizeError } from "../callUtils";
import ErrorDialog from "./ErrorDialog";
import ResponsiveDialog from "./ResponsiveDialog";
import { TextInput } from "./inputs/FormFields";
import { monoFont } from "../ui/styles";

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function ConnectionButton() {
    const wallet = useWalletSession();
    const {state: planState} = useTransactionPlan();
    const [open, setOpen] = useState(false);
    const [address, setAddress] = useState("");
    const [busy, setBusy] = useState(false);
    const [disconnectingWallet, setDisconnectingWallet] = useState(false);
    const [walletMenuAnchor, setWalletMenuAnchor] = useState<HTMLElement | null>(null);
    const [busyAddress, setBusyAddress] = useState<string | null>(null);
    const [error, setError] = useState<NormalizedError | null>(null);
    const safe = wallet.safeAccount;
    const savedSafes = wallet.savedSafes ?? [];
    const hasSafeExecutionRecord = planState.sequentialExecution.calls.some((call) => Boolean(call.safeTxHash || call.safeBatch));
    const activePlanContext = planState.sequentialExecution.status === "active" ? planState.plan.context : null;
    const planContextIsRememberedSafe = Boolean(activePlanContext && savedSafes.some((entry) =>
        entry.address.toLowerCase() === activePlanContext.account.toLowerCase() && entry.chainId === activePlanContext.chainId,
    ));
    const safeExecutionInProgress = planState.sequentialExecution.status === "active"
        && Boolean(wallet.isSafeMode || hasSafeExecutionRecord || planContextIsRememberedSafe);
    const trackedSafeContext = safeExecutionInProgress ? activePlanContext : null;
    const isTrackedSafe = (safeAddress: string, chainId: string) => Boolean(
        trackedSafeContext
        && trackedSafeContext.account.toLowerCase() === safeAddress.toLowerCase()
        && trackedSafeContext.chainId === chainId,
    );

    const connect = async () => {
        try {
            setError(null);
            await wallet.connectWallet();
        } catch (caught) {
            setError(normalizeError(caught, "Wallet connection failed"));
        }
    };

    const disconnectWallet = async () => {
        try {
            setDisconnectingWallet(true);
            setWalletMenuAnchor(null);
            setError(null);
            if (!wallet.disconnectWallet) throw new Error("Wallet disconnection is unavailable.");
            await wallet.disconnectWallet();
        } catch (caught) {
            setError(normalizeError(caught, "Wallet disconnection failed"));
        } finally {
            setDisconnectingWallet(false);
        }
    };

    const selectSafe = async (safeAddress: string) => {
        try {
            setBusy(true);
            setBusyAddress(safeAddress);
            setError(null);
            if (!wallet.selectSafe) throw new Error("Safe selection is unavailable.");
            await wallet.selectSafe(safeAddress);
        } catch (caught) {
            setError(normalizeError(caught, "Safe verification failed"));
        } finally {
            setBusy(false);
            setBusyAddress(null);
        }
    };

    const removeSafe = (safeAddress: string, chainId: string) => {
        wallet.removeSavedSafe?.(safeAddress, chainId);
    };

    const switchToChain = async (chainId: string) => {
        try {
            setBusy(true);
            setError(null);
            await wallet.switchChain(chainId);
        } catch (caught) {
            setError(normalizeError(caught, "Network switch failed"));
        } finally {
            setBusy(false);
        }
    };

    const safeLabel = safe ? `Safe ${shortAddress(safe.address)}` : null;
    const hasSafeOwner = Boolean(wallet.account && safe?.owners.some((owner) => owner.toLowerCase() === wallet.account?.toLowerCase()));

    return (
        <Stack direction="row" spacing={0.75} alignItems="center">
            {wallet.account ? (
                <Stack direction="row" spacing={0} alignItems="stretch" sx={{borderRadius: "8px", bgcolor: "primary.main"}}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="medium"
                        startIcon={<AccountBalanceWalletOutlinedIcon />}
                        onClick={() => void connect()}
                        sx={{borderRadius: "8px 0 0 8px", textTransform: "none", fontWeight: 700, minHeight: 38, px: {xs: 1.1, sm: 1.5}, "& .MuiButton-startIcon": {mr: {xs: 0.5, sm: 0.75}}, "@media (pointer: coarse)": {minHeight: 44}}}
                    >
                        {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
                    </Button>
                    <Box sx={{display: "flex", alignItems: "center", borderLeft: "1px solid rgba(255,255,255,0.28)", borderTopRightRadius: "8px", borderBottomRightRadius: "8px", "&:hover": {bgcolor: "primary.dark"}, "& .MuiIconButton-root": {color: "primary.contrastText", bgcolor: "transparent", border: 0, borderRadius: 0, px: 0.65, minHeight: 38, "&:hover": {bgcolor: "rgba(255,255,255,0.14)"}, "@media (pointer: coarse)": {minHeight: 44}}}}>
                        <CopyButton value={wallet.account} label="Copy connected account address" size="small" />
                        <IconButton
                            aria-label="Wallet actions"
                            aria-haspopup="menu"
                            aria-expanded={Boolean(walletMenuAnchor)}
                            disabled={disconnectingWallet}
                            onClick={(event) => setWalletMenuAnchor(event.currentTarget)}
                        >
                            <MoreHorizIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Stack>
            ) : (
                <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    startIcon={wallet.status === "loading" ? <CircularProgress size={18} color="inherit" /> : <AccountBalanceWalletOutlinedIcon />}
                    onClick={() => void connect()}
                    sx={{borderRadius: "8px", textTransform: "none", fontWeight: 700, minHeight: 40, px: {xs: 1.1, sm: 1.75}, fontSize: "0.9rem", boxShadow: "0 2px 6px rgba(30, 41, 59, 0.16)", "& .MuiButton-startIcon": {mr: {xs: 0.5, sm: 0.75}}, "@media (pointer: coarse)": {minHeight: 44}}}
                >
                    <Box sx={{display: {xs: "none", md: "inline"}}}>{wallet.status === "loading" ? "Connecting…" : safe?.source === "manual" ? "Connect owner wallet" : "Connect wallet"}</Box>
                    <Box sx={{display: {xs: "inline", md: "none"}}}>{wallet.status === "loading" ? "Connecting…" : "Connect"}</Box>
                </Button>
            )}
            <Menu
                anchorEl={walletMenuAnchor}
                open={Boolean(walletMenuAnchor)}
                onClose={() => setWalletMenuAnchor(null)}
                anchorOrigin={{vertical: "bottom", horizontal: "right"}}
                transformOrigin={{vertical: "top", horizontal: "right"}}
            >
                <MenuItem onClick={() => void disconnectWallet()} disabled={disconnectingWallet || safeExecutionInProgress}>
                    {disconnectingWallet ? <CircularProgress size={16} sx={{mr: 1}} /> : <LogoutIcon fontSize="small" sx={{mr: 1}} />}
                    Disconnect wallet
                </MenuItem>
            </Menu>
            {(safe || wallet.account || savedSafes.length > 0) && (
                <Button
                    variant="outlined"
                    color="secondary"
                    size="medium"
                    startIcon={<SecurityOutlinedIcon />}
                    aria-label={safeLabel ? `Manage Safe ${safeLabel}` : wallet.account ? "Manage Safe accounts" : "Saved Safes"}
                    onClick={() => setOpen(true)}
                    sx={{
                        borderRadius: "8px",
                        textTransform: "none",
                        fontWeight: 700,
                        minHeight: 38,
                        px: {xs: 0.9, sm: 1.4},
                        fontSize: "0.9rem",
                        "& .MuiButton-startIcon": {mr: {xs: 0.5, sm: 0.75}},
                        borderWidth: 1.5,
                        "&.MuiButton-outlinedSecondary:not(.Mui-disabled)": {
                            bgcolor: safe ? "rgba(79, 70, 229, 0.12)" : "background.paper",
                        },
                        "&.MuiButton-outlinedSecondary:not(.Mui-disabled):hover": {
                            bgcolor: safe ? "rgba(79, 70, 229, 0.18)" : "rgba(79, 70, 229, 0.08)",
                        },
                        "@media (pointer: coarse)": {minHeight: 44},
                        "&:hover": {bgcolor: "rgba(79, 70, 229, 0.14)", borderWidth: 1.5},
                    }}
                >
                    <Box component="span" sx={{display: {xs: "none", md: "inline"}}}>{safeLabel ?? (wallet.account ? "Use Safe" : "Saved Safes")}</Box>
                    <Box component="span" sx={{display: {xs: "inline", md: "none"}}}>{safe ? "Safe" : wallet.account ? "Safe" : "Safes"}</Box>
                </Button>
            )}

            <ResponsiveDialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="sm" aria-labelledby="safe-accounts-title">
                <DialogTitle id="safe-accounts-title">Safe accounts</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.5}>
                        <Alert severity="info">
                            Saved Safe addresses stay in this browser when you disconnect. Intereth verifies ownership on chain when you choose a Safe. Removing an address only removes it from this browser; it does not change the Safe on chain.
                        </Alert>
                        {safe && (
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{border: "1px solid", borderColor: "divider", borderRadius: 2, px: 1.5, py: 0.75}}>
                                <Typography variant="body2" sx={{minWidth: 0, overflowWrap: "anywhere"}}>
                                    Active Safe: <Box component="span" sx={{fontFamily: monoFont}}>{safe.address}</Box>
                                </Typography>
                                <CopyButton value={safe.address} label="Copy active Safe address" size="small" />
                            </Stack>
                        )}
                    {savedSafes.length > 0 ? (
                            <List dense disablePadding aria-label="Saved Safe addresses">
                                {savedSafes.map((entry) => {
                                    const selected = safe?.address.toLowerCase() === entry.address.toLowerCase() && safe.chainId === entry.chainId;
                                    const sameNetwork = wallet.chainId === entry.chainId;
                                    const active = selected && sameNetwork && Boolean(wallet.safeAppSdk || wallet.safeOwnerConnected);
                                    const trackedSafe = isTrackedSafe(entry.address, entry.chainId);
                                    return (
                                        <ListItem
                                            key={`${entry.chainId}:${entry.address.toLowerCase()}`}
                                            divider
                                            sx={{display: "block", py: 1.25}}
                                        >
                                            <Stack direction={{xs: "column", sm: "row"}} spacing={{xs: 1, sm: 2}} alignItems={{xs: "stretch", sm: "center"}}>
                                                <ListItemText
                                                    sx={{minWidth: 0, my: 0}}
                                                    primary={<Typography variant="body2" sx={{fontFamily: monoFont, overflowWrap: "anywhere"}}>{entry.address}</Typography>}
                                                    secondary={`Chain ${entry.chainId}${active ? " · currently active" : trackedSafe ? " · Safe for tracked execution" : selected ? safeExecutionInProgress ? " · selected; switch back to the tracked Safe" : " · selected, switch network to use" : ""}`}
                                                />
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    {active ? (
                                                        <Chip size="small" color="secondary" label="Active" />
                                                    ) : (
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="secondary"
                                                            disabled={busy || !wallet.account || Boolean(wallet.safeAppSdk) || (safeExecutionInProgress && !trackedSafe)}
                                                            onClick={() => sameNetwork ? void selectSafe(entry.address) : void switchToChain(entry.chainId)}
                                                            sx={{minHeight: 32, px: 1.25, fontWeight: 700, boxShadow: "none", "@media (pointer: coarse)": {minHeight: 44}}}
                                                        >
                                                            {busyAddress === entry.address ? <CircularProgress size={16} color="inherit" /> : sameNetwork ? "Use" : "Switch network"}
                                                        </Button>
                                                    )}
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        aria-label={`Remove saved Safe ${shortAddress(entry.address)} on chain ${entry.chainId}`}
                                                        disabled={busy || (safeExecutionInProgress && trackedSafe)}
                                                        onClick={() => removeSafe(entry.address, entry.chainId)}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            </Stack>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        ) : (
                            <Typography variant="body2" color="text.secondary">No Safe addresses saved in this browser yet.</Typography>
                        )}
                        {(safe?.source === "manual" || (safe?.source === "connected-account" && hasSafeOwner && wallet.account?.toLowerCase() !== safe.address.toLowerCase())) && (
                            <Button variant="outlined" color="warning" disabled={safeExecutionInProgress && isTrackedSafe(safe.address, safe.chainId)} onClick={() => wallet.clearSafe?.()}>
                                Disconnect active Safe
                            </Button>
                        )}
                        {safeExecutionInProgress && <Alert severity="warning">Use the Safe for the active plan to continue tracking it. Intereth locks that Safe against removal and prevents switching to other Safes until you resolve or stop the plan.</Alert>}
                        {safe?.source === "safe-app" && (
                            <Alert severity="info">The active Safe is provided by the Safe app. Switch Safes from an owner wallet outside the Safe app.</Alert>
                        )}
                        {safe?.source === "connected-account" && !hasSafeOwner && (
                            <Alert severity="info">This Safe is the connected account. Connect one of its owner wallets to choose and use another Safe.</Alert>
                        )}
                        {safe?.source !== "safe-app" && (
                            <>
                                <TextInput
                                    label="Add a Safe address"
                                    placeholder="0x…"
                                    technical
                                    value={address}
                                    onChange={(event) => setAddress(event.target.value)}
                                    error={Boolean(address && !ethers.isAddress(address))}
                                    helperText={address && !ethers.isAddress(address) ? "Enter a valid EVM address." : `Connected account: ${wallet.account ?? "none"} · chain ${wallet.chainId ?? "unknown"}`}
                                    fullWidth
                                />
                                {!wallet.account && <Alert severity="warning">Connect a Safe owner wallet to verify and add an address.</Alert>}
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)} disabled={busy}>Close</Button>
                    {safe?.source !== "safe-app" && <Button onClick={() => void selectSafe(address)} disabled={busy || (safeExecutionInProgress && !isTrackedSafe(address, wallet.chainId ?? "")) || !ethers.isAddress(address) || !wallet.account || !wallet.chainId}>
                        {busy && !busyAddress ? <CircularProgress size={18} /> : "Verify and remember Safe"}
                    </Button>}
                </DialogActions>
            </ResponsiveDialog>
            <ErrorDialog error={error} onClose={() => setError(null)} />
        </Stack>
    );
}
