import { ethers } from "ethers";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ProviderDetails } from "../presets";
import { useTransactionPlan } from "../transaction-plan/context";
import { reconcileWalletWorkspace, WalletIdentity } from "../wallet/workspaceLifecycle";
import { useWalletSession } from "../wallet/WalletSessionContext";

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
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const contractsRef = useRef(contracts);
    const planStateRef = useRef(transactionPlan.state);
    const previousIdentity = useRef<WalletIdentity | null>(null);
    contractsRef.current = contracts;
    planStateRef.current = transactionPlan.state;

    useLayoutEffect(() => {
        if (!wallet.account || !wallet.chainId) {
            return;
        }

        const nextIdentity = {account: wallet.account, chainId: wallet.chainId};
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
    }, [interactionAccount, wallet.account, wallet.chainId]);

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
        if (instance?.isStatic) {
            const provider = instance.contract.runner?.provider;
            if (provider instanceof ethers.JsonRpcProvider) {
                provider.destroy();
            }
        }
        setContracts((current) => current.filter((contract) => contract.id !== id));
    }, []);

    const renameContract = useCallback((id: string, label: string) => {
        setContracts((current) => current.map((contract) => contract.id === id ? {...contract, label} : contract));
    }, []);

    const selectContract = useCallback((id: string) => setSelectedContractId(id), []);
    const dismissNotice = useCallback(() => setNotice(null), []);

    const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0];

    return {
        contracts,
        addContract,
        removeContract,
        renameContract,
        selectedContract,
        selectedContractId: selectedContract?.id ?? null,
        selectContract,
        interactionAccount,
        notice,
        dismissNotice,
    };
}
