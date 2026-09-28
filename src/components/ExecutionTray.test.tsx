import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { useTransactionPlanUi } from "../transaction-plan/uiContext";
import ExecutionTray from "./ExecutionTray";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../transaction-plan/uiContext", () => ({useTransactionPlanUi: vi.fn()}));

const mockedTransactionPlan = vi.mocked(useTransactionPlan);
const mockedPlanUi = vi.mocked(useTransactionPlanUi);
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";

function mockPlan(state: ReturnType<typeof createEmptyTransactionPlanState>) {
    mockedTransactionPlan.mockReturnValue({state, dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});
}

function planWithCalls(count: number) {
    let state = createEmptyTransactionPlanState();
    for (let index = 0; index < count; index += 1) {
        state = transactionPlanReducer(state, {type: "ADD_CALL", call: {
            id: `call-${index}`, chainId: "1", from: ACCOUNT, to: TARGET, data: "0x", value: "0",
            decoderAbi: [], display: {kind: "raw", contractAddress: TARGET}, editor: {kind: "raw"}, createdAt: index + 1,
        }});
    }
    return state;
}

function planWithWatches(count: number) {
    let state = createEmptyTransactionPlanState();
    for (let index = 0; index < count; index += 1) {
        state = transactionPlanReducer(state, {type: "ADD_WATCH", watch: {
            id: `watch-${index}`, chainId: "1", from: ACCOUNT, to: TARGET, data: `0xabcd${index}`, value: "0",
            display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: index + 1,
        }});
    }
    return state;
}

describe("ExecutionTray", () => {
    beforeEach(() => {
        mockedPlanUi.mockReturnValue({activeView: "explore", setActiveView: vi.fn(), requestExecution: vi.fn()});
    });

    it("renders nothing for an empty plan", () => {
        mockPlan(createEmptyTransactionPlanState());
        const {container} = render(<ExecutionTray />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole("button", {name: "Review execution"})).not.toBeInTheDocument();
    });

    it("shows singular call counts and opens Execution on request", () => {
        mockPlan(planWithCalls(1));
        render(<ExecutionTray />);
        expect(screen.getByText("1 call")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Review execution"}));
        expect(mockedPlanUi().requestExecution).toHaveBeenCalled();
    });

    it("shows calls and watches side by side", () => {
        let state = planWithCalls(2);
        state = transactionPlanReducer(state, {type: "ADD_WATCH", watch: {
            id: "watch-1", chainId: "1", from: ACCOUNT, to: TARGET, data: "0xabcd", value: "0",
            display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: 9,
        }});
        mockPlan(state);
        render(<ExecutionTray />);
        expect(screen.getByText("2 calls · 1 pinned watch")).toBeInTheDocument();
    });

    it("shows the watches-only plan", () => {
        mockPlan(planWithWatches(2));
        render(<ExecutionTray />);
        expect(screen.getByText("2 pinned watches")).toBeInTheDocument();
    });
});
