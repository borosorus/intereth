import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import RawCall from "./RawCall";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { useSimulation } from "../simulation/context";

vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));
vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../simulation/context", () => ({useSimulation: vi.fn()}));

const mockedWalletSession = vi.mocked(useWalletSession);
const mockedTransactionPlan = vi.mocked(useTransactionPlan);
const mockedSimulation = vi.mocked(useSimulation);

describe("RawCall queueing", () => {
    beforeEach(() => {
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
        });
    });

    it("runs a raw simulated read without an ordinary provider", async () => {
        const simulateRead = vi.fn().mockResolvedValue({returnData: "0x1234", gasUsed: "0x20"});
        mockedSimulation.mockReturnValue({
            ...mockedSimulation(),
            active: true,
            status: "ready",
            chainId: "1",
            revision: "ready:1",
            queuedCallCount: 1,
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
        const contract = {
            runner: null,
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<RawCall contract={contract} isStaticOnly chainId="1" disabled />);
        fireEvent.change(screen.getByRole("textbox"), {target: {value: "0xabcd"}});
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Run speculative"}));

        await waitFor(() => expect(simulateRead).toHaveBeenCalledWith("1", {
            to: "0x0000000000000000000000000000000000000010",
            data: "0xabcd",
        }));
        expect(await screen.findByText("0x1234")).toBeInTheDocument();
        expect(screen.getByText(/after 1 queued call/)).toBeInTheDocument();
    });
    it("adds a prepared call without invoking the transaction runner", async () => {
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
        const contract = {
            runner: {sendTransaction, call: vi.fn()},
            getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<RawCall contract={contract} />);
        // Both actions are offered; queueing must not touch the runner.
        expect(screen.getByRole("button", {name: "Send now"})).toBeEnabled();
        fireEvent.click(screen.getByRole("button", {name: "Add to queue"}));

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "ADD_CALL"})));
        expect(sendTransaction).not.toHaveBeenCalled();
        expect(screen.getByText("Added to transaction queue.")).toBeInTheDocument();
    });
});
