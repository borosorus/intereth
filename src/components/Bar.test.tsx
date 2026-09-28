import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { useTransactionPlan } from "../transaction-plan/context";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import Bar from "./Bar";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../transaction-plan/uiContext", () => ({useTransactionPlanUi: vi.fn()}));
vi.mock("@web3-onboard/react", () => ({
    useConnectWallet: () => [{wallet: null, connecting: false}, vi.fn()],
}));

const mockedPlan = vi.mocked(useTransactionPlan);
const mockedPlanUi = vi.mocked(useTransactionPlanUi);

const account = "0x0000000000000000000000000000000000000001";
const target = "0x0000000000000000000000000000000000000010";

function state(calls: number, watches: number) {
    let state = createEmptyTransactionPlanState();
    for (let index = 0; index < calls; index += 1) {
        state = transactionPlanReducer(state, {type: "ADD_CALL", call: {
            id: `call-${index}`, chainId: "1", from: account, to: target, data: "0x1234", value: "0", decoderAbi: [],
            display: {kind: "raw", contractAddress: target}, editor: {kind: "raw"}, createdAt: index,
        }});
    }
    for (let index = 0; index < watches; index += 1) {
        state = transactionPlanReducer(state, {type: "ADD_WATCH", watch: {
            id: `watch-${index}`, chainId: "1", from: account, to: target, data: "0xabcd", value: "0",
            display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: index,
        }});
    }
    return state;
}

describe("Bar workspace navigation", () => {
    beforeEach(() => {
        mockedPlanUi.mockReturnValue({activeView: "explore", setActiveView: vi.fn(), requestExecution: vi.fn()});
    });

    it("marks the active view and switches views", () => {
        mockedPlan.mockReturnValue({state: createEmptyTransactionPlanState(), dispatch: vi.fn(), sessionStatus: "empty", canEdit: true});
        render(<Bar />);
        expect(screen.getByRole("button", {name: /^Explore/})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", {name: /^Execution/})).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(screen.getByRole("button", {name: /^Execution/}));
        expect(mockedPlanUi().setActiveView).toHaveBeenCalledWith("execution");
    });

    it("counts queued calls in the Execution item", () => {
        mockedPlan.mockReturnValue({state: state(2, 0), dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});
        render(<Bar />);
        expect(screen.getByRole("button", {name: "Execution (2 in plan)"})).toBeInTheDocument();
    });

    it("indicates a watches-only plan", () => {
        mockedPlan.mockReturnValue({state: state(0, 1), dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});
        render(<Bar />);
        expect(screen.getByRole("button", {name: "Execution (1 in plan)"})).toBeInTheDocument();
    });

    it("shows no count for an empty workspace", () => {
        mockedPlan.mockReturnValue({state: createEmptyTransactionPlanState(), dispatch: vi.fn(), sessionStatus: "empty", canEdit: true});
        render(<Bar />);
        expect(screen.getByRole("button", {name: "Execution"})).toBeInTheDocument();
    });
});
