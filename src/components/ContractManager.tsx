import { Box, Button, CircularProgress, FormControl, FormControlLabel, Grid, InputAdornment, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { chains } from "../onboard";
import { DynamicContract } from "../App";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

enum CustomRpcState {
    disabled,
    connecting,
    failed,
    connected
}

function renderCustomRpcProgress(state: CustomRpcState){
    switch(state){
        case CustomRpcState.failed:
            return <ErrorOutlineIcon color="error" fontSize="small" />;
        case CustomRpcState.connecting:
            return <CircularProgress size={18} />;
        case CustomRpcState.connected:
            return <CheckCircleOutlineIcon color="success" fontSize="small" />;
        default:
            return null;
    }
}

export default function ContractManager({addContract}: {addContract: (c: DynamicContract) => void}) {
    const [address, setAddress] = useState('');
    const [abi, setAbi] = useState('');
    const [providerIndex, setProviderIndex] = useState(0);
    const [customRpc, setCustomRpc] = useState('');
    const [customRpcState, setCustomRpcState] = useState<CustomRpcState>(CustomRpcState.disabled);
    const [useBrowserWallet, setUseBrowserWallet] = useState(false);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

    const [{wallet}, connect] = useConnectWallet();

    useEffect(() => {
        if (wallet?.provider) {
            (new ethers.BrowserProvider(wallet.provider)).getSigner().then((nextSigner) => setSigner(nextSigner));
        } else {
            setSigner(null);
        }
    }, [wallet]);

    useEffect(() => {
        if (!signer && useBrowserWallet) {
            setUseBrowserWallet(false);
        }
    }, [signer, useBrowserWallet]);

    useEffect(() => {
        if (providerIndex !== -1) {
            setCustomRpcState(CustomRpcState.disabled);
            return;
        }

        const rpcUrl = customRpc.trim();
        if (!rpcUrl) {
            setCustomRpcState(CustomRpcState.disabled);
            return;
        }

        let cancelled = false;
        setCustomRpcState(CustomRpcState.connecting);

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        provider._detectNetwork()
            .then(() => {
                if (!cancelled) {
                    setCustomRpcState(CustomRpcState.connected);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCustomRpcState(CustomRpcState.failed);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [customRpc, providerIndex]);

    const selectedRpcUrl = useMemo(() => {
        if (providerIndex === -1) {
            return customRpc.trim();
        }
        return chains[providerIndex]?.rpcUrl ?? '';
    }, [customRpc, providerIndex]);

    const isAddressValid = ethers.isAddress(address);
    const canAddInstance = useBrowserWallet
        ? Boolean(signer && isAddressValid)
        : Boolean(isAddressValid && selectedRpcUrl && (providerIndex !== -1 ? true : customRpcState === CustomRpcState.connected));

    const tryChangeUseBrowserWallet = async () => {
        if (useBrowserWallet) {
            setUseBrowserWallet(false);
            return;
        }

        if (signer) {
            setUseBrowserWallet(true);
            return;
        }

        const walletState = await connect();
        if (walletState[0]) {
            const nextSigner = await (new ethers.BrowserProvider(walletState[0].provider)).getSigner();
            setSigner(nextSigner);
            setUseBrowserWallet(true);
        }
    };

    const handleAddContract = () => {
        if (!isAddressValid) {
            return;
        }

        if (useBrowserWallet) {
            if (!signer) {
                return;
            }

            addContract({
                id: crypto.randomUUID(),
                contract: new ethers.BaseContract(address, new ethers.Interface(abi), signer),
                isStatic: false,
            });
            return;
        }

        if (!selectedRpcUrl) {
            return;
        }

        const provider = new ethers.JsonRpcProvider(selectedRpcUrl);
        const iface = abi === '' ? new ethers.Interface(["fallback(bytes calldata data) external view"]) : new ethers.Interface(abi);
        addContract({
            id: crypto.randomUUID(),
            contract: new ethers.BaseContract(address, iface, provider),
            isStatic: true,
        });
    };

    return (
        <Stack spacing={2}>
            <TextField
                label="Contract address"
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                error={address !== '' && !isAddressValid}
                helperText={address !== '' && !isAddressValid ? 'Enter a valid EVM address.' : 'Target contract address.'}
                fullWidth
            />
            <TextField
                label="Contract ABI"
                multiline
                minRows={4}
                value={abi}
                onChange={(e) => setAbi(e.target.value)}
                helperText="Optional. Leave empty to use the raw-call fallback."
                fullWidth
            />

            <Grid container spacing={2} alignItems="center">
                {!useBrowserWallet && (
                    <Grid item xs={12} md={7}>
                        <FormControl fullWidth>
                            <InputLabel id="rpc-provider-label">RPC Provider</InputLabel>
                            <Select
                                labelId="rpc-provider-label"
                                id="rpc-provider-select"
                                value={providerIndex}
                                label="RPC Provider"
                                onChange={(event) => setProviderIndex(event.target.value as number)}
                            >
                                {chains.map((chain, index) => <MenuItem key={index} value={index}>{chain.label}</MenuItem>)}
                                <MenuItem value={-1}>Custom</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                )}
                <Grid item xs={12} md={useBrowserWallet ? 12 : 5}>
                    <FormControlLabel
                        control={<Switch checked={useBrowserWallet} onChange={() => tryChangeUseBrowserWallet()}/>}
                        label="Use browser wallet"
                    />
                </Grid>
                {providerIndex === -1 && !useBrowserWallet && (
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            id="custom-rpc"
                            label="Custom HTTP RPC URL"
                            value={customRpc}
                            onChange={(e) => setCustomRpc(e.target.value)}
                            error={customRpc !== '' && customRpcState === CustomRpcState.failed}
                            helperText={
                                customRpcState === CustomRpcState.failed
                                    ? 'Unable to reach this RPC URL.'
                                    : 'A full HTTP RPC endpoint.'
                            }
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {renderCustomRpcProgress(customRpcState)}
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                )}
            </Grid>

            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <Typography variant="body2" color="text.secondary">
                    {useBrowserWallet
                        ? (signer ? 'Connected to browser wallet.' : 'Connect a browser wallet to enable interactive calls.')
                        : (providerIndex === -1
                            ? 'Using a custom RPC endpoint.'
                            : `Using ${chains[providerIndex]?.label ?? 'selected RPC'}.`)
                    }
                </Typography>
                <Button
                    variant="contained"
                    color="secondary"
                    disabled={!canAddInstance}
                    onClick={handleAddContract}
                >
                    Add Instance
                </Button>
            </Box>
        </Stack>
    );
}
