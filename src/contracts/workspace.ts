import { ethers } from "ethers";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { chainsById } from "../chainConfig";
import { ProviderDetails } from "../presets";
import { useTransactionPlan } from "../transaction-plan/context";
import { reconcileWalletWorkspace, WalletIdentity } from "../wallet/workspaceLifecycle";
import { useWalletSession } from "../wallet/WalletSessionContext";
import {
    readSavedContracts,
    removeSavedContractEntry,
    SavedContract,
    upsertSavedContract,
    writeSavedContracts,
} from "./savedContracts";

interface ContractInstanceBase {
    /** Session-local identity; instances are never persisted. */
    id: string;
    /** Presentation metadata for navigation. */
    label: string;
    /** Serializable contract identity. */
    address: string;
    /**
     * Live binding created when the instance was added: it carries the ABI
     * interface and either a provider (read-only) or the wallet signer.
     * Layout and navigation components read only the fields above.
     */
    contract: ethers.BaseContract;
}

export type ContractInstance = ContractInstanceBase & (
    | {isStatic: true; providerDetails?: ProviderDetails}
    | {isStatic: false; walletChainId: string}
);

function contractChainId(contract: ContractInstance) {
    return contract.isStatic ? contract.providerDetails?.chainId ?? null : contract.walletChainId;
}

function readOnlyProviderDetails(entry: SavedContract): ProviderDetails | null {
    if (entry.provider) return entry.provider;
    const chain = chainsById.get(entry.chainId);
    return chain ? {label: chain.label, url: chain.rpcUrl, chainId: chain.id} : null;
}

function defaultContractLabel(address: string) {
    return `Contract ${address.slice(0, 8)}…${address.slice(-6)}`;
}

/**
 * Contract workspace state: instances, selection, and wallet-identity
 * reconciliation. The App layer owns layout and dialogs and consumes this
 * hook, so navigation never depends on live ethers bindings.
 */
