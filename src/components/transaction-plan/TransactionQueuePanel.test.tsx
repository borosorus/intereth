import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import { prepareAbiCall, prepareRawCall } from "../../calls/prepareCall";
import { useTransactionPlan } from "../../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../../transaction-plan/reducer";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import TransactionQueuePanel from "./TransactionQueuePanel";

jest.mock("../../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));

const mockedTransactionPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const mockedWalletSession = useWalletSession as jest.MockedFunction<typeof useWalletSession>;
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";

function queuedState(requiresResume = false) {
    const fragment = new ethers.Interface(["function pause()"]).getFunction("pause")!;
    const abiCall = prepareAbiCall({
        fragment,
        target: TARGET,
        account: ACCOUNT,
        chainId: "1",
        argumentValues: [],
        id: "abi-call",
        createdAt: 1,
    });
    const rawCall = prepareRawCall({
        target: TARGET,
        account: ACCOUNT,
        chainId: "1",
        data: "0x1234",
        valueAmount: "0",
        valueUnit: "wei",
        id: "raw-call",
        createdAt: 2,
    });
    let state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: abiCall});
    state = transactionPlanReducer(state, {type: "ADD_CALL", call: rawCall});
    return {...state, plan: {...state.plan, requiresResume}};
}

function mockWallet(chainId = "1") {
    mockedWalletSession.mockReturnValue({
        status: "ready",
        provider: null,
        signer: null,
        account: ACCOUNT,
        chainId,
        error: null,
        clearError: jest.fn(),
        connectWallet: jest.fn(),
        switchChain: jest.fn(),
    });
}

describe("TransactionQueuePanel", () => {
    it("reviews, reorders, duplicates, and edits ABI and raw calls", async () => {
        const dispatch = jest.fn();
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch,
            sessionStatus: "ready",
            canEdit: true,
            resumePlan: jest.fn(),
        });

        render(<TransactionQueuePanel />);
        fireEvent.click(screen.getByRole("button", {name: /2 queued calls · Review plan/}));

        expect(screen.getByText(/pause\(\)/)).toBeInTheDocument();
        expect(screen.getByText(/Raw transaction/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Move call 2 up"}));
        expect(dispatch).toHaveBeenCalledWith({type: "MOVE_CALL", callId: "raw-call", direction: "up"});

        fireEvent.click(screen.getAllByRole("button", {name: /Duplicate/})[0]);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "DUPLICATE_CALL",
            afterCallId: "abi-call",
            call: expect.objectContaining({data: expect.any(String)}),
        }));

        fireEvent.click(screen.getAllByRole("button", {name: /Edit/})[0]);
        fireEvent.click(screen.getByRole("button", {name: "Save changes"}));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "UPDATE_CALL",
            call: expect.objectContaining({id: "abi-call", data: expect.stringMatching(/^0x/)}),
        }));

        fireEvent.click(screen.getAllByRole("button", {name: /Edit/})[1]);
        fireEvent.change(screen.getByRole("textbox", {name: "Hex calldata"}), {target: {value: "0xabcd"}});
        fireEvent.click(screen.getByRole("button", {name: "Save changes"}));
        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "UPDATE_CALL",
            call: expect.objectContaining({id: "raw-call", data: "0xabcd"}),
        })));

        fireEvent.click(screen.getAllByRole("button", {name: /Remove/})[0]);
        expect(dispatch).toHaveBeenCalledWith({type: "REMOVE_CALL", callId: "abi-call"});
    });

    it("requires explicit resume and confirms clearing", () => {
        const dispatch = jest.fn();
        const resumePlan = jest.fn(() => true);
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(true),
            dispatch,
            sessionStatus: "requires_resume",
            canEdit: false,
            resumePlan,
        });

        render(<TransactionQueuePanel />);
        fireEvent.click(screen.getByRole("button", {name: /Review plan/}));
        expect(screen.getByText(/restored plan is read-only/)).toBeInTheDocument();
        expect(screen.getAllByRole("button", {name: /Edit/})[0]).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Resume plan"}));
        expect(resumePlan).toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", {name: "Clear plan"}));
        const dialog = screen.getByRole("dialog", {name: "Clear transaction plan?"});
        fireEvent.click(within(dialog).getByRole("button", {name: "Clear plan"}));
        expect(dispatch).toHaveBeenCalledWith({type: "CLEAR_PLAN"});
    });

    it("blocks editing and offers an explicit network switch on mismatch", async () => {
        const switchChain = jest.fn().mockResolvedValue(undefined);
        mockWallet("10");
        mockedWalletSession.mockReturnValue({...mockedWalletSession(), switchChain});
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: jest.fn(),
            sessionStatus: "chain_mismatch",
            canEdit: false,
            resumePlan: jest.fn(),
        });

        render(<TransactionQueuePanel />);
        fireEvent.click(screen.getByRole("button", {name: /Review plan/}));
        expect(screen.getByText(/plan belongs to chain 1/)).toBeInTheDocument();
        expect(screen.getAllByRole("button", {name: /Edit/})[0]).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Switch network"}));
        await waitFor(() => expect(switchChain).toHaveBeenCalledWith("1"));
    });

    it("shows the original account and a reconnect action on account mismatch", async () => {
        const connectWallet = jest.fn().mockResolvedValue(null);
        mockWallet();
        mockedWalletSession.mockReturnValue({
            ...mockedWalletSession(),
            account: "0x0000000000000000000000000000000000000002",
            connectWallet,
        });
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: jest.fn(),
            sessionStatus: "account_mismatch",
            canEdit: false,
            resumePlan: jest.fn(),
        });

        render(<TransactionQueuePanel />);
        fireEvent.click(screen.getByRole("button", {name: /Review plan/}));
        expect(screen.getByText(/plan belongs to 0x000000…000001/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Reconnect account"}));
        await waitFor(() => expect(connectWallet).toHaveBeenCalled());
    });
});
