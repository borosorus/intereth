import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import SafeAppsSDK, { SafeInfoExtended } from "@safe-global/safe-apps-sdk";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NormalizedError, normalizeError } from "../callUtils";
import Safe from "@safe-global/protocol-kit";
import { readActiveSafe, readSavedSafes, safeAddressKey, SavedSafeAddress, writeActiveSafe, writeSavedSafes } from "./safeStorage";

export type WalletSessionStatus = "disconnected" | "loading" | "ready" | "error";

export interface WalletSession {
    status: WalletSessionStatus;
    provider: ethers.BrowserProvider | null;
    injectedProvider?: unknown;
    signer: ethers.JsonRpcSigner | null;
    account: string | null;
    chainId: string | null;
    safeAccount?: SafeAccountInfo | null;
    safeAppSdk?: SafeAppsSDK | null;
    executionAccount?: string | null;
    executionChainId?: string | null;
    isSafeMode?: boolean;
    safeOwnerConnected?: boolean;
    selectSafe?: (address: string) => Promise<SafeAccountInfo>;
    clearSafe?: () => void;
    savedSafes?: SavedSafeAddress[];
    removeSavedSafe?: (address: string, chainId: string) => void;
    error: NormalizedError | null;
    clearError: () => void;
    connectWallet: () => Promise<ethers.JsonRpcSigner | null>;
    disconnectWallet?: () => Promise<void>;
    switchChain: (chainId: string) => Promise<void>;
}

export interface SafeAccountInfo {
    address: string;
    chainId: string;
    owners: string[];
    threshold: number;
    nonce: number;
    version: string | null;
    source: "safe-app" | "manual" | "connected-account";
}

const WalletSessionContext = createContext<WalletSession | null>(null);

function normalizedAddress(address: string) {
    return ethers.getAddress(address);
}

function storedSafeSelection(): SafeAccountInfo | null {
    const value = readActiveSafe();
    return value ? { ...value, owners: [], threshold: 0, nonce: 0, version: null, source: "manual" } : null;
}

