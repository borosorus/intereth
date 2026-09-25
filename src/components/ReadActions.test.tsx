import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useWorkspaceMode } from "../workspace/context";
import ReadActions from "./ReadActions";

vi.mock("../workspace/context", () => ({useWorkspaceMode: vi.fn()}));

const mockedWorkspace = vi.mocked(useWorkspaceMode);

describe("ReadActions workspace modes", () => {
    it("offers only the canonical call in Interact mode", () => {
        const onChain = vi.fn();
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: vi.fn()});

        render(
            <ReadActions
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={vi.fn()}
                onOnChain={onChain}
                onPinWatch={vi.fn()}
                canPinWatch
            />,
        );

        expect(screen.queryByRole("button", {name: "Run speculative"})).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Pin watch"})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Run on-chain"}));
        expect(onChain).toHaveBeenCalled();
    });

    it("offers canonical and speculative calls in Simulate mode", () => {
        const onPinWatch = vi.fn();
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()});

        render(
            <ReadActions
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={vi.fn()}
                onOnChain={vi.fn()}
                onPinWatch={onPinWatch}
                canPinWatch
            />,
        );

        expect(screen.getByRole("button", {name: "Run speculative"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Pin watch"}));
        expect(onPinWatch).toHaveBeenCalled();
    });
});
