import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import { useSimulation } from "../simulation/context";
import StaticContractItem, { StaticFunctionItem } from "./StaticContractItem";
import { useWorkspaceMode } from "../workspace/context";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { useWalletSession } from "../wallet/WalletSessionContext";

vi.mock("../simulation/context", () => ({useSimulation: vi.fn()}));
vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));
vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../workspace/context", () => ({useWorkspaceMode: vi.fn()}));

const mockedSimulation = vi.mocked(useSimulation);
const mockedWorkspace = vi.mocked(useWorkspaceMode);
const mockedTransactionPlan = vi.mocked(useTransactionPlan);
const mockedWallet = vi.mocked(useWalletSession);

describe("StaticFunctionItem simulated reads", () => {
    beforeEach(() => {
        mockedWallet.mockReturnValue({
            status: "ready", account: "0x0000000000000000000000000000000000000001", chainId: "1",
            provider: null, signer: null, error: null, clearError: vi.fn(), connectWallet: vi.fn(), switchChain: vi.fn(),
        });
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()});
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: vi.fn(),
            sessionStatus: "empty",
            canEdit: false,
        });
    });
    it("uses queued-state simulation as the primary action", async () => {
        const simulateRead = vi.fn().mockResolvedValue({
            returnData: ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [true]),
            gasUsed: "0x30",
        });
        mockedSimulation.mockReturnValue({
            active: true,
            watchActive: true,
            status: "ready",
            chainId: "1",
            error: null,
            snapshot: null,
            revision: "ready:1",
            queuedCallCount: 3,
            configured: true,
            watchEvaluations: {},
            tokenMetadataByAddress: {},
            tokenMetadataResolving: false,
            retry: vi.fn(),
            canSimulateChain: vi.fn().mockReturnValue(true),
            simulateRead,
        });
        const fragment = new ethers.Interface(["function active() view returns (bool)"]).getFunction("active")!;
        const onChainCall = vi.fn();
        const contract = {
            runner: {call: onChainCall},
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
            getFunction: vi.fn(),
        } as unknown as ethers.BaseContract;

        const view = render(<StaticFunctionItem contract={contract} frag={fragment} chainId="1" />);
        fireEvent.click(screen.getByRole("button", {name: /active\(\) View/}));
        fireEvent.click(screen.getByRole("button", {name: "Run speculative"}));

        await waitFor(() => expect(simulateRead).toHaveBeenCalledWith("1", {
            to: "0x0000000000000000000000000000000000000010",
            data: fragment.selector,
        }));
        expect(await screen.findByText("true")).toBeInTheDocument();
        expect(screen.getByText(/after 3 queued calls/)).toBeInTheDocument();
        expect(onChainCall).not.toHaveBeenCalled();

        mockedWorkspace.mockReturnValue({mode: "interact", setMode: vi.fn()});
        view.rerender(<StaticFunctionItem contract={contract} frag={fragment} chainId="1" />);
        expect(screen.queryByText("Simulated")).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeInTheDocument();
    });

    it("keeps an explicit ordinary on-chain action", async () => {
        const simulateRead = vi.fn();
        mockedSimulation.mockReturnValue({
            active: true,
            watchActive: true,
            status: "ready",
            chainId: "1",
            error: null,
            snapshot: null,
            revision: "ready:1",
            queuedCallCount: 1,
            configured: true,
            watchEvaluations: {},
            tokenMetadataByAddress: {},
            tokenMetadataResolving: false,
            retry: vi.fn(),
            canSimulateChain: vi.fn().mockReturnValue(true),
            simulateRead,
        });
        const fragment = new ethers.Interface(["function active() view returns (bool)"]).getFunction("active")!;
        const onChainRead = vi.fn().mockResolvedValue(false);
        const contract = {
            runner: {call: vi.fn()},
            getFunction: vi.fn().mockReturnValue(onChainRead),
        } as unknown as ethers.BaseContract;

        render(<StaticFunctionItem contract={contract} frag={fragment} chainId="1" />);
        fireEvent.click(screen.getByRole("button", {name: /active\(\) View/}));
        fireEvent.click(screen.getByRole("button", {name: "Run on-chain"}));

        await waitFor(() => expect(onChainRead).toHaveBeenCalledWith());
        expect(await screen.findByText("false")).toBeInTheDocument();
        expect(screen.getByText("On-chain")).toBeInTheDocument();
        expect(simulateRead).not.toHaveBeenCalled();
    });

    it("shows reads and collapses write functions that require a wallet", async () => {
        mockedSimulation.mockReturnValue({
            active: false, watchActive: false, status: "idle", chainId: null, error: null, snapshot: null,
            revision: "disabled", queuedCallCount: 0, configured: false, watchEvaluations: {},
            tokenMetadataByAddress: {}, tokenMetadataResolving: false, retry: vi.fn(),
            canSimulateChain: vi.fn().mockReturnValue(false), simulateRead: vi.fn(),
        });
        const iface = new ethers.Interface([
            "function balance() view returns (uint256)",
            "function update()",
        ]);
        const contract = {
            interface: iface,
            runner: {call: vi.fn()},
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
            getFunction: vi.fn(),
        } as unknown as ethers.BaseContract;

        render(
            <StaticContractItem
                contract={contract}
                providerDetails={{label: "Test RPC", url: "https://rpc.test", chainId: "1"}}
            />,
        );
        await screen.findByText("0x0000000000000000000000000000000000000010");

        expect(screen.getByText(/Read canonical state or speculative queued state/)).toBeInTheDocument();
        expect(screen.getByRole("button", {name: /balance\(\) View/})).toBeInTheDocument();
        const writeGroup = screen.getByRole("button", {name: /Write functions · wallet required/});
        expect(writeGroup).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("button", {name: /update\(\) Write/})).not.toBeInTheDocument();

        fireEvent.click(writeGroup);
        expect(screen.getByRole("button", {name: /update\(\) Write/})).toBeInTheDocument();
        expect(screen.getByText(/Connect a browser wallet to make state-modifying calls/)).toBeInTheDocument();
    });
});
