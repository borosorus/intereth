import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useWorkspaceMode } from "../workspace/context";
import ReadActions from "./ReadActions";

jest.mock("../workspace/context", () => ({useWorkspaceMode: jest.fn()}));

const mockedWorkspace = useWorkspaceMode as jest.MockedFunction<typeof useWorkspaceMode>;

describe("ReadActions workspace modes", () => {
    it("offers only the canonical call in Interact mode", () => {
        const onChain = jest.fn();
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: jest.fn()});

        render(
            <ReadActions
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={jest.fn()}
                onOnChain={onChain}
                onPinWatch={jest.fn()}
                canPinWatch
            />,
        );

        expect(screen.queryByRole("button", {name: "Run speculative"})).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Pin watch"})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Run on-chain"}));
        expect(onChain).toHaveBeenCalled();
    });

    it("offers canonical and speculative calls in Simulate mode", () => {
        const onPinWatch = jest.fn();
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: jest.fn()});

        render(
            <ReadActions
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={jest.fn()}
                onOnChain={jest.fn()}
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
