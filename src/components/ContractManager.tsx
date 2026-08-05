import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    InputAdornment,
    InputLabel,
    Link,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { ethers } from "ethers";
import { useEffect, useMemo, useRef, useState } from "react";
import { DynamicContract } from "../App";
import { chains } from "../onboard";
import { ABI_PRESETS, CONTRACT_EXAMPLES, ContractExample, formatAbi, ProviderDetails } from "../presets";
import ErrorDialog from "./ErrorDialog";
import { NormalizedError, normalizeError } from "../callUtils";
import { useWalletSession } from "../wallet/WalletSessionContext";

enum CustomRpcState {
    disabled,
    connecting,
    failed,
    connected
}

type AbiPresetSelection = "custom" | (typeof ABI_PRESETS)[number]["id"];

interface ContractManagerProps {
    addContract: (contract: DynamicContract) => void;
    showExamples: boolean;
}

const formSectionSx = {
    p: {xs: 1.5, sm: 2},
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 2.5,
    backgroundColor: "rgba(248, 250, 252, 0.58)",
};

const inputSurfaceSx = {
    "& .MuiOutlinedInput-root": {
        backgroundColor: "#fff",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(69, 90, 100, 0.3)",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "primary.main",
        },
        "&.Mui-focused": {
            boxShadow: "0 0 0 3px rgba(255, 87, 34, 0.12)",
        },
    },
};

const selectSurfaceSx = {
    backgroundColor: "#fff",
    "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(69, 90, 100, 0.3)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: "primary.main",
    },
    "&.Mui-focused": {
        boxShadow: "0 0 0 3px rgba(255, 87, 34, 0.12)",
    },
};

