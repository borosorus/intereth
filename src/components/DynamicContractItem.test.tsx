import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import DynamicContractItem, { DynamicFunctionItem } from "./DynamicContractItem";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";

jest.mock("../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));
jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));

const mockedWalletSession = useWalletSession as jest.MockedFunction<typeof useWalletSession>;
const mockedTransactionPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;

describe("DynamicFunctionItem queueing", () => {
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
            runner: {sendTransaction},
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
        } as unknown as ethers.BaseContract;

        render(<DynamicFunctionItem contract={contract} frag={fragment} />);
        fireEvent.click(screen.getByRole("button", {name: /pause function pause/}));
        fireEvent.click(screen.getByRole("button", {name: "Add to queue"}));

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "ADD_CALL"})));
        expect(sendTransaction).not.toHaveBeenCalled();
        expect(screen.getByText("Added to transaction queue.")).toBeInTheDocument();
    });
});

describe("DynamicContractItem wallet lifecycle", () => {
    it("rebinds raw calls to the active signer and preserves the form while disconnected", async () => {
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
});
