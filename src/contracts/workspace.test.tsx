import { act, renderHook, waitFor } from "@testing-library/react";
import { ethers } from "ethers";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { ContractInstance, useContractWorkspace } from "./workspace";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));

const mockedPlan = vi.mocked(useTransactionPlan);
const mockedWallet = vi.mocked(useWalletSession);
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const CONTRACT_INTERFACE = new ethers.Interface(["function balanceOf(address account) view returns (uint256)"]);

function walletInstance(overrides: Partial<ContractInstance> = {}): ContractInstance {
    return {
        id: overrides.id ?? "wallet-1",
        label: overrides.label ?? "Wallet contract",
        address: TARGET,
        contract: {runner: {}} as unknown as ethers.BaseContract,
        isStatic: false,
        walletChainId: "1",
        ...overrides,
    } as ContractInstance;
}

function contractWithInterface() {
    return new ethers.BaseContract(TARGET, CONTRACT_INTERFACE, new ethers.JsonRpcProvider("http://localhost:1/rpc"));
}

function readOnlyInstance(label = "Saved token"): ContractInstance {
    return {
        id: "static-save",
        label,
        address: TARGET,
        contract: contractWithInterface(),
        isStatic: true,
        providerDetails: {label: "Test RPC", url: "http://localhost:1/rpc", chainId: "1"},
    };
}

function readOnlyInstanceWithoutNetwork(): ContractInstance {
    return {
        id: "static-unknown",
        label: "Unknown network",
        address: TARGET,
        contract: contractWithInterface(),
        isStatic: true,
    };
}

describe("useContractWorkspace", () => {
    beforeEach(() => {
        window.localStorage.clear();
        mockedWallet.mockReturnValue({
            status: "ready", account: ACCOUNT, chainId: "1",
            provider: null, signer: null, error: null,
            clearError: vi.fn(), connectWallet: vi.fn(), switchChain: vi.fn(),
        });
        mockedPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(), dispatch: vi.fn(), sessionStatus: "empty", canEdit: true,
        });
    });

    it("selects added contracts and follows explicit selection", async () => {
        const {result} = renderHook(() => useContractWorkspace());

        act(() => result.current.addContract(walletInstance({id: "a", label: "A"})));
        act(() => result.current.addContract(walletInstance({id: "b", label: "B"})));

        // Newly added instances become selected.
        expect(result.current.selectedContractId).toBe("b");

        act(() => result.current.selectContract("a"));
        expect(result.current.selectedContractId).toBe("a");

        act(() => result.current.removeContract("a"));
        await waitFor(() => expect(result.current.selectedContractId).toBe("b"));
    });

    it("renames an instance without touching its live binding", () => {
        const contract = walletInstance({id: "a"});
        const {result} = renderHook(() => useContractWorkspace());
        act(() => result.current.addContract(contract));
        act(() => result.current.renameContract("a", "Renamed"));

        expect(result.current.contracts[0].label).toBe("Renamed");
        expect(result.current.contracts[0].contract).toBe(contract.contract);
    });

    it("saves only the address, chain ID, and interface to the local address book", () => {
        const {result} = renderHook(() => useContractWorkspace());
        const contract = readOnlyInstance();

        act(() => expect(result.current.saveContract(contract)).toBe(true));
        expect(result.current.savedContracts).toHaveLength(1);
        const [saved] = result.current.savedContracts;
        expect(saved).toEqual({
            version: 3,
            label: "Saved token",
            address: TARGET,
            chainId: "1",
            abi: CONTRACT_INTERFACE.formatJson(),
            savedAt: expect.any(Number),
        });
        expect(saved).not.toHaveProperty("access");
        expect(saved).not.toHaveProperty("provider");
    });

    it("removes a saved contract by chain and address", () => {
        const {result} = renderHook(() => useContractWorkspace());
        act(() => result.current.saveContract(readOnlyInstance()));

        act(() => expect(result.current.removeSavedContract(result.current.savedContracts[0])).toBe(true));

        expect(result.current.savedContracts).toEqual([]);
        expect(result.current.notice).toContain("Removed 0x000000…000010 on chain 1 from saved contracts.");
    });

    it("refuses to save a contract whose network is unknown", () => {
        const {result} = renderHook(() => useContractWorkspace());

        act(() => expect(result.current.saveContract(readOnlyInstanceWithoutNetwork())).toBe(false));

        expect(result.current.savedContracts).toEqual([]);
        expect(result.current.notice).toContain("network is unknown");
    });

    it("destroys the owned RPC provider when a read-only instance is removed", async () => {
        const provider = new ethers.JsonRpcProvider("http://localhost:1/rpc");
        const destroy = vi.spyOn(provider, "destroy");
        const instance: ContractInstance = {
            id: "static-1",
            label: "Read-only",
            address: TARGET,
            contract: new ethers.BaseContract(TARGET, new ethers.Interface([]), provider),
            isStatic: true,
            providerDetails: {label: "Test", url: "http://localhost:1/rpc", chainId: "1"},
        };
        const {result} = renderHook(() => useContractWorkspace());

        act(() => result.current.addContract(instance));
        act(() => result.current.removeContract("static-1"));

        expect(destroy).toHaveBeenCalled();
        expect(result.current.contracts).toHaveLength(0);
    });

    it("drops wallet instances and reports a notice when the network changes", async () => {
        const {result, rerender} = renderHook(() => useContractWorkspace());
        act(() => result.current.addContract(walletInstance({id: "wallet"})));
        act(() => result.current.addContract({
            id: "static", label: "Read-only", address: TARGET,
            contract: {runner: {}} as unknown as ethers.BaseContract,
            isStatic: true, providerDetails: {label: "Test", url: "http://x", chainId: "10"},
        }));

        mockedWallet.mockReturnValue({
            status: "ready", account: ACCOUNT, chainId: "10",
            provider: null, signer: null, error: null,
            clearError: vi.fn(), connectWallet: vi.fn(), switchChain: vi.fn(),
        });
        rerender();

        await waitFor(() => expect(result.current.contracts.map((contract) => contract.id)).toEqual(["static"]));
        expect(result.current.notice).toContain("Active network changed");
        expect(result.current.notice).toContain("1 wallet contract instance was cleared");

        act(() => result.current.dismissNotice());
        expect(result.current.notice).toBeNull();
    });

    it("exposes the interaction account for form-reset keys", async () => {
        const {result} = renderHook(() => useContractWorkspace());
        await waitFor(() => expect(result.current.interactionAccount).toBe(ACCOUNT));
    });
});