function renderCustomRpcProgress(state: CustomRpcState) {
    switch (state) {
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

function ProviderSummary({details}: {details: ProviderDetails}) {
    return (
        <Stack direction={{xs: "column", sm: "row"}} spacing={0.75} alignItems={{xs: "flex-start", sm: "center"}}>
            <Link
                href={details.url}
                target="_blank"
                rel="noreferrer"
                color="text.secondary"
                underline="hover"
                sx={{display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0, wordBreak: "break-all"}}
            >
                {details.url}
                <OpenInNewIcon sx={{fontSize: 14, flex: "0 0 auto"}} />
            </Link>
            <Chip label={`Chain ID ${details.chainId}`} size="small" variant="outlined" sx={{flex: "0 0 auto"}} />
        </Stack>
    );
}

export default function ContractManager({addContract, showExamples}: ContractManagerProps) {
    const [address, setAddress] = useState('');
    const [abi, setAbi] = useState('');
    const [abiPreset, setAbiPreset] = useState<AbiPresetSelection>("custom");
    const [providerIndex, setProviderIndex] = useState(0);
    const [customRpc, setCustomRpc] = useState('');
    const [customRpcState, setCustomRpcState] = useState<CustomRpcState>(CustomRpcState.disabled);
    const [customRpcChainId, setCustomRpcChainId] = useState('');
    const [predefinedRpcState, setPredefinedRpcState] = useState<CustomRpcState>(CustomRpcState.disabled);
    const [useBrowserWallet, setUseBrowserWallet] = useState(false);
    const [managerError, setManagerError] = useState<NormalizedError | null>(null);
    const [isAddingInstance, setIsAddingInstance] = useState(false);
    const addressInputRef = useRef<HTMLInputElement>(null);

    const {signer, status: walletStatus, connectWallet, error: walletError, clearError: clearWalletError} = useWalletSession();

    useEffect(() => {
        if (walletStatus === "disconnected" && useBrowserWallet) {
            setUseBrowserWallet(false);
        }
    }, [useBrowserWallet, walletStatus]);

    useEffect(() => {
        if (providerIndex === -1 || useBrowserWallet) {
            setPredefinedRpcState(CustomRpcState.disabled);
            return;
        }

        const chain = chains[providerIndex];
        if (!chain?.rpcUrl) {
            setPredefinedRpcState(CustomRpcState.failed);
            return;
        }

        let cancelled = false;
        let provider: ethers.JsonRpcProvider | null = new ethers.JsonRpcProvider(chain.rpcUrl);
        const activeProvider = provider;
        setPredefinedRpcState(CustomRpcState.connecting);

        activeProvider.getNetwork()
            .then((network) => {
                if (!cancelled) {
                    setPredefinedRpcState(network.chainId.toString() === chain.id
                        ? CustomRpcState.connected
                        : CustomRpcState.failed);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPredefinedRpcState(CustomRpcState.failed);
                }
            })
            .finally(() => {
                provider?.destroy();
                provider = null;
            });

        return () => {
            cancelled = true;
            const pendingProvider = provider;
            provider = null;
            pendingProvider?.destroy();
        };
    }, [providerIndex, useBrowserWallet]);

    useEffect(() => {
        if (providerIndex !== -1) {
            setCustomRpcState(CustomRpcState.disabled);
            setCustomRpcChainId('');
            return;
        }

        const rpcUrl = customRpc.trim();
        if (!rpcUrl) {
            setCustomRpcState(CustomRpcState.disabled);
            setCustomRpcChainId('');
            return;
        }

        let cancelled = false;
        let provider: ethers.JsonRpcProvider | null = null;
        setCustomRpcState(CustomRpcState.connecting);
        setCustomRpcChainId('');

        const validationTimer = window.setTimeout(() => {
            provider = new ethers.JsonRpcProvider(rpcUrl);
            provider.getNetwork()
                .then((network) => {
                    if (!cancelled) {
                        setCustomRpcChainId(network.chainId.toString());
                        setCustomRpcState(CustomRpcState.connected);
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setCustomRpcState(CustomRpcState.failed);
                        setCustomRpcChainId('');
                    }
                })
                .finally(() => {
                    provider?.destroy();
                    provider = null;
                });
        }, 500);

        return () => {
            cancelled = true;
            window.clearTimeout(validationTimer);
            const activeProvider = provider;
            provider = null;
            activeProvider?.destroy();
        };
    }, [customRpc, providerIndex]);

    const selectedRpcUrl = useMemo(() => {
        if (providerIndex === -1) {
            return customRpc.trim();
        }
        return chains[providerIndex]?.rpcUrl ?? '';
    }, [customRpc, providerIndex]);

    const selectedProviderDetails = useMemo<ProviderDetails | null>(() => {
        if (providerIndex === -1) {
            if (customRpcState !== CustomRpcState.connected || !selectedRpcUrl || !customRpcChainId) {
                return null;
            }
            return {label: "Custom RPC", url: selectedRpcUrl, chainId: customRpcChainId};
        }

        const chain = chains[providerIndex];
        return chain && predefinedRpcState === CustomRpcState.connected
            ? {label: chain.label, url: chain.rpcUrl, chainId: chain.id}
            : null;
    }, [customRpcChainId, customRpcState, predefinedRpcState, providerIndex, selectedRpcUrl]);

    const abiError = useMemo(() => {
        if (!abi.trim()) {
            return '';
        }
        try {
            new ethers.Interface(abi);
            return '';
        } catch {
            return 'Enter a valid JSON or human-readable ABI.';
        }
    }, [abi]);

    const isAddressValid = ethers.isAddress(address);
    const canAddInstance = !abiError && (useBrowserWallet
        ? Boolean(signer && isAddressValid)
        : Boolean(isAddressValid && selectedProviderDetails));

    const tryChangeUseBrowserWallet = async () => {
        try {
            setManagerError(null);
            if (useBrowserWallet) {
                setUseBrowserWallet(false);
                return;
            }

            if (signer) {
                setUseBrowserWallet(true);
                return;
            }

            const nextSigner = await connectWallet();
            if (nextSigner) {
                setUseBrowserWallet(true);
            }
        } catch (error) {
            setManagerError(normalizeError(error, "Wallet connection failed"));
        }
    };

    const getInterface = () => abi.trim()
        ? new ethers.Interface(abi)
        : new ethers.Interface(["fallback(bytes calldata data) external view"]);

    const handleAddContract = async () => {
        if (!canAddInstance) {
            return;
        }

        try {
            setIsAddingInstance(true);
            setManagerError(null);
            if (useBrowserWallet && signer) {
                addContract({
                    id: crypto.randomUUID(),
                    contract: new ethers.BaseContract(address, getInterface(), signer),
                    isStatic: false,
                });
                return;
            }

            if (!selectedProviderDetails) {
                return;
            }

            const provider = new ethers.JsonRpcProvider(selectedProviderDetails.url);
            try {
                const code = await provider.getCode(address);
                if (code === "0x") {
                    throw Object.assign(
                        new Error(`No contract bytecode was found at ${address} on chain ${selectedProviderDetails.chainId}.`),
                        {
                            code: "NO_CONTRACT_CODE",
                            shortMessage: `No contract bytecode was found at this address on ${selectedProviderDetails.label} (chain ${selectedProviderDetails.chainId}).`,
                        },
                    );
                }

                addContract({
                    id: crypto.randomUUID(),
                    contract: new ethers.BaseContract(address, getInterface(), provider),
                    isStatic: true,
                    providerDetails: selectedProviderDetails,
                });
            } catch (error) {
                provider.destroy();
                throw error;
            }
        } catch (error) {
            setManagerError(normalizeError(error, "Unable to add contract"));
        } finally {
            setIsAddingInstance(false);
        }
    };

    const selectAbiPreset = (selection: AbiPresetSelection) => {
        setAbiPreset(selection);
        if (selection === "custom") {
            return;
        }
        const preset = ABI_PRESETS.find((candidate) => candidate.id === selection);
        if (preset) {
            setAbi(formatAbi(preset.abi));
        }
    };

    const selectExample = (example: ContractExample) => {
        const ethereumIndex = chains.findIndex((chain) => chain.id === '1');
        setAddress(example.address);
        setAbi(formatAbi(example.abi));
        setAbiPreset("custom");
        setProviderIndex(ethereumIndex >= 0 ? ethereumIndex : 0);
        setCustomRpc('');
        setCustomRpcChainId('');
        setCustomRpcState(CustomRpcState.disabled);
        setUseBrowserWallet(false);
        requestAnimationFrame(() => {
            addressInputRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
            addressInputRef.current?.focus({preventScroll: true});
        });
    };

    return (
        <Stack spacing={2.5}>
            <Box sx={formSectionSx}>
                <Stack spacing={1.25}>
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Contract</Typography>
                        <Typography variant="caption" color="text.secondary">Choose the contract you want to inspect.</Typography>
                    </Box>
                    <TextField
                        inputRef={addressInputRef}
                        label="Contract address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value.trim())}
                        error={address !== '' && !isAddressValid}
                        helperText={address !== '' && !isAddressValid ? 'Enter a valid EVM address.' : 'Target contract address.'}
                        fullWidth
                        sx={inputSurfaceSx}
                    />
                </Stack>
            </Box>

            <Box sx={formSectionSx}>
                <Stack spacing={1.25}>
                    <Box sx={{display: "flex", alignItems: {xs: "stretch", sm: "center"}, justifyContent: "space-between", gap: 1.25, flexDirection: {xs: "column", sm: "row"}}}>
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 800}}>Contract interface</Typography>
                            <Typography variant="caption" color="text.secondary">Paste an ABI, use a preset, or leave it empty for raw calls.</Typography>
                        </Box>
                        <FormControl size="small" sx={{width: {xs: "100%", sm: 180}, flex: "0 0 auto"}}>
                            <InputLabel id="abi-preset-label">Preset</InputLabel>
                            <Select
                                labelId="abi-preset-label"
                                value={abiPreset}
                                label="Preset"
                                onChange={(event) => selectAbiPreset(event.target.value as AbiPresetSelection)}
                                renderValue={(selection) => selection === "custom"
                                    ? "Custom ABI"
                                    : ABI_PRESETS.find((preset) => preset.id === selection)?.label ?? "ABI preset"}
                                sx={selectSurfaceSx}
                            >
                                <MenuItem value="custom">Custom ABI</MenuItem>
                                {ABI_PRESETS.map((preset) => (
                                    <MenuItem key={preset.id} value={preset.id}>
                                        <Stack spacing={0.15}>
                                            <Typography variant="body2" sx={{fontWeight: 700}}>{preset.label}</Typography>
                                            <Typography variant="caption" color="text.secondary">{preset.description}</Typography>
                                        </Stack>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                    <TextField
                        label="Contract ABI"
                        multiline
                        minRows={4}
                        value={abi}
                        onChange={(event) => {
                            setAbi(event.target.value);
                            setAbiPreset("custom");
                        }}
                        error={Boolean(abiError)}
                        helperText={abiError || "Optional. Leave empty to use the raw-call fallback."}
                        fullWidth
                        sx={inputSurfaceSx}
                    />
                </Stack>
            </Box>

            <Box sx={formSectionSx}>
                <Stack spacing={1.25}>
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 800}}>Connection</Typography>
                        <Typography variant="caption" color="text.secondary">Select an RPC for read-only access or use your browser wallet.</Typography>
                    </Box>
                    <Grid container spacing={2} alignItems="center">
                {!useBrowserWallet && (
                    <Grid item xs={12} md={7}>
                        <FormControl fullWidth error={predefinedRpcState === CustomRpcState.failed}>
                            <InputLabel id="rpc-provider-label">RPC Provider</InputLabel>
                            <Select
                                labelId="rpc-provider-label"
                                id="rpc-provider-select"
                                value={providerIndex}
                                label="RPC Provider"
                                onChange={(event) => setProviderIndex(event.target.value as number)}
                                sx={selectSurfaceSx}
                            >
                                {chains.map((chain, index) => <MenuItem key={chain.id} value={index}>{chain.label}</MenuItem>)}
                                <MenuItem value={-1}>Custom</MenuItem>
                            </Select>
                            {predefinedRpcState === CustomRpcState.connecting && (
                                <FormHelperText>Checking RPC endpoint...</FormHelperText>
                            )}
                            {predefinedRpcState === CustomRpcState.failed && (
                                <FormHelperText>Unable to reach this RPC endpoint.</FormHelperText>
                            )}
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
                            onChange={(event) => setCustomRpc(event.target.value)}
                            error={customRpc !== '' && customRpcState === CustomRpcState.failed}
                            helperText={customRpcState === CustomRpcState.failed ? 'Unable to reach this RPC URL.' : 'A full HTTP RPC endpoint.'}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {renderCustomRpcProgress(customRpcState)}
                                    </InputAdornment>
                                ),
                            }}
                            sx={inputSurfaceSx}
                        />
                    </Grid>
                )}
                {!useBrowserWallet && selectedProviderDetails && (
                    <Grid item xs={12}>
                        <Box sx={{px: 0.5}}>
                            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 0.35, fontWeight: 700}}>
                                {selectedProviderDetails.label}
                            </Typography>
                            <ProviderSummary details={selectedProviderDetails} />
                        </Box>
                    </Grid>
                )}
                    </Grid>
                </Stack>
            </Box>

            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <Typography variant="body2" color="text.secondary">
                    {useBrowserWallet
                        ? (signer ? 'Connected to browser wallet.' : 'Connect a browser wallet to enable interactive calls.')
                        : (selectedProviderDetails ? `Ready on ${selectedProviderDetails.label}.` : 'Waiting for a valid RPC connection.')}
                </Typography>
                <Button
                    variant="contained"
                    color="secondary"
                    disabled={!canAddInstance || isAddingInstance}
                    onClick={handleAddContract}
                    sx={{px: 3, py: 1.1, borderRadius: 2, textTransform: "none", fontWeight: 700}}
                >
                    {isAddingInstance ? <CircularProgress size={20} color="inherit" /> : "Add instance"}
                </Button>
            </Box>

            {showExamples && (
                <>
                    <Divider />
                    <Box>
                        <Typography variant="overline" color="secondary.main" sx={{fontWeight: 800, letterSpacing: "0.12em"}}>
                            Explore Ethereum
                        </Typography>
                        <Typography variant="h6" sx={{fontWeight: 800, mb: 0.5}}>
                            Start with an example contract
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                            Choose an example to fill the form, review its ABI, then add it when you are ready.
                        </Typography>
                        <Grid container spacing={1.5}>
                            {CONTRACT_EXAMPLES.map((example) => (
                                <Grid item xs={12} md={4} key={example.id}>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            height: "100%",
                                            p: 2,
                                            borderRadius: 2.5,
                                            background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(238,242,248,0.72))",
                                        }}
                                    >
                                        <Stack spacing={1.5} sx={{height: "100%"}}>
                                            <Box>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                    <Typography variant="subtitle1" sx={{fontWeight: 800}}>{example.label}</Typography>
                                                    <Chip label="Ethereum" size="small" color="primary" variant="outlined" />
                                                </Stack>
                                                <Typography variant="body2" color="text.secondary" sx={{mt: 0.75}}>
                                                    {example.description}
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all"}}
                                            >
                                                {example.address}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                color="secondary"
                                                onClick={() => selectExample(example)}
                                                sx={{mt: "auto", textTransform: "none", fontWeight: 700}}
                                            >
                                                Use example
                                            </Button>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </>
            )}
            <ErrorDialog error={managerError ?? walletError} onClose={() => {
                setManagerError(null);
                clearWalletError();
            }} />
        </Stack>
    );
}
