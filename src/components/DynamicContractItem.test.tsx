import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import DynamicContractItem, { DynamicFunctionItem } from "./DynamicContractItem";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { useSimulation } from "../simulation/context";
import { useWorkspaceMode } from "../workspace/context";

jest.mock("../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));
jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../simulation/context", () => ({useSimulation: jest.fn()}));
jest.mock("../workspace/context", () => ({useWorkspaceMode: jest.fn()}));

const mockedWalletSession = useWalletSession as jest.MockedFunction<typeof useWalletSession>;
const mockedTransactionPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;
const mockedWorkspace = useWorkspaceMode as jest.MockedFunction<typeof useWorkspaceMode>;

beforeEach(() => mockedWorkspace.mockReturnValue({mode: "simulate", setMode: jest.fn()}));

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
        retry: jest.fn(),
        canSimulateChain: jest.fn().mockReturnValue(false),
        simulateRead: jest.fn(),
        ...overrides,
    });
}

describe("DynamicFunctionItem queueing", () => {
    beforeEach(mockSimulation);
    it("queues encoded ABI calls without invoking the transaction runner", async () => {
        const sendTransaction = jest.fn();
        const dispatch = jest.fn();
        mockedWalletSession.mockReturnValue({
            status: "ready",
            provider: null,
            signer: null,
            account: "0x0000000000000000000000000000000000000001",
            chainId: "1",
            error: null,
            clearError: jest.fn(),
            connectWallet: jest.fn(),
            switchChain: jest.fn(),
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
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<DynamicFunctionItem contract={contract} frag={fragment} />);
        fireEvent.click(screen.getByRole("button", {name: /pause function pause/}));
        expect(screen.queryByRole("button", {name: "Send immediately"})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Add to queue"}));

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "ADD_CALL"})));
        expect(sendTransaction).not.toHaveBeenCalled();
        expect(screen.getByText("Added to transaction queue.")).toBeInTheDocument();
    });

    it("decodes a simulated read without requiring a wallet runner", async () => {
        const simulateRead = jest.fn().mockResolvedValue({
            returnData: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(42)]),
            gasUsed: "0x100",
        });
        mockSimulation({
            active: true,
            status: "ready",
            chainId: "1",
            revision: "ready:1",
            queuedCallCount: 2,
            canSimulateChain: jest.fn().mockReturnValue(true),
            simulateRead,
        });
        mockedWalletSession.mockReturnValue({
            status: "disconnected",
            provider: null,
            signer: null,
            account: null,
            chainId: null,
            error: null,
            clearError: jest.fn(),
            connectWallet: jest.fn(),
            switchChain: jest.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: jest.fn(),
            sessionStatus: "disconnected",
            canEdit: false,
        });
        const fragment = new ethers.Interface(["function count() view returns (uint256)"]).getFunction("count")!;
        const contract = {
            runner: null,
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<DynamicFunctionItem contract={contract} frag={fragment} chainId="1" disabled />);
        fireEvent.click(screen.getByRole("button", {name: /count function count/}));
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Run simulated"}));

        await waitFor(() => expect(simulateRead).toHaveBeenCalledWith("1", {
            to: "0x0000000000000000000000000000000000000010",
            data: fragment.selector,
        }));
        expect(await screen.findByText("42")).toBeInTheDocument();
        expect(screen.getByText("Simulated")).toBeInTheDocument();
        expect(screen.getByText(/after 2 queued calls/)).toBeInTheDocument();
    });
});

