import { Alert, Button, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { normalizeError, NormalizedError } from "../../callUtils";
import { shortAddress } from "../../calls/displayValues";
import { useTransactionPlan } from "../../transaction-plan/context";
import { selectCanForgetTrackedPlan } from "../../transaction-plan/selectors";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import ErrorDialog from "../ErrorDialog";
import ResponsiveDialog from "../ResponsiveDialog";

const sessionAlertSx = {
    flexDirection: {xs: "column", sm: "row"},
    alignItems: {xs: "stretch", sm: "center"},
    "& .MuiAlert-message": {minWidth: 0, width: {xs: "100%", sm: "auto"}},
    "& .MuiAlert-action": {
        alignSelf: {xs: "flex-end", sm: "center"},
        ml: {xs: 0, sm: "auto"},
        mr: 0,
        pt: {xs: 1, sm: 0},
        pl: {xs: 0, sm: 2},
    },
};

export default function SessionNotice() {
    const {state, dispatch, sessionStatus} = useTransactionPlan();
    const wallet = useWalletSession();
    const [error, setError] = useState<NormalizedError | null>(null);
    const [confirmForget, setConfirmForget] = useState(false);
    const context = state.plan.context;
    if (!context || sessionStatus === "ready" || sessionStatus === "empty") {
        return null;
    }

    const canForget = selectCanForgetTrackedPlan(state);
    const forgetButton = canForget ? (
        <Button color="inherit" size="small" onClick={() => setConfirmForget(true)}>
            Forget tracking
        </Button>
    ) : null;
    const forgetDialog = (
        <ResponsiveDialog open={confirmForget} onClose={() => setConfirmForget(false)}>
            <DialogTitle>Forget batch tracking?</DialogTitle>
            <DialogContent>
                <Typography>
                    This removes the local transaction plan and batch ID. It does not cancel, reverse, or change anything in the wallet or on-chain.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConfirmForget(false)}>Cancel</Button>
                <Button color="error" onClick={() => dispatch({type: "FORGET_TRACKED_PLAN"})}>Forget tracking</Button>
            </DialogActions>
        </ResponsiveDialog>
    );

    if (sessionStatus === "chain_mismatch") {
        return (
            <>
                <Alert
                    severity="error"
                    sx={sessionAlertSx}
                    action={<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => wallet.switchChain(context.chainId).catch((switchError) => {
                                setError(normalizeError(switchError, "Network switch failed"));
                            })}
                        >
                            Switch network
                        </Button>
                        {forgetButton}
                    </Stack>}
                >
                    This transaction plan belongs to chain {context.chainId}; the wallet is on chain {wallet.chainId}.
                </Alert>
                {forgetDialog}
                <ErrorDialog error={error} onClose={() => setError(null)} />
            </>
        );
    }

    if (sessionStatus === "account_mismatch") {
        return (
            <>
                <Alert
                    severity="error"
                    sx={sessionAlertSx}
                    action={<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => wallet.connectWallet().catch((connectError) => {
                                setError(normalizeError(connectError, "Wallet connection failed"));
                            })}
                        >
                            Reconnect account
                        </Button>
                        {forgetButton}
                    </Stack>}
                >
                    This transaction plan belongs to {shortAddress(context.account)}, but {wallet.account ? shortAddress(wallet.account) : "another account"} is connected.
                </Alert>
                {forgetDialog}
                <ErrorDialog error={error} onClose={() => setError(null)} />
            </>
        );
    }

    return (
        <>
            <Alert
                severity="warning"
                sx={sessionAlertSx}
                action={(
                    <Button
                        color="inherit"
                        size="small"
                        onClick={() => wallet.connectWallet().catch((connectError) => {
                            setError(normalizeError(connectError, "Wallet connection failed"));
                        })}
                    >
                        Connect wallet
                    </Button>
                )}
            >
                Connect {shortAddress(context.account)} on chain {context.chainId} to resume this plan.
            </Alert>
            <ErrorDialog error={error} onClose={() => setError(null)} />
        </>
    );
}