export function WalletSessionProvider({children}: {children: ReactNode}) {
    const [{wallet}, connect, disconnect] = useConnectWallet();
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<string | null>(null);
    const [status, setStatus] = useState<WalletSessionStatus>("disconnected");
    const [error, setError] = useState<NormalizedError | null>(null);
    const [savedSafes, setSavedSafes] = useState<SavedSafeAddress[]>(() => readSavedSafes());
    const [safeAccount, setSafeAccount] = useState<SafeAccountInfo | null>(() => storedSafeSelection());
    const [safeAppSdk, setSafeAppSdk] = useState<SafeAppsSDK | null>(null);
    const safeSelectionRequest = useRef(0);
    const currentWalletIdentity = useRef({account, chainId});
    currentWalletIdentity.current = {account, chainId};

    // Safe App identity comes from the host handshake, never from merely
    // running in an iframe. Outside Safe the request times out quickly.
    useEffect(() => {
        if (window.parent === window) return;
        const sdk = new SafeAppsSDK();
        let cancelled = false;
        let timeout: number | undefined;
        Promise.race([
            sdk.safe.getInfo(),
            new Promise<never>((_, reject) => {
                timeout = window.setTimeout(() => reject(new Error("Safe host handshake timed out")), 5000);
            }),
        ]).then((info: SafeInfoExtended) => {
            if (cancelled || !ethers.isAddress(info.safeAddress) || !Number.isInteger(info.chainId) || info.chainId <= 0) return;
            setSafeAppSdk(sdk);
            setSafeAccount({
                address: ethers.getAddress(info.safeAddress),
                chainId: String(info.chainId),
                owners: info.owners.filter((owner) => ethers.isAddress(owner)).map(ethers.getAddress),
                threshold: info.threshold,
                nonce: info.nonce,
                version: info.version ?? null,
                source: "safe-app",
            });
        }).catch(() => undefined).finally(() => {
            if (timeout !== undefined) window.clearTimeout(timeout);
        });
        return () => { cancelled = true; if (timeout !== undefined) window.clearTimeout(timeout); };
    }, []);

    useEffect(() => {
        if (!wallet?.provider) {
            setProvider(null);
            setSigner(null);
            setAccount(null);
            setChainId(null);
            setStatus("disconnected");
            setError(null);
            return;
        }

        let cancelled = false;
        const nextProvider = new ethers.BrowserProvider(wallet.provider);
        setProvider(nextProvider);
        setSigner(null);
        setAccount(null);
        setChainId(null);
        setStatus("loading");
        setError(null);

        Promise.all([nextProvider.getSigner(), nextProvider.getNetwork()])
            .then(([nextSigner, network]) => Promise.all([nextSigner, nextSigner.getAddress(), network] as const))
            .then(([nextSigner, nextAccount, network]) => {
                if (cancelled) {
                    return;
                }
                setSigner(nextSigner);
                setAccount(normalizedAddress(nextAccount));
                setChainId(network.chainId.toString());
                setStatus("ready");
            })
            .catch((sessionError) => {
                if (cancelled) {
                    return;
                }
                setSigner(null);
                setAccount(null);
                setChainId(null);
                setStatus("error");
                setError(normalizeError(sessionError, "Wallet connection failed"));
            });

        return () => {
            cancelled = true;
        };
    }, [wallet]);

    useEffect(() => {
        if (safeAccount?.source === "connected-account"
            && (!account || account.toLowerCase() !== safeAccount.address.toLowerCase())) {
            setSafeAccount(null);
        }
    }, [account, safeAccount]);

    useEffect(() => {
        if (!provider || !wallet?.provider || !account || !chainId || status !== "ready" || safeAccount) return;
        let cancelled = false;
        void provider.getCode(account).then(async (code) => {
            if (code === "0x" || cancelled) return;
            try {
                const protocolKit = await Safe.init({provider: wallet.provider as never, safeAddress: account});
                const [owners, threshold, version, nonce] = await Promise.all([
                    protocolKit.getOwners(),
                    protocolKit.getThreshold(),
                    protocolKit.getContractVersion(),
                    protocolKit.getNonce(),
                ]);
                if (cancelled || !owners.length || threshold < 1 || threshold > owners.length) return;
                setSafeAccount({
                    address: ethers.getAddress(account),
                    chainId,
                    owners: owners.map(ethers.getAddress),
                    threshold,
                    nonce,
                    version,
                    source: "connected-account",
                });
            } catch {
                // Contract wallets that do not implement the Safe interface remain ordinary wallets.
            }
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [account, chainId, provider, safeAccount, status, wallet?.provider]);

    const connectWallet = useCallback(async () => {
        try {
            setError(null);
            const wallets = await connect();
            const connectedWallet = wallets[0];
            if (!connectedWallet) {
                return null;
            }
            return await new ethers.BrowserProvider(connectedWallet.provider).getSigner();
        } catch (connectionError) {
            setError(normalizeError(connectionError, "Wallet connection failed"));
            throw connectionError;
        }
    }, [connect]);

    const disconnectWallet = useCallback(async () => {
        if (!wallet) return;
        try {
            setError(null);
            await disconnect({label: wallet.label});
        } catch (disconnectError) {
            // Web3-Onboard removes the wallet before parsing its optional
            // last-connected-wallet storage value. When that value is absent,
            // some browser builds throw a JSON parse error after disconnecting.
            if (disconnectError instanceof SyntaxError && /json\.parse|unexpected end/i.test(disconnectError.message)) {
                return;
            }
            setError(normalizeError(disconnectError, "Wallet disconnection failed"));
            throw disconnectError;
        }
    }, [disconnect, wallet]);

    const clearError = useCallback(() => setError(null), []);

    const clearSafe = useCallback(() => {
        safeSelectionRequest.current += 1;
        setSafeAccount((current) => {
            const connectedOwnerCanClear = current?.source === "connected-account"
                && account
                && account.toLowerCase() !== current.address.toLowerCase()
                && current.owners.some((owner) => owner.toLowerCase() === account.toLowerCase());
            if (current?.source === "manual" || connectedOwnerCanClear) {
                if (current.source === "manual") writeActiveSafe(null);
                return null;
            }
            return current;
        });
    }, [account]);

    const rememberSafe = useCallback((entry: SavedSafeAddress) => {
        setSavedSafes((current) => {
            const byKey = new Map(current.map((saved) => [safeAddressKey(saved), saved]));
            byKey.set(safeAddressKey(entry), entry);
            const next = [...byKey.values()];
            writeSavedSafes(next);
            return next;
        });
    }, []);

    const removeSavedSafe = useCallback((address: string, savedChainId: string) => {
        safeSelectionRequest.current += 1;
        const entry = {address: ethers.getAddress(address), chainId: BigInt(savedChainId).toString()};
        const key = safeAddressKey(entry);
        setSavedSafes((current) => {
            const next = current.filter((saved) => safeAddressKey(saved) !== key);
            writeSavedSafes(next);
            return next;
        });
        setSafeAccount((current) => {
            if (current?.source === "manual" && safeAddressKey(current) === key) {
                writeActiveSafe(null);
                return null;
            }
            return current;
        });
    }, []);

    const selectSafe = useCallback(async (address: string) => {
        if (typeof window !== "undefined" && window.parent !== window) {
            throw Object.assign(new Error("The active Safe is provided by the Safe app. Select another Safe from a connected owner wallet outside the Safe app."), {code: "SAFE_APP_ACTIVE"});
        }
        if (!provider || !account || !chainId || !signer) {
            throw Object.assign(new Error("Connect an owner wallet before selecting a Safe."), {code: "WALLET_DISCONNECTED"});
        }
        const request = ++safeSelectionRequest.current;
        const ownerAccount = account;
        const selectedChainId = chainId;
        if (!ethers.isAddress(address)) {
            throw Object.assign(new Error("Enter a valid Safe address."), {code: "INVALID_ARGUMENT"});
        }
        const safeAddress = ethers.getAddress(address);
        const code = await provider.getCode(safeAddress);
        if (code === "0x") {
            throw Object.assign(new Error("The selected address has no contract code on the connected network."), {code: "NOT_A_SAFE"});
        }
        const protocolKit = await Safe.init({provider: wallet!.provider as never, signer: account, safeAddress});
        const [owners, threshold] = await Promise.all([
            protocolKit.getOwners(),
            protocolKit.getThreshold(),
        ]);
        const [version, nonce] = await Promise.all([protocolKit.getContractVersion(), protocolKit.getNonce()]);
        if (request !== safeSelectionRequest.current
            || currentWalletIdentity.current.account?.toLowerCase() !== ownerAccount.toLowerCase()
            || currentWalletIdentity.current.chainId !== selectedChainId) {
            throw Object.assign(new Error("The connected account or network changed before Safe verification finished."), {code: "WALLET_SESSION_CHANGED"});
        }
        if (!owners.some((owner) => owner.toLowerCase() === account.toLowerCase())) {
            throw Object.assign(new Error("The connected wallet is not an owner of this Safe."), {code: "SAFE_OWNER_REQUIRED"});
        }
        const next = {address: safeAddress, chainId, owners: owners.map(ethers.getAddress), threshold, nonce, version, source: "manual" as const};
        setSafeAccount(next);
        const saved = {address: safeAddress, chainId};
        writeActiveSafe(saved);
        rememberSafe(saved);
        return next;
    }, [account, chainId, provider, rememberSafe, signer, wallet]);

    useEffect(() => {
        if (safeAccount?.source !== "manual" || safeAccount.threshold !== 0 || !account || !chainId || chainId !== safeAccount.chainId || status !== "ready") return;
        void selectSafe(safeAccount.address).catch(() => {
            // Keep the stored Safe choice when a different owner is connected;
            // it can be revalidated when an owner wallet is selected.
        });
    }, [account, chainId, safeAccount, selectSafe, status]);

    const switchChain = useCallback(async (nextChainId: string) => {
        if (!wallet?.provider) {
            throw Object.assign(new Error("Connect a wallet before switching networks."), {code: "WALLET_DISCONNECTED"});
        }
        if (!/^\d+$/.test(nextChainId)) {
            throw Object.assign(new Error("The requested chain ID is invalid."), {code: "INVALID_ARGUMENT"});
        }

        try {
            setError(null);
            await wallet.provider.request({
                method: "wallet_switchEthereumChain",
                params: [{chainId: ethers.toQuantity(BigInt(nextChainId))}],
            });
        } catch (switchError) {
            setError(normalizeError(switchError, "Network switch failed"));
            throw switchError;
        }
    }, [wallet]);

    const safeOwnerConnected = Boolean(safeAccount?.source === "safe-app"
        || (account && chainId === safeAccount?.chainId && safeAccount?.owners.some((owner) => owner.toLowerCase() === account.toLowerCase())));

    const value = useMemo<WalletSession>(() => ({
        status,
        provider,
        injectedProvider: wallet?.provider ?? null,
        signer,
        account,
        chainId,
        safeAccount,
        safeAppSdk: safeAccount?.source === "safe-app" ? safeAppSdk : null,
        executionAccount: safeAccount?.address ?? account,
        executionChainId: safeAccount?.chainId ?? chainId,
        isSafeMode: Boolean(safeAccount),
        safeOwnerConnected,
        selectSafe,
        clearSafe,
        savedSafes,
        removeSavedSafe,
        error,
        clearError,
        connectWallet,
        disconnectWallet,
        switchChain,
    }), [account, chainId, clearError, clearSafe, connectWallet, disconnectWallet, error, provider, removeSavedSafe, safeAccount, safeAppSdk, safeOwnerConnected, savedSafes, selectSafe, signer, status, switchChain, wallet?.provider]);

    return <WalletSessionContext.Provider value={value}>{children}</WalletSessionContext.Provider>;
}

export function useWalletSession() {
    const context = useContext(WalletSessionContext);
    if (!context) {
        throw new Error("useWalletSession must be used inside WalletSessionProvider");
    }
    return context;
}
