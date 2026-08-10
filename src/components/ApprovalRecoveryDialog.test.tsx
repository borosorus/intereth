import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { QueuedCall } from "../transaction-plan/types";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { inferDirectApprovalToken, validateApprovalRecovery } from "../transactions/approvalRecovery";
import { forceSendPreparedTransaction, sendPreparedTransaction } from "../transactions/sendTransaction";
import ApprovalRecoveryDialog, { ApprovalRecoveryRequest } from "./ApprovalRecoveryDialog";

jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../transaction-plan/uiContext", () => ({useTransactionPlanUi: jest.fn()}));
jest.mock("../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));
jest.mock("../transactions/approvalRecovery", () => ({
    ...jest.requireActual("../transactions/approvalRecovery"),
    inferDirectApprovalToken: jest.fn(),
    validateApprovalRecovery: jest.fn(),
}));
jest.mock("../transactions/sendTransaction", () => ({
    forceSendPreparedTransaction: jest.fn(),
    sendPreparedTransaction: jest.fn(),
}));

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TOKEN = "0x0000000000000000000000000000000000000010";
const SPENDER = "0x0000000000000000000000000000000000000020";
const TARGET = "0x0000000000000000000000000000000000000030";
const originalCall: QueuedCall = {
    id: "original",
    chainId: "1",
    from: ACCOUNT,
    to: TARGET,
    data: "0xabcd",
    value: "0",
    display: {kind: "raw", contractAddress: TARGET},
    editor: {kind: "raw"},
    createdAt: 1,
};
const approvalCall: QueuedCall = {...originalCall, id: "approval", to: TOKEN, data: "0x095ea7b3"};
const request: ApprovalRecoveryRequest = {
    originalCall,
    requirement: {
        kind: "erc20",
        spender: SPENDER,
        currentAllowance: BigInt(0),
        needed: BigInt(12),
        revertData: "0x1234",
    },
};

const mockedPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const mockedPlanUi = useTransactionPlanUi as jest.MockedFunction<typeof useTransactionPlanUi>;
const mockedWallet = useWalletSession as jest.MockedFunction<typeof useWalletSession>;
const mockedInfer = inferDirectApprovalToken as jest.MockedFunction<typeof inferDirectApprovalToken>;
const mockedValidate = validateApprovalRecovery as jest.MockedFunction<typeof validateApprovalRecovery>;
const mockedSend = sendPreparedTransaction as jest.MockedFunction<typeof sendPreparedTransaction>;
const mockedForceSend = forceSendPreparedTransaction as jest.MockedFunction<typeof forceSendPreparedTransaction>;

describe("ApprovalRecoveryDialog", () => {
    const dispatch = jest.fn();
    const requestReview = jest.fn();
    const onClose = jest.fn();
    const onOriginalResult = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockedPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch,
            sessionStatus: "empty",
            canEdit: true,
        });
        mockedPlanUi.mockReturnValue({reviewRequest: 0, requestReview});
        mockedWallet.mockReturnValue({
            status: "ready",
            provider: {send: jest.fn()} as unknown as ethers.BrowserProvider,
            signer: {sendTransaction: jest.fn()} as unknown as ethers.JsonRpcSigner,
            account: ACCOUNT,
            chainId: "1",
            error: null,
            clearError: jest.fn(),
            connectWallet: jest.fn(),
            switchChain: jest.fn(),
        });
        mockedInfer.mockResolvedValue(TOKEN);
        mockedValidate.mockResolvedValue({approvalCall, gasLimit: BigInt(120), blockNumber: "0x20"});
    });

    async function renderValidated() {
        render(<ApprovalRecoveryDialog request={request} onClose={onClose} onOriginalResult={onOriginalResult} />);
        await waitFor(() => expect(screen.getByLabelText("Token contract address")).toHaveValue(TOKEN));
        expect(window.getComputedStyle(screen.getByText(SPENDER)).overflowWrap).toBe("anywhere");
        fireEvent.click(screen.getByRole("button", {name: "Validate approval"}));
        await screen.findByText(/both succeeded in simulation/);
    }

    it("adds approval before the original call and opens plan review", async () => {
        await renderValidated();
        fireEvent.click(screen.getByRole("button", {name: "Add approval and transaction to plan"}));

        expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
            {type: "ADD_CALL", call: approvalCall},
            {type: "ADD_CALL", call: originalCall},
        ]);
        expect(requestReview).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("requires force-send confirmation and blocks retries after an unresolved hash", async () => {
        mockedForceSend.mockImplementation(async (_provider, _call, _gasLimit, onResult) => {
            onResult({kind: "transaction", status: "submitted", hash: `0x${"11".repeat(32)}`});
            throw Object.assign(new Error("confirmation timed out"), {code: "TIMEOUT"});
        });
        await renderValidated();

        fireEvent.click(screen.getByRole("button", {name: "Send anyway"}));
        expect(mockedForceSend).not.toHaveBeenCalled();
        expect(screen.getByText(/expected to revert and consume gas/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Confirm force send"}));
        await waitFor(() => expect(mockedForceSend).toHaveBeenCalledWith(
            expect.anything(), originalCall, BigInt(120), expect.any(Function),
        ));
        expect(await screen.findByText(/original transaction was submitted but remains unresolved/)).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Confirm force send"})).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", {name: "Close"})).toBeEnabled());
    });

    it("requires a second click after the approval confirms", async () => {
        mockedSend.mockImplementation(async (_signer, call, onResult) => {
            const result = {kind: "transaction" as const, status: "confirmed" as const, hash: `0x${"11".repeat(32)}`};
            onResult(result);
            return result;
        });
        await renderValidated();

        fireEvent.click(screen.getByRole("button", {name: "Approve first"}));
        await screen.findByRole("button", {name: "Send transaction"});
        expect(mockedSend).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", {name: "Send transaction"}));
        await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(2));
        expect(mockedSend.mock.calls[0][1]).toBe(approvalCall);
        expect(mockedSend.mock.calls[1][1]).toBe(originalCall);
    });
});
