import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { QueuedCall } from "../transaction-plan/types";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { inferDirectApprovalToken, validateApprovalRecovery } from "../transactions/approvalRecovery";
import { forceSendPreparedTransaction, sendPreparedTransaction } from "../transactions/sendTransaction";
import ApprovalRecoveryDialog, { ApprovalRecoveryRequest } from "./ApprovalRecoveryDialog";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../transaction-plan/uiContext", () => ({useTransactionPlanUi: vi.fn()}));
vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));
vi.mock("../transactions/approvalRecovery", async () => ({
    ...await vi.importActual("../transactions/approvalRecovery"),
    inferDirectApprovalToken: vi.fn(),
    validateApprovalRecovery: vi.fn(),
}));
vi.mock("../transactions/sendTransaction", () => ({
    forceSendPreparedTransaction: vi.fn(),
    sendPreparedTransaction: vi.fn(),
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
    decoderAbi: [],
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

const mockedPlan = vi.mocked(useTransactionPlan);
const mockedPlanUi = vi.mocked(useTransactionPlanUi);
const mockedWallet = vi.mocked(useWalletSession);
const mockedInfer = vi.mocked(inferDirectApprovalToken);
const mockedValidate = vi.mocked(validateApprovalRecovery);
const mockedSend = vi.mocked(sendPreparedTransaction);
const mockedForceSend = vi.mocked(forceSendPreparedTransaction);

describe("ApprovalRecoveryDialog", () => {
    const dispatch = vi.fn();
    const requestReview = vi.fn();
    const onClose = vi.fn();
    const onOriginalResult = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockedPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch,
            sessionStatus: "empty",
            canEdit: true,
        });
        mockedPlanUi.mockReturnValue({reviewRequest: 0, requestReview});
        mockedWallet.mockReturnValue({
            status: "ready",
            provider: {send: vi.fn()} as unknown as ethers.BrowserProvider,
            signer: {sendTransaction: vi.fn()} as unknown as ethers.JsonRpcSigner,
            account: ACCOUNT,
            chainId: "1",
            error: null,
            clearError: vi.fn(),
            connectWallet: vi.fn(),
            switchChain: vi.fn(),
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
