import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import RawCall from "./RawCall";
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

describe("RawCall queueing", () => {
    beforeEach(() => {
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: jest.fn()});
        mockedSimulation.mockReturnValue({
            enabled: false,
            status: "disabled",
            chainId: null,
            error: null,
            revision: "disabled",
            queuedCallCount: 0,
            configured: false,
            canEnable: false,
            enable: jest.fn(),
            disable: jest.fn(),
            retry: jest.fn(),
            canSimulateChain: jest.fn().mockReturnValue(false),
            simulateRead: jest.fn(),
        });
    });

    it("runs a raw simulated read without an ordinary provider", async () => {
        const simulateRead = jest.fn().mockResolvedValue({returnData: "0x1234", gasUsed: "0x20"});
        mockedSimulation.mockReturnValue({
            ...mockedSimulation(),
            enabled: true,
            status: "ready",
            chainId: "1",
            revision: "ready:1",
            queuedCallCount: 1,
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
        const contract = {
            runner: null,
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<RawCall contract={contract} isStaticOnly chainId="1" disabled />);
        fireEvent.change(screen.getByRole("textbox"), {target: {value: "0xabcd"}});
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Run simulated"}));

        await waitFor(() => expect(simulateRead).toHaveBeenCalledWith("1", {
            to: "0x0000000000000000000000000000000000000010",
            data: "0xabcd",
        }));
        expect(await screen.findByText("0x1234")).toBeInTheDocument();
        expect(screen.getByText(/after 1 queued call/)).toBeInTheDocument();
    });
    it("adds a prepared call without invoking the transaction runner", async () => {
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
        const contract = {
            runner: {sendTransaction, call: jest.fn()},
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<RawCall contract={contract} />);
        fireEvent.click(screen.getByRole("button", {name: "Add to queue"}));

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "ADD_CALL"})));
        expect(sendTransaction).not.toHaveBeenCalled();
        expect(screen.getByText("Added to transaction queue.")).toBeInTheDocument();
    });
});
