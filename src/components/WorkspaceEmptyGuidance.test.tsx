import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import WorkspaceEmptyGuidance from "./WorkspaceEmptyGuidance";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
const mockedPlan = vi.mocked(useTransactionPlan);

describe("WorkspaceEmptyGuidance", () => {
    beforeEach(() => mockedPlan.mockReturnValue({state: createEmptyTransactionPlanState(), dispatch: vi.fn(), sessionStatus: "empty", canEdit: true}));

    it("explains reads, watches, and plans in an empty workspace", () => {
        render(<WorkspaceEmptyGuidance />);
        expect(screen.getByText("Start interacting")).toBeInTheDocument();
        expect(screen.getByText(/canonical state/)).toBeInTheDocument();
        expect(screen.getByText(/pin watches/)).toBeInTheDocument();
    });

    it("disappears once a watch is pinned", () => {
        const state = createEmptyTransactionPlanState();
        state.plan.watches.push({
            id: "watch", chainId: "1", from: "0x0000000000000000000000000000000000000001", to: "0x0000000000000000000000000000000000000010",
            data: "0x", value: "0", display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: 1,
        });
        mockedPlan.mockReturnValue({state, dispatch: vi.fn(), sessionStatus: "disconnected", canEdit: true});
        const {container} = render(<WorkspaceEmptyGuidance />);
        expect(container).toBeEmptyDOMElement();
    });

    it("disappears once a call is queued", () => {
        const state = createEmptyTransactionPlanState();
        state.plan.calls.push({
            id: "call", chainId: "1", from: "0x0000000000000000000000000000000000000001", to: "0x0000000000000000000000000000000000000010",
            data: "0x", value: "0", decoderAbi: [], display: {kind: "raw", contractAddress: "0x0000000000000000000000000000000000000010"}, editor: {kind: "raw"}, createdAt: 1,
        });
        mockedPlan.mockReturnValue({state, dispatch: vi.fn(), sessionStatus: "disconnected", canEdit: true});
        const {container} = render(<WorkspaceEmptyGuidance />);
        expect(container).toBeEmptyDOMElement();
    });
});
