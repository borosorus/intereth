import { selectShouldClearForSession } from "../transaction-plan/selectors";
import { TransactionPlanState } from "../transaction-plan/types";

export interface WalletIdentity {
    account: string;
    chainId: string;
}

interface ContractConnection {
    isStatic: boolean;
    walletChainId?: string;
}

export function reconcileWalletWorkspace<T extends ContractConnection>(
    contracts: T[],
    plan: TransactionPlanState,
    previous: WalletIdentity | null,
    next: WalletIdentity,
) {
    const accountChanged = Boolean(previous && previous.account.toLowerCase() !== next.account.toLowerCase());
    const chainChanged = Boolean(previous && previous.chainId !== next.chainId);
    const removedWalletContracts = contracts.filter((item) => !item.isStatic && item.walletChainId !== next.chainId);
    const remainingContracts = removedWalletContracts.length > 0
        ? contracts.filter((item) => item.isStatic || item.walletChainId === next.chainId)
        : contracts;
    const planWillClear = selectShouldClearForSession(plan, next);

    let notice: string | null = null;
    if (chainChanged || removedWalletContracts.length > 0) {
        const removed = removedWalletContracts.length === 1
            ? "1 wallet contract instance was cleared."
            : `${removedWalletContracts.length} wallet contract instances were cleared.`;
        notice = [
            "Active network changed.",
            planWillClear ? "The execution plan was cleared." : "",
            removedWalletContracts.length > 0 ? removed : "",
            "Read-only RPC contracts were kept.",
        ].filter(Boolean).join(" ");
    } else if (accountChanged) {
        notice = planWillClear
            ? "Active account changed. The execution plan was cleared and connected-account contract inputs were reset."
            : "Active account changed. Connected-account contract inputs were reset.";
    } else if (!previous && planWillClear) {
        notice = "The saved execution plan was cleared because it belongs to another wallet account or network.";
    }

    return {
        accountChanged,
        remainingContracts,
        removedCount: removedWalletContracts.length,
        notice,
    };
}
