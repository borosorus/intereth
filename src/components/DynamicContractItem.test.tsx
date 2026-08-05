import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import { DynamicFunctionItem } from "./DynamicContractItem";
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
            resumePlan: jest.fn(),
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
