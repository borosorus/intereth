import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NormalizedError, normalizeError } from "../callUtils";

export type WalletSessionStatus = "disconnected" | "loading" | "ready" | "error";

export interface WalletSession {
    status: WalletSessionStatus;
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    account: string | null;
    chainId: string | null;
    error: NormalizedError | null;
    clearError: () => void;
    connectWallet: () => Promise<ethers.JsonRpcSigner | null>;
    switchChain: (chainId: string) => Promise<void>;
}

const WalletSessionContext = createContext<WalletSession | null>(null);

function normalizedAddress(address: string) {
    return ethers.getAddress(address);
}

export function WalletSessionProvider({children}: {children: ReactNode}) {
    const [{wallet}, connect] = useConnectWallet();
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<string | null>(null);
    const [status, setStatus] = useState<WalletSessionStatus>("disconnected");
    const [error, setError] = useState<NormalizedError | null>(null);

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

    const clearError = useCallback(() => setError(null), []);

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

    const value = useMemo<WalletSession>(() => ({
        status,
        provider,
        signer,
        account,
        chainId,
        error,
        clearError,
        connectWallet,
        switchChain,
    }), [account, chainId, clearError, connectWallet, error, provider, signer, status, switchChain]);

    return <WalletSessionContext.Provider value={value}>{children}</WalletSessionContext.Provider>;
}

export function useWalletSession() {
    const context = useContext(WalletSessionContext);
    if (!context) {
        throw new Error("useWalletSession must be used inside WalletSessionProvider");
    }
    return context;
}
