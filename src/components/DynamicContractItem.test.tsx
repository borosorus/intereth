import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import DynamicContractItem, { DynamicFunctionItem } from "./DynamicContractItem";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { useSimulation } from "../simulation/context";
import { useWorkspaceMode } from "../workspace/context";

vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));
vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../simulation/context", () => ({useSimulation: vi.fn()}));
vi.mock("../workspace/context", () => ({useWorkspaceMode: vi.fn()}));

const mockedWalletSession = vi.mocked(useWalletSession);
const mockedTransactionPlan = vi.mocked(useTransactionPlan);
const mockedSimulation = vi.mocked(useSimulation);
const mockedWorkspace = vi.mocked(useWorkspaceMode);

beforeEach(() => mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()}));

function mockSimulation(overrides: Partial<ReturnType<typeof useSimulation>> = {}) {
    mockedSimulation.mockReturnValue({
        active: false,
        watchActive: false,
        status: "idle",
        chainId: null,
        error: null,
        snapshot: null,
        revision: "disabled",
        queuedCallCount: 0,
        configured: false,
        watchEvaluations: {},
        tokenMetadataByAddress: {},
        tokenMetadataResolving: false,
        retry: vi.fn(),
        canSimulateChain: vi.fn().mockReturnValue(false),
        simulateRead: vi.fn(),
        ...overrides,
    });
}

describe("DynamicFunctionItem queueing", () => {
    beforeEach(mockSimulation);
    it("queues encoded ABI calls without invoking the transaction runner", async () => {
        const sendTransaction = vi.fn();
        const dispatch = vi.fn();
        mockedWalletSession.mockReturnValue({
            status: "ready",
            provider: null,
            signer: null,
            account: "0x0000000000000000000000000000000000000001",
            chainId: "1",
            error: null,
            clearError: vi.fn(),
            connectWallet: vi.fn(),
            switchChain: vi.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch,
            sessionStatus: "empty",
            canEdit: true,
        });
        const fragment = new ethers.Interface(["function pause()"]).getFunction("pause")!;
        const contract = {
            interface: new ethers.Interface([fragment]),
            runner: {sendTransaction},
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<DynamicFunctionItem contract={contract} frag={fragment} />);
        fireEvent.click(screen.getByRole("button", {name: /pause\(\) Write/}));
        expect(screen.queryByRole("button", {name: "Send now"})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Add to queue"}));

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "ADD_CALL"})));
        expect(sendTransaction).not.toHaveBeenCalled();
        expect(screen.getByText("Added to transaction queue.")).toBeInTheDocument();
    });

    it("decodes a simulated read without requiring a wallet runner", async () => {
        const simulateRead = vi.fn().mockResolvedValue({
            returnData: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(42)]),
            gasUsed: "0x100",
        });
        mockSimulation({
            active: true,
            status: "ready",
            chainId: "1",
            revision: "ready:1",
            queuedCallCount: 2,
            canSimulateChain: vi.fn().mockReturnValue(true),
            simulateRead,
        });
        mockedWalletSession.mockReturnValue({
            status: "disconnected",
            provider: null,
            signer: null,
            account: null,
            chainId: null,
            error: null,
            clearError: vi.fn(),
            connectWallet: vi.fn(),
            switchChain: vi.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: vi.fn(),
            sessionStatus: "disconnected",
            canEdit: false,
        });
        const fragment = new ethers.Interface(["function count() view returns (uint256)"]).getFunction("count")!;
        const contract = {
            runner: null,
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<DynamicFunctionItem contract={contract} frag={fragment} chainId="1" disabled />);
        fireEvent.click(screen.getByRole("button", {name: /count\(\) View/}));
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Run speculative"}));

        await waitFor(() => expect(simulateRead).toHaveBeenCalledWith("1", {
            to: "0x0000000000000000000000000000000000000010",
            data: fragment.selector,
        }));
        expect(await screen.findByText("42")).toBeInTheDocument();
        expect(screen.getByText("Speculative")).toBeInTheDocument();
        expect(screen.getByText(/after 2 queued calls/)).toBeInTheDocument();
    });
});