describe("DynamicContractItem wallet lifecycle", () => {
    beforeEach(mockSimulation);
    it("rebinds raw calls to the active signer and preserves the form while disconnected", async () => {
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: jest.fn()});
        const oldSendTransaction = jest.fn();
        const sendTransaction = jest.fn().mockResolvedValue({
            hash: `0x${"11".repeat(32)}`,
            wait: jest.fn().mockResolvedValue({
                status: 1,
                hash: `0x${"11".repeat(32)}`,
                blockNumber: 10,
                gasUsed: BigInt(21_000),
            }),
        });
        const currentRunner = {call: jest.fn(), sendTransaction};
        const oldRunner = {call: jest.fn(), sendTransaction: oldSendTransaction};
        const iface = new ethers.Interface([]);
        const getAddress = jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010");
        const connectedContract = {interface: iface, runner: currentRunner, getAddress};
        const disconnectedContract = {interface: iface, runner: null, getAddress};
        const connect = jest.fn((runner) => runner ? connectedContract : disconnectedContract);
        const contract = {interface: iface, runner: oldRunner, getAddress, connect} as unknown as ethers.BaseContract;
        const walletSession = {
            status: "ready" as const,
            provider: null,
            signer: currentRunner as unknown as ethers.JsonRpcSigner,
            account: "0x0000000000000000000000000000000000000001",
            chainId: "1",
            error: null,
            clearError: jest.fn(),
            connectWallet: jest.fn(),
            switchChain: jest.fn(),
        };
        mockedWalletSession.mockReturnValue(walletSession);
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: jest.fn(),
            sessionStatus: "empty",
            canEdit: true,
        });

        const {rerender} = render(<DynamicContractItem contract={contract} walletChainId="1" del={jest.fn()} />);
        fireEvent.click(screen.getByText("RPC: Browser Wallet"));
        await screen.findByText("0x0000000000000000000000000000000000000010");
        const calldata = screen.getAllByRole("textbox")[0];
        fireEvent.change(calldata, {target: {value: "0x1234"}});
        fireEvent.click(screen.getByRole("button", {name: "Send immediately"}));

        await waitFor(() => expect(sendTransaction).toHaveBeenCalledTimes(1));
        expect(oldSendTransaction).not.toHaveBeenCalled();
        expect(connect).toHaveBeenCalledWith(currentRunner);

        mockedWalletSession.mockReturnValue({...walletSession, status: "disconnected", signer: null, account: null, chainId: null});
        rerender(<DynamicContractItem contract={contract} walletChainId="1" del={jest.fn()} />);

        expect(screen.getAllByRole("textbox")[0]).toHaveValue("0x1234");
        expect(screen.getByRole("button", {name: "Add to queue"})).toBeDisabled();
        expect(screen.getByRole("button", {name: "Send immediately"})).toBeDisabled();
    });

    it("explains when queued-state simulation belongs to another chain", async () => {
        mockSimulation({
            active: true,
            status: "ready",
            chainId: "10",
            revision: "ready:10",
            queuedCallCount: 1,
        });
        const signer = {call: jest.fn(), sendTransaction: jest.fn()};
        mockedWalletSession.mockReturnValue({
            status: "ready",
            provider: null,
            signer: signer as unknown as ethers.JsonRpcSigner,
            account: "0x0000000000000000000000000000000000000001",
            chainId: "1",
            error: null,
            clearError: jest.fn(),
            connectWallet: jest.fn(),
            switchChain: jest.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: jest.fn(),
            sessionStatus: "empty",
            canEdit: true,
        });
        const activeContract = {
            interface: new ethers.Interface([]),
            runner: signer,
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        };
        const contract = {
            ...activeContract,
            connect: jest.fn().mockReturnValue(activeContract),
        } as unknown as ethers.BaseContract;

        render(<DynamicContractItem contract={contract} walletChainId="1" del={jest.fn()} />);
        fireEvent.click(screen.getByText("RPC: Browser Wallet"));
        await screen.findByText("0x0000000000000000000000000000000000000010");
        expect(screen.getByText(/simulation belongs to chain 10; this contract is on chain 1/)).toBeInTheDocument();
    });

    it("groups read and write functions while preserving mutability labels", async () => {
        const signer = {call: jest.fn(), sendTransaction: jest.fn()};
        mockedWalletSession.mockReturnValue({
            status: "ready", provider: null, signer: signer as unknown as ethers.JsonRpcSigner,
            account: "0x0000000000000000000000000000000000000001", chainId: "1",
            error: null, clearError: jest.fn(), connectWallet: jest.fn(), switchChain: jest.fn(),
        });
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(), dispatch: jest.fn(), sessionStatus: "empty", canEdit: true,
        });
        const iface = new ethers.Interface([
            "function balance() view returns (uint256)",
            "function version() pure returns (uint256)",
            "function update()",
            "function deposit() payable",
        ]);
        const activeContract = {
            interface: iface, runner: signer,
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        };
        const contract = {...activeContract, connect: jest.fn().mockReturnValue(activeContract)} as unknown as ethers.BaseContract;

        render(<DynamicContractItem contract={contract} walletChainId="1" del={jest.fn()} />);
        fireEvent.click(screen.getByText("RPC: Browser Wallet"));
        await screen.findByText("0x0000000000000000000000000000000000000010");

        expect(screen.getByText("Read functions")).toBeInTheDocument();
        expect(screen.getByText(/Read canonical state or speculative queued state/)).toBeInTheDocument();
        expect(screen.getByText("Write functions")).toBeInTheDocument();
        expect(screen.getByText("View")).toBeInTheDocument();
        expect(screen.getByText("Pure")).toBeInTheDocument();
        expect(screen.getByText("Write")).toBeInTheDocument();
        expect(screen.getByText("Payable")).toBeInTheDocument();

        const functionSummaries = screen.getAllByRole("button", {name: /function (balance|version|update|deposit)/});
        const summaryIds = functionSummaries.map((summary) => summary.id);
        const contentIds = functionSummaries.map((summary) => summary.getAttribute("aria-controls"));
        expect(new Set(summaryIds).size).toBe(functionSummaries.length);
        expect(new Set(contentIds).size).toBe(functionSummaries.length);
        contentIds.forEach((contentId) => expect(contentId && document.getElementById(contentId)).toBeInTheDocument());
    });
});
