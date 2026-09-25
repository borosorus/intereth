import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState } from "../transaction-plan/reducer";
import { useWorkspaceMode } from "../workspace/context";
import WorkspaceEmptyGuidance from "./WorkspaceEmptyGuidance";

vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../workspace/context", () => ({useWorkspaceMode: vi.fn()}));
const mockedPlan = vi.mocked(useTransactionPlan);
const mockedWorkspace = vi.mocked(useWorkspaceMode);

describe("WorkspaceEmptyGuidance", () => {
    beforeEach(() => mockedPlan.mockReturnValue({state: createEmptyTransactionPlanState(), dispatch: vi.fn(), sessionStatus: "empty", canEdit: true}));

    it("explains canonical interaction in an empty Interact workspace", () => {
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: vi.fn()});
        render(<WorkspaceEmptyGuidance />);
        expect(screen.getByText("Start interacting")).toBeInTheDocument();
        expect(screen.getByText(/canonical state/)).toBeInTheDocument();
    });

    it("explains watches and queued state in an empty Simulate workspace", () => {
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()});
        render(<WorkspaceEmptyGuidance />);
        expect(screen.getByText("Build speculative state")).toBeInTheDocument();
        expect(screen.getByText(/Pin a read/)).toBeInTheDocument();
    });

    it("disappears after relevant workspace content exists", () => {
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()});
        const state = createEmptyTransactionPlanState();
        state.plan.watches.push({
            id: "watch", chainId: "1", from: "0x0000000000000000000000000000000000000001", to: "0x0000000000000000000000000000000000000010",
            data: "0x", value: "0", display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: 1,
        });
        mockedPlan.mockReturnValue({state, dispatch: vi.fn(), sessionStatus: "disconnected", canEdit: true});
        const {container} = render(<WorkspaceEmptyGuidance />);
        expect(container).toBeEmptyDOMElement();
    });
});