describe("DynamicContractItem wallet lifecycle", () => {
    beforeEach(mockSimulation);
    it("rebinds raw calls to the active signer and preserves the form while disconnected", async () => {
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: vi.fn()});
        const oldSendTransaction = vi.fn();
        const sendTransaction = vi.fn().mockResolvedValue({
            hash: `0x${"11".repeat(32)}`,
            wait: vi.fn().mockResolvedValue({
                status: 1,
                hash: `0x${"11".repeat(32)}`,
                blockNumber: 10,
                gasUsed: BigInt(21_000),
            }),
        });
        const currentRunner = {call: vi.fn(), sendTransaction};
        const oldRunner = {call: vi.fn(), sendTransaction: oldSendTransaction};
        const iface = new ethers.Interface([]);
        const getAddress = vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010");
        const connectedContract = {interface: iface, runner: currentRunner, getAddress};
        const disconnectedContract = {interface: iface, runner: null, getAddress};
        const connect = vi.fn((runner) => runner ? connectedContract : disconnectedContract);
        const contract = {interface: iface, runner: oldRunner, getAddress, connect} as unknown as ethers.BaseContract;
        const walletSession = {
            status: "ready" as const,
            provider: null,
            signer: currentRunner as unknown as ethers.JsonRpcSigner,
            account: "0x0000000000000000000000000000000000000001",
            chainId: "1",
            error: null,
            clearError: vi.fn(),
            connectWallet: vi.fn(),
            switchChain: vi.fn(),
        };
        mockedWalletSession.mockReturnValue(walletSession);
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: vi.fn(),
            sessionStatus: "empty",
            canEdit: true,
        });

        const {rerender} = render(<DynamicContractItem contract={contract} walletChainId="1" />);
        fireEvent.click(screen.getByText("RPC: Browser Wallet"));
        await screen.findByText("0x0000000000000000000000000000000000000010");
        const calldata = screen.getByLabelText("Hex calldata");
        fireEvent.change(calldata, {target: {value: "0x1234"}});
        fireEvent.click(screen.getByRole("button", {name: "Send now"}));

        await waitFor(() => expect(sendTransaction).toHaveBeenCalledTimes(1));
        expect(oldSendTransaction).not.toHaveBeenCalled();
        expect(connect).toHaveBeenCalledWith(currentRunner);

        mockedWalletSession.mockReturnValue({...walletSession, status: "disconnected", signer: null, account: null, chainId: null});
        rerender(<DynamicContractItem contract={contract} walletChainId="1" />);

        expect(screen.getByLabelText("Hex calldata")).toHaveValue("0x1234");
        expect(screen.getByRole("button", {name: "Add to queue"})).toBeDisabled();
        expect(screen.getByRole("button", {name: "Send now"})).toBeDisabled();
    });

    it("explains when queued-state simulation belongs to another chain", async () => {
        mockSimulation({
            active: true,
            status: "ready",
            chainId: "10",
            revision: "ready:10",
            queuedCallCount: 1,
        });
        const signer = {call: vi.fn(), sendTransaction: vi.fn()};
        mockedWalletSession.mockReturnValue({
            status: "ready",
            provider: null,
            signer: signer as unknown as ethers.JsonRpcSigner,
            account: "0x0000000000000000000000000000000000000001",
            chainId: "1",
            error: null,
            clearError: vi.fn(),
            connectWallet: vi.fn(),
            switchChain: vi.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: vi.fn(),
            sessionStatus: "empty",
            canEdit: true,
        });
        const activeContract = {
            interface: new ethers.Interface([]),
            runner: signer,
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        };
        const contract = {
            ...activeContract,
            connect: vi.fn().mockReturnValue(activeContract),
        } as unknown as ethers.BaseContract;

        render(<DynamicContractItem contract={contract} walletChainId="1" />);
        fireEvent.click(screen.getByText("RPC: Browser Wallet"));
        await screen.findByText("0x0000000000000000000000000000000000000010");
        expect(screen.getByText(/simulation belongs to chain 10; this contract is on chain 1/)).toBeInTheDocument();
    });

    it("groups read and write functions while preserving mutability labels", async () => {
        const signer = {call: vi.fn(), sendTransaction: vi.fn()};
        mockedWalletSession.mockReturnValue({
            status: "ready", provider: null, signer: signer as unknown as ethers.JsonRpcSigner,
            account: "0x0000000000000000000000000000000000000001", chainId: "1",
            error: null, clearError: vi.fn(), connectWallet: vi.fn(), switchChain: vi.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(), dispatch: vi.fn(), sessionStatus: "empty", canEdit: true,
        });
        const iface = new ethers.Interface([
            "function balance() view returns (uint256)",
            "function version() pure returns (uint256)",
            "function update()",
            "function deposit() payable",
        ]);
        const activeContract = {
            interface: iface, runner: signer,
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        };
        const contract = {...activeContract, connect: vi.fn().mockReturnValue(activeContract)} as unknown as ethers.BaseContract;

        render(<DynamicContractItem contract={contract} walletChainId="1" />);
        fireEvent.click(screen.getByText("RPC: Browser Wallet"));
        await screen.findByText("0x0000000000000000000000000000000000000010");

        expect(screen.getByText("Read functions")).toBeInTheDocument();
        expect(screen.getByText(/Read canonical state or speculative queued state/)).toBeInTheDocument();
        expect(screen.getByText("Write functions")).toBeInTheDocument();
        expect(screen.getByText("View")).toBeInTheDocument();
        expect(screen.getByText("Pure")).toBeInTheDocument();
        expect(screen.getByText("Write")).toBeInTheDocument();
        expect(screen.getByText("Payable")).toBeInTheDocument();

        const functionSummaries = screen.getAllByRole("button", {name: /(balance|version|update|deposit)\(\) (View|Pure|Write|Payable)/});
        const summaryIds = functionSummaries.map((summary) => summary.id);
        const contentIds = functionSummaries.map((summary) => summary.getAttribute("aria-controls"));
        expect(new Set(summaryIds).size).toBe(functionSummaries.length);
        expect(new Set(contentIds).size).toBe(functionSummaries.length);
        contentIds.forEach((contentId) => expect(contentId && document.getElementById(contentId)).toBeInTheDocument());
    });
});
