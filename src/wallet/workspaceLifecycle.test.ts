import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { QueuedCall } from "../transaction-plan/types";
import { reconcileWalletWorkspace, WalletIdentity } from "./workspaceLifecycle";

const ACCOUNT_A = "0x0000000000000000000000000000000000000001";
const ACCOUNT_B = "0x0000000000000000000000000000000000000002";
const CHAIN_ONE: WalletIdentity = {account: ACCOUNT_A, chainId: "1"};
const walletContract = {id: "wallet", isStatic: false, walletChainId: "1"};
const rpcContract = {id: "rpc", isStatic: true};
const call: QueuedCall = {
    id: "call",
    chainId: "1",
    from: ACCOUNT_A,
    to: "0x0000000000000000000000000000000000000010",
    data: "0x",
    value: "0",
    decoderAbi: [],
    display: {kind: "raw", contractAddress: "0x0000000000000000000000000000000000000010"},
    editor: {kind: "raw"},
    createdAt: 1,
};
const draft = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call});

describe("wallet workspace lifecycle", () => {
    it("keeps contracts but resets wallet interactions on an account change", () => {
        const result = reconcileWalletWorkspace(
            [walletContract, rpcContract],
            draft,
            CHAIN_ONE,
            {account: ACCOUNT_B, chainId: "1"},
        );

        expect(result.accountChanged).toBe(true);
        expect(result.remainingContracts).toEqual([walletContract, rpcContract]);
        expect(result.notice).toContain("transaction plan was cleared");
        expect(result.notice).toContain("inputs were reset");
    });

    it("removes only wallet contracts on a chain change", () => {
        const result = reconcileWalletWorkspace(
            [walletContract, rpcContract],
            draft,
            CHAIN_ONE,
            {account: ACCOUNT_A, chainId: "10"},
        );

        expect(result.remainingContracts).toEqual([rpcContract]);
        expect(result.removedCount).toBe(1);
        expect(result.notice).toContain("Read-only RPC contracts were kept");
    });

    it("does nothing for the same wallet identity", () => {
        const result = reconcileWalletWorkspace([walletContract, rpcContract], draft, CHAIN_ONE, CHAIN_ONE);
        expect(result.remainingContracts).toEqual([walletContract, rpcContract]);
        expect(result.accountChanged).toBe(false);
        expect(result.notice).toBeNull();
    });
});