export function useContractWorkspace() {
    const [contracts, setContracts] = useState<ContractInstance[]>([]);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [interactionAccount, setInteractionAccount] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [savedContracts, setSavedContracts] = useState<SavedContract[]>(() => readSavedContracts());
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const contractsRef = useRef(contracts);
    const planStateRef = useRef(transactionPlan.state);
    const savedContractsRef = useRef(savedContracts);
    const previousIdentity = useRef<WalletIdentity | null>(null);
    contractsRef.current = contracts;
    planStateRef.current = transactionPlan.state;
    savedContractsRef.current = savedContracts;

    useLayoutEffect(() => {
        const account = wallet.executionAccount ?? wallet.account;
        const chainId = wallet.executionChainId ?? wallet.chainId;
        const identityReady = Boolean(wallet.safeAppSdk || (wallet.status === "ready" && (!wallet.isSafeMode || wallet.safeOwnerConnected)));
        if (!identityReady || !account || !chainId) {
            return;
        }

        const nextIdentity = {account, chainId};
        const transition = reconcileWalletWorkspace(contractsRef.current, planStateRef.current, previousIdentity.current, nextIdentity);

        if (transition.removedCount > 0) {
            setContracts(transition.remainingContracts);
        }
        if (!interactionAccount || transition.accountChanged) {
            setInteractionAccount(nextIdentity.account);
        }
        if (transition.notice) {
            setNotice(transition.notice);
        }

        previousIdentity.current = nextIdentity;
    }, [interactionAccount, wallet.executionAccount, wallet.executionChainId, wallet.isSafeMode, wallet.safeAppSdk, wallet.safeOwnerConnected, wallet.status, wallet.account, wallet.chainId]);

    useEffect(() => {
        if (contracts.length === 0) {
            setSelectedContractId(null);
        } else if (!selectedContractId || !contracts.some((contract) => contract.id === selectedContractId)) {
            setSelectedContractId(contracts[0].id);
        }
    }, [contracts, selectedContractId]);

    const addContract = useCallback((contract: ContractInstance) => {
        setContracts((current) => current.concat([contract]));
        setSelectedContractId(contract.id);
    }, []);

    const removeContract = useCallback((id: string) => {
        const instance = contractsRef.current.find((contract) => contract.id === id);
        const provider = instance?.contract.runner?.provider;
        if (provider instanceof ethers.JsonRpcProvider) {
            provider.destroy();
        }
        setContracts((current) => current.filter((contract) => contract.id !== id));
    }, []);

    const renameContract = useCallback((id: string, label: string) => {
        setContracts((current) => current.map((contract) => contract.id === id ? {...contract, label} : contract));
    }, []);

    const saveContract = useCallback((contract: ContractInstance) => {
        const chainId = contractChainId(contract);
        if (!chainId) {
            setNotice("This contract's network is unknown, so it cannot be saved.");
            return false;
        }
        let abi: string;
        try {
            abi = contract.contract.interface.formatJson();
        } catch {
            setNotice("This contract interface cannot be saved.");
            return false;
        }
        const entry: SavedContract = {
            version: 1,
            id: crypto.randomUUID(),
            label: contract.label.trim() || defaultContractLabel(contract.address),
            address: ethers.getAddress(contract.address),
            chainId,
            abi,
            access: contract.isStatic ? "read-only" : "wallet",
            ...(contract.isStatic && contract.providerDetails ? {provider: contract.providerDetails} : {}),
            savedAt: Date.now(),
        };
        const next = upsertSavedContract(savedContractsRef.current, entry);
        if (!writeSavedContracts(next)) {
            setNotice("Could not save this contract because browser storage is unavailable.");
            return false;
        }
        setSavedContracts(next);
        setNotice(`Saved ${entry.label} to this browser.`);
        return true;
    }, []);

    const removeSavedContract = useCallback((entry: SavedContract) => {
        const next = removeSavedContractEntry(savedContractsRef.current, entry);
        if (!writeSavedContracts(next)) {
            setNotice("Could not remove the saved contract because browser storage is unavailable.");
            return false;
        }
        setSavedContracts(next);
        setNotice(`Removed ${entry.label} from saved contracts.`);
        return true;
    }, []);

    const openSavedContract = useCallback((entry: SavedContract) => {
        const existing = contractsRef.current.find((contract) => (
            contractChainId(contract) === entry.chainId
            && ethers.getAddress(contract.address) === entry.address
        ));
        if (existing) {
            setSelectedContractId(existing.id);
            setNotice(`Selected ${existing.label}; it is already open.`);
            return true;
        }

        let contractInterface: ethers.Interface;
        try {
            contractInterface = new ethers.Interface(JSON.parse(entry.abi));
        } catch {
            setNotice("This saved contract has an invalid interface.");
            return false;
        }

        const walletAccount = wallet.executionAccount ?? wallet.account;
        const walletChainId = wallet.executionChainId ?? wallet.chainId;
        const chainRpc = chainsById.get(entry.chainId);
        const signerReady = Boolean(wallet.signer && wallet.chainId === entry.chainId && (!wallet.isSafeMode || wallet.safeOwnerConnected));
        const safeAppReady = Boolean(wallet.safeAppSdk && chainRpc && walletChainId === entry.chainId);
        const canUseWallet = entry.access === "wallet"
            && Boolean(walletAccount)
            && walletChainId === entry.chainId
            && (wallet.status === "ready" || Boolean(wallet.safeAppSdk))
            && (signerReady || safeAppReady);

        if (canUseWallet) {
            const runner = signerReady && wallet.signer
                ? wallet.signer
                : safeAppReady && chainRpc
                    ? new ethers.JsonRpcProvider(chainRpc.rpcUrl)
                    : null;
            if (runner) {
                addContract({
                    id: crypto.randomUUID(),
                    label: entry.label,
                    address: entry.address,
                    contract: new ethers.BaseContract(entry.address, contractInterface, runner),
                    isStatic: false,
                    walletChainId: entry.chainId,
                });
                return true;
            }
        }

        const providerDetails = readOnlyProviderDetails(entry);
        if (!providerDetails) {
            setNotice(`No RPC is available to open ${entry.label} on chain ${entry.chainId}.`);
            return false;
        }
        addContract({
            id: crypto.randomUUID(),
            label: entry.label,
            address: entry.address,
            contract: new ethers.BaseContract(entry.address, contractInterface, new ethers.JsonRpcProvider(providerDetails.url)),
            isStatic: true,
            providerDetails,
        });
        if (entry.access === "wallet") {
            setNotice(`Opened ${entry.label} read-only because the wallet is not available on chain ${entry.chainId}.`);
        }
        return true;
    }, [addContract, wallet.account, wallet.chainId, wallet.executionAccount, wallet.executionChainId, wallet.isSafeMode, wallet.safeAppSdk, wallet.safeOwnerConnected, wallet.signer, wallet.status]);

    const selectContract = useCallback((id: string) => setSelectedContractId(id), []);
    const dismissNotice = useCallback(() => setNotice(null), []);

    const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0];

    return {
        contracts,
        addContract,
        removeContract,
        renameContract,
        saveContract,
        openSavedContract,
        removeSavedContract,
        savedContracts,
        selectedContract,
        selectedContractId: selectedContract?.id ?? null,
        selectContract,
        interactionAccount,
        notice,
        dismissNotice,
    };
}
