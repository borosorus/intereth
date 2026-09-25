import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { WatchExpression } from "../transaction-plan/types";
import { useWorkspaceMode } from "../workspace/context";
import { useWalletSession } from "../wallet/WalletSessionContext";
import { usePinWatch } from "./usePinWatch";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../workspace/context", () => ({useWorkspaceMode: vi.fn()}));
vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));

const mockedPlan = vi.mocked(useTransactionPlan);
const mockedWorkspace = vi.mocked(useWorkspaceMode);
const mockedWallet = vi.mocked(useWalletSession);
const account = "0x0000000000000000000000000000000000000001";
const target = "0x0000000000000000000000000000000000000010";
const watch: WatchExpression = {
    id: "watch-1", chainId: "1", from: account, to: target, data: "0xabcd", value: "0",
    display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: 2,
};

function planState() {
    return transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: {
        id: "call-1", chainId: "1", from: account, to: target, data: "0x1234", value: "0", decoderAbi: [],
        display: {kind: "raw", contractAddress: target}, editor: {kind: "raw"}, createdAt: 1,
    }});
}

let pinHook: ReturnType<typeof usePinWatch>;
function Probe() {
    pinHook = usePinWatch("1");
    return (
        <>
            <span>{pinHook.canPin ? "available" : "unavailable"}</span>
            <span>{pinHook.notice}</span>
            <button onClick={() => void pinHook.pin(() => watch)}>Pin</button>
        </>
    );
}

describe("usePinWatch", () => {
    beforeEach(() => {
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()});
        mockedWallet.mockReturnValue({
            status: "ready", account, chainId: "1", provider: null, signer: null, error: null,
            clearError: vi.fn(), connectWallet: vi.fn(), switchChain: vi.fn(),
        });
    });

    it("pins a watch directly without a queued call", async () => {
        const dispatch = vi.fn();
        mockedPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(), dispatch, sessionStatus: "empty", canEdit: true,
        });
        render(<Probe />);
        expect(screen.getByText("available")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Pin"}));
        await waitFor(() => expect(dispatch).toHaveBeenCalledWith({type: "ADD_WATCH", watch}));
    });

    it("dispatches a prepared watch for the matching editable plan", async () => {
        const dispatch = vi.fn();
        mockedPlan.mockReturnValue({state: planState(), dispatch, sessionStatus: "ready", canEdit: true});
        render(<Probe />);
        expect(screen.getByText("available")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Pin"}));
        await waitFor(() => expect(dispatch).toHaveBeenCalledWith({type: "ADD_WATCH", watch}));
        expect(screen.getByText("Watch pinned.")).toBeInTheDocument();
    });

    it("centralizes duplicate detection", async () => {
        const dispatch = vi.fn();
        const state = transactionPlanReducer(planState(), {type: "ADD_WATCH", watch});
        mockedPlan.mockReturnValue({state, dispatch, sessionStatus: "ready", canEdit: true});
        render(<Probe />);
        fireEvent.click(screen.getByRole("button", {name: "Pin"}));
        expect(await screen.findByText("This watch is already pinned.")).toBeInTheDocument();
        expect(dispatch).not.toHaveBeenCalled();
    });
});
