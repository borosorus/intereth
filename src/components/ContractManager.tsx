import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControlLabel,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { ethers } from "ethers";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContractInstance } from "../contracts/workspace";
import { chains, chainsById } from "../onboard";
import { ABI_PRESETS, CONTRACT_EXAMPLES, ContractExample, formatAbi, ProviderDetails } from "../presets";
import {AbiLookupError, AbiLookupSource, fetchVerifiedAbi} from "../abiLookup";
import ErrorDialog from "./ErrorDialog";
import WorkspaceSectionHeader from "./WorkspaceSectionHeader";
import { NormalizedError, normalizeError } from "../callUtils";
import { useWalletSession } from "../wallet/WalletSessionContext";
import CopyButton from "./CopyButton";
import RpcUrlChip from "./RpcUrlChip";
import { ContractInterfaceFormat, parseContractInterface } from "../contractInterface";
import { DropdownGroupLabel, DropdownOptionContent, SelectInput, TextInput } from "./inputs/FormFields";
import { monoFont, workspaceSurfaceSx } from "../ui/styles";

enum CustomRpcState {
    disabled,
    connecting,
    failed,
    connected
}

type AbiPresetSelection = "custom" | (typeof ABI_PRESETS)[number]["id"];

type AbiLookupState =
    | {status: "idle" | "waiting" | "loading"}
    | {status: "success"; source: AbiLookupSource}
    | {status: "not-found" | "error"};

interface ContractManagerProps {
    addContract: (contract: ContractInstance) => void;
    showExamples: boolean;
}

const JSON_ABI_PLACEHOLDER = '[{"type":"function","name":"balanceOf","inputs":[{"name":"account","type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"}]';
const SOLIDITY_INTERFACE_PLACEHOLDER = "function balanceOf(address account) external view returns (uint256);\nfunction withdraw(address recipient, uint256 amount) external returns (uint256 received);";

const formSectionSx = {
    ...workspaceSurfaceSx,
    p: {xs: 1.5, sm: 2},
    borderColor: "#cbd5e1",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.07)",
};

function ExampleContractsRail({selectedAddress, onSelect}: {selectedAddress: string; onSelect: (example: ContractExample) => void}) {
    return (
        <Paper
            component="aside"
            variant="outlined"
            aria-label="Example contracts"
            sx={{...workspaceSurfaceSx, p: {xs: 1, sm: 1.5}, position: {md: "sticky"}, top: 88, bgcolor: "#f8fafc", borderColor: "rgba(148, 163, 184, 0.3)", boxShadow: "none"}}
        >
            <Stack spacing={0.5}>
                <Typography variant="subtitle2" color="text.secondary" sx={{fontWeight: 700, px: 0.5, pb: 0.5}}>Examples</Typography>
                <Stack divider={<Divider flexItem />}>
                    {CONTRACT_EXAMPLES.map((example) => {
                        const selected = selectedAddress.toLowerCase() === example.address.toLowerCase();
                        return (
                            <Box key={example.id} sx={{py: 1.5, px: 1.5, borderRadius: 1, bgcolor: selected ? "rgba(79, 70, 229, 0.035)" : "white"}}>
                                <Stack direction="column" spacing={0.8}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={0.75}>
                                        <Typography variant="body2" sx={{fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{example.label}</Typography>
                                        <Chip label={`Chain ID 1`} size="small" variant="outlined" />
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{minWidth: 0}}>
                                            <Typography variant="caption" color="text.secondary" sx={{minWidth: 0, fontFamily: monoFont, fontSize: "0.72rem", lineHeight: 1.5, whiteSpace: "nowrap"}}>
                                                {example.address.slice(0, 6)}…{example.address.slice(-4)}
                                            </Typography>
                                            <CopyButton value={example.address} label={`Copy ${example.label} address`} size="small" />
                                        </Stack>
                                        <Button
                                            variant="outlined"
                                            color={selected ? "secondary" : "primary"}
                                            size="small"
                                            onClick={() => onSelect(example)}
                                            sx={{fontWeight: 600, flex: "0 0 auto", px: 1}}
                                        >
                                            {selected ? "Selected" : "Use example"}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>
                        );
                    })}
                </Stack>
            </Stack>
        </Paper>
    );
}

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
            <Box sx={{minWidth: 0, maxWidth: "100%", fontSize: "0.875rem"}}>
                <RpcUrlChip url={details.url} />
            </Box>
            <Chip label={`Chain ID ${details.chainId}`} size="small" variant="outlined" sx={{flex: "0 0 auto"}} />
        </Stack>
    );
}

export default function ContractManager({addContract, showExamples}: ContractManagerProps) {
    const [address, setAddress] = useState('');
    const [label, setLabel] = useState('');
    const [abi, setAbi] = useState('');
    const [interfaceFormat, setInterfaceFormat] = useState<ContractInterfaceFormat>("json");
    const [abiPreset, setAbiPreset] = useState<AbiPresetSelection>("custom");
    const [automaticAbi, setAutomaticAbi] = useState(false);
    const [fetchedAbi, setFetchedAbi] = useState('');
    const [abiLookupState, setAbiLookupState] = useState<AbiLookupState>({status: "idle"});
    const [abiLookupRetry, setAbiLookupRetry] = useState(0);
    const [providerIndex, setProviderIndex] = useState(0);
    const [customRpc, setCustomRpc] = useState('');
    const [customRpcState, setCustomRpcState] = useState<CustomRpcState>(CustomRpcState.disabled);
    const [customRpcChainId, setCustomRpcChainId] = useState('');
    const [predefinedRpcState, setPredefinedRpcState] = useState<CustomRpcState>(CustomRpcState.disabled);
    const [useConnectedAccount, setUseConnectedAccount] = useState(false);
    const [managerError, setManagerError] = useState<NormalizedError | null>(null);
    const [isAddingInstance, setIsAddingInstance] = useState(false);
    const addressInputRef = useRef<HTMLInputElement>(null);

    const wallet = useWalletSession();
    const {signer, chainId: walletChainId, status: walletStatus, connectWallet, error: walletError, clearError: clearWalletError} = wallet;
    const executionAccount = wallet.executionAccount ?? wallet.account;
    const executionChainId = wallet.executionChainId ?? wallet.chainId;
    const safeAppRpcUrl = wallet.safeAppSdk && executionChainId ? chainsById.get(executionChainId)?.rpcUrl : undefined;
    const connectedAccountReady = Boolean((signer && walletChainId === executionChainId && (!wallet.isSafeMode || wallet.safeOwnerConnected))
        || (wallet.safeAppSdk && safeAppRpcUrl));

    useEffect(() => {
        if (walletStatus === "disconnected" && !wallet.safeAppSdk && useConnectedAccount) {
            setUseConnectedAccount(false);
        }
    }, [useConnectedAccount, wallet.safeAppSdk, walletStatus]);

    useEffect(() => {
        if (providerIndex === -1 || useConnectedAccount) {
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
    }, [providerIndex, useConnectedAccount]);

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

    const resolvedChainId = useConnectedAccount
        ? (connectedAccountReady ? executionChainId : null)
        : selectedProviderDetails?.chainId ?? null;
    const resolvedChainLabel = resolvedChainId
        ? chainsById.get(resolvedChainId)?.label ?? "Unknown network"
        : null;

    useEffect(() => {
        if (!automaticAbi) {
            setAbiLookupState({status: "idle"});
            return;
        }
        if (!ethers.isAddress(address) || !resolvedChainId) {
            setFetchedAbi('');
            setAbiLookupState({status: "waiting"});
            return;
        }

        const controller = new AbortController();
        setFetchedAbi('');
        setAbiLookupState({status: "loading"});
        const timer = window.setTimeout(() => {
            fetchVerifiedAbi({
                address: ethers.getAddress(address),
                chainId: resolvedChainId,
                signal: controller.signal,
            }).then((result) => {
                if (controller.signal.aborted) return;
                setFetchedAbi(JSON.stringify(result.abi, null, 2));
                setAbiLookupState({status: "success", source: result.source});
            }).catch((error) => {
                if (controller.signal.aborted) return;
                setAbiLookupState({status: error instanceof AbiLookupError && error.kind === "not-found" ? "not-found" : "error"});
            });
        }, 500);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [address, automaticAbi, abiLookupRetry, resolvedChainId]);

    const activeAbi = automaticAbi ? fetchedAbi : abi;
    const activeInterfaceFormat: ContractInterfaceFormat = automaticAbi ? "json" : interfaceFormat;

    const abiError = useMemo(() => {
        if (!activeAbi.trim()) {
            return '';
        }
        try {
            parseContractInterface(activeAbi, activeInterfaceFormat);
            return '';
        } catch {
            return activeInterfaceFormat === "json"
                ? 'Enter a valid JSON ABI.'
                : 'Enter valid Solidity function declarations.';
        }
    }, [activeAbi, activeInterfaceFormat]);

    const isAddressValid = ethers.isAddress(address);
    const canAddInstance = (!automaticAbi || abiLookupState.status === "success") && !abiError && (useConnectedAccount
        ? Boolean(connectedAccountReady && executionChainId && isAddressValid)
        : Boolean(isAddressValid && selectedProviderDetails));

    const tryChangeUseConnectedAccount = async () => {
        try {
            setManagerError(null);
            if (useConnectedAccount) {
                setUseConnectedAccount(false);
                return;
            }

            if (wallet.safeAppSdk) {
                setUseConnectedAccount(true);
                return;
            }

            if (signer) {
                setUseConnectedAccount(true);
                return;
            }

            const nextSigner = await connectWallet();
            if (nextSigner) {
                setUseConnectedAccount(true);
            }
        } catch (error) {
            setManagerError(normalizeError(error, "Wallet connection failed"));
        }
    };

    const getInterface = () => activeAbi.trim()
        ? parseContractInterface(activeAbi, activeInterfaceFormat)
        : new ethers.Interface(["fallback(bytes calldata data) external view"]);
    const contractLabel = () => label.trim() || `Contract ${address.slice(0, 8)}…${address.slice(-6)}`;

    const handleAddContract = async () => {
        if (!canAddInstance) {
            return;
        }

        try {
            setIsAddingInstance(true);
            setManagerError(null);
            if (useConnectedAccount && resolvedChainId && executionAccount) {
                const runner = signer && walletChainId === resolvedChainId
                    ? signer
                    : safeAppRpcUrl
                        ? new ethers.JsonRpcProvider(safeAppRpcUrl)
                        : null;
                if (!runner) return;
                addContract({
                    id: crypto.randomUUID(),
                    label: contractLabel(),
                    address: ethers.getAddress(address),
                    contract: new ethers.BaseContract(address, getInterface(), runner),
                    isStatic: false,
                    walletChainId: resolvedChainId,
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
                    label: contractLabel(),
                    address: ethers.getAddress(address),
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
            setInterfaceFormat("json");
            setAbi(formatAbi(preset.abi));
        }
    };

    const toggleAutomaticAbi = () => {
        if (automaticAbi) {
            if (abiLookupState.status === "success") {
                setAbi(fetchedAbi);
                setInterfaceFormat("json");
                setAbiPreset("custom");
            }
            setAutomaticAbi(false);
            return;
        }
        setAutomaticAbi(true);
    };

    const selectExample = (example: ContractExample) => {
        const ethereumIndex = chains.findIndex((chain) => chain.id === '1');
        setAddress(example.address);
        setLabel(example.label);
        setInterfaceFormat("json");
        setAbi(formatAbi(example.abi));
        setAbiPreset("custom");
        setAutomaticAbi(false);
        // An example fills the contract fields; it must not undo how the user
        // chose to reach the chain. In wallet mode the switch and the wallet's
        // own chain stay exactly as they are.
        if (!useConnectedAccount) {
            setProviderIndex(ethereumIndex >= 0 ? ethereumIndex : 0);
            setCustomRpc('');
            setCustomRpcChainId('');
            setCustomRpcState(CustomRpcState.disabled);
        }
        requestAnimationFrame(() => {
            addressInputRef.current?.scrollIntoView?.({behavior: "smooth", block: "center"});
            addressInputRef.current?.focus({preventScroll: true});
        });
    };

    return (
        <Box sx={showExamples
            ? {display: "grid", width: "100%", minWidth: 0, gridTemplateColumns: {xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 320px"}, gap: 2, alignItems: "start"}
            : {width: "100%", minWidth: 0}}>
        <Stack spacing={2.5} sx={{minWidth: 0}}>
            <Box sx={formSectionSx}>
                <Stack spacing={1.25}>
                    <WorkspaceSectionHeader title="Network & access" />
                    <Stack spacing={2} sx={{minWidth: 0}}>
                        <Box sx={{minWidth: 0}}>
                            <SelectInput<string | number>
                                    label="Connection"
                                    error={!useConnectedAccount && predefinedRpcState === CustomRpcState.failed}
                                    helperText={!useConnectedAccount && predefinedRpcState === CustomRpcState.connecting
                                        ? "Checking RPC endpoint..."
                                        : !useConnectedAccount && predefinedRpcState === CustomRpcState.failed
                                            ? "Unable to reach this RPC endpoint."
                                            : undefined}
                                    id="rpc-provider-select"
                                    value={useConnectedAccount ? "connected" : providerIndex}
                                    onChange={(event) => {
                                        if (event.target.value === "connected") {
                                            void tryChangeUseConnectedAccount();
                                            return;
                                        }
                                        if (useConnectedAccount) {
                                            setUseConnectedAccount(false);
                                        }
                                        setProviderIndex(event.target.value as number);
                                    }}
                                    renderValue={(value) => {
                                        let selectedLabel: string;
                                        if (value === "connected") {
                                            selectedLabel = wallet.isSafeMode ? "Active Safe" : "Connected account";
                                        } else if (value === -1) {
                                            selectedLabel = "Custom RPC";
                                        } else {
                                            const chain = chains[value as number];
                                            selectedLabel = chain ? `${chain.label} · Chain ${chain.id}` : "";
                                        }
                                        return (
                                            <Box component="span" sx={{display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                                                {selectedLabel}
                                            </Box>
                                        );
                                    }}
                                >
                                    <DropdownGroupLabel>Access method</DropdownGroupLabel>
                                    <MenuItem
                                        value="connected"
                                        sx={{
                                            "&:hover": {bgcolor: "rgba(79, 70, 229, 0.07)"},
                                        }}
                                    >
                                        <DropdownOptionContent
                                            primary={wallet.isSafeMode ? "Use active Safe" : "Use connected account"}
                                            secondary={wallet.isSafeMode ? "Read and execute as this Safe" : "Read and execute through your wallet"}
                                            metadata={useConnectedAccount ? <CheckCircleOutlineIcon fontSize="small" color="primary" /> : undefined}
                                            icon={<Box sx={{width: 34, height: 34, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 1, bgcolor: "rgba(79, 70, 229, 0.12)", color: "primary.main"}}><AccountBalanceWalletOutlinedIcon fontSize="small" /></Box>}
                                        />
                                    </MenuItem>
                                    <Divider sx={{my: 0.75}} />
                                    <DropdownGroupLabel>Network providers</DropdownGroupLabel>
                                    {chains.map((chain, index) => (
                                        <MenuItem key={chain.id} value={index}>
                                            <DropdownOptionContent primary={chain.label} metadata={<Typography variant="caption" color="text.secondary">Chain {chain.id}</Typography>} />
                                        </MenuItem>
                                    ))}
                                    <MenuItem value={-1}>
                                        <DropdownOptionContent primary="Custom RPC" secondary="Use your own endpoint" />
                                    </MenuItem>
                                </SelectInput>
                        </Box>
                        {providerIndex === -1 && !useConnectedAccount && (
                            <Box sx={{minWidth: 0}}>
                                <TextInput
                                    label="Custom RPC URL"
                                    fullWidth
                                    id="custom-rpc"
                                    value={customRpc}
                                    onChange={(event) => setCustomRpc(event.target.value)}
                                    error={customRpc !== '' && customRpcState === CustomRpcState.failed}
                                    helperText={customRpcState === CustomRpcState.connecting
                                        ? "Checking endpoint..."
                                        : customRpcState === CustomRpcState.failed
                                            ? "Unable to reach this RPC URL."
                                            : customRpcState === CustomRpcState.connected && customRpcChainId
                                                ? `Connected · Chain ${customRpcChainId}`
                                                : undefined}
                                    placeholder="https://rpc.example.org"
                                    technical
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                {renderCustomRpcProgress(customRpcState)}
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>
                        )}
                        {!useConnectedAccount && selectedProviderDetails && (
                            <Box sx={{minWidth: 0, px: 0.5}}>
                                <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 0.35, fontWeight: 700}}>
                                    {selectedProviderDetails.label}
                                </Typography>
                                <ProviderSummary details={selectedProviderDetails} />
                            </Box>
                        )}
                        {useConnectedAccount && connectedAccountReady && executionChainId && (
                            <Box sx={{minWidth: 0, px: 0.5}}>
                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" rowGap={0.75} sx={{minWidth: 0}}>
                                    <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                                        {resolvedChainLabel}
                                    </Typography>
                                    <Chip label={`Chain ID ${executionChainId}`} size="small" variant="outlined" />
                                    {executionAccount && <Chip label={`${wallet.isSafeMode ? "Safe" : "Account"} ${executionAccount.slice(0, 6)}…${executionAccount.slice(-4)}`} size="small" variant="outlined" />}
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Stack>
            </Box>

            <Box sx={formSectionSx}>
                <Stack spacing={1.25}>
                    <WorkspaceSectionHeader title="Contract" />
                    <TextInput
                        label="Contract address"
                        inputRef={addressInputRef}
                        value={address}
                        onChange={(event) => setAddress(event.target.value.trim())}
                        error={address !== '' && !isAddressValid}
                        helperText={address !== '' && !isAddressValid ? 'Enter a valid EVM address.' : undefined}
                        placeholder="0x…"
                        technical
                        fullWidth
                    />
                    <TextInput
                        label="Contract label"
                        optional
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        fullWidth
                    />
                </Stack>
            </Box>

            <Box sx={formSectionSx}>
                <Stack spacing={1.25}>
                    <WorkspaceSectionHeader
                        title="Contract interface"
                        hintLabel="About contract interfaces"
                        hintContent="Fetch a verified ABI, enter JSON or Solidity declarations, use a preset, or leave it empty for raw calls."
                        action={<FormControlLabel
                            control={<Switch checked={automaticAbi} onChange={toggleAutomaticAbi}/>}
                            label="Fetch ABI automatically"
                            sx={{mr: {sm: 0}, flex: "0 0 auto"}}
                        />}
                    />
                    <TextInput
                        label={activeInterfaceFormat === "json" ? "JSON ABI" : "Solidity interface"}
                        optional
                        placeholder={activeInterfaceFormat === "json" ? JSON_ABI_PLACEHOLDER : SOLIDITY_INTERFACE_PLACEHOLDER}
                        technical
                        multiline
                        rows={6}
                        value={activeAbi}
                        disabled={automaticAbi}
                        onChange={(event) => {
                            setAbi(event.target.value);
                            setAbiPreset("custom");
                        }}
                        error={!automaticAbi && Boolean(abiError)}
                        helperText={automaticAbi
                            ? (abiLookupState.status === "idle" || abiLookupState.status === "waiting"
                                ? "Enter a valid contract address after selecting a network."
                                : abiLookupState.status === "loading"
                                    ? "Looking for a verified ABI..."
                                    : abiLookupState.status === "success"
                                        ? `Fetched verified ABI from ${abiLookupState.source}.`
                                        : abiLookupState.status === "not-found"
                                            ? `No verified ABI was found for this address on chain ${resolvedChainId}.`
                                            : "ABI providers could not complete the lookup.")
                            : (abiError || (interfaceFormat === "json"
                                ? "Optional. Paste a JSON ABI array or leave empty for raw calls."
                                : "Optional. Enter semicolon-separated Solidity function declarations or leave empty for raw calls."))}
                        fullWidth
                        sx={{
                            "& textarea": {
                                overflowY: "auto",
                                resize: "none",
                            },
                        }}
                    />
                    {automaticAbi && (abiLookupState.status === "not-found" || abiLookupState.status === "error") && (
                        <Box>
                            <Button size="small" variant="outlined" onClick={() => setAbiLookupRetry((value) => value + 1)}>
                                Retry ABI lookup
                            </Button>
                        </Box>
                    )}
                    <Divider />
                    <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                        <Box sx={{width: {xs: "100%", sm: 220}}}>
                            <SelectInput<ContractInterfaceFormat>
                                label="Interface format"
                                disabled={automaticAbi}
                                size="small"
                                value={activeInterfaceFormat}
                                sx={{width: "100%"}}
                                onChange={(event) => {
                                    setInterfaceFormat(event.target.value as ContractInterfaceFormat);
                                    setAbiPreset("custom");
                                }}
                            >
                                <MenuItem value="json">JSON ABI</MenuItem>
                                <MenuItem value="solidity">Solidity interface</MenuItem>
                            </SelectInput>
                        </Box>
                        <Box sx={{width: {xs: "100%", sm: 220}}}>
                            <SelectInput<AbiPresetSelection>
                                label="ABI preset"
                                disabled={automaticAbi}
                                size="small"
                                value={abiPreset}
                                sx={{width: "100%"}}
                                onChange={(event) => selectAbiPreset(event.target.value as AbiPresetSelection)}
                                renderValue={(selection) => selection === "custom"
                                    ? "Custom ABI"
                                    : ABI_PRESETS.find((preset) => preset.id === selection)?.label ?? "ABI preset"}
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
                            </SelectInput>
                        </Box>
                    </Stack>
                </Stack>
            </Box>

            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <Typography variant="body2" color="text.secondary">
                    {useConnectedAccount
                        ? (connectedAccountReady
                            ? wallet.isSafeMode ? 'Using the active Safe account; calls route through its Safe connection.' : 'Using the connected account for this contract instance.'
                            : wallet.isSafeMode ? 'Connect a Safe owner wallet or open this page in the Safe app.' : 'Connect a wallet to enable interactive calls.')
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

            <ErrorDialog error={managerError ?? walletError} onClose={() => {
                setManagerError(null);
                clearWalletError();
            }} />
        </Stack>
        {showExamples && <ExampleContractsRail selectedAddress={address} onSelect={selectExample} />}
        </Box>
    );
}
