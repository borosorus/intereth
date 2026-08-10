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
                simulationEnabled
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={jest.fn()}
                onOnChain={onChain}
            />,
        );

        expect(screen.queryByRole("button", {name: "Run simulated"})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Run call"}));
        expect(onChain).toHaveBeenCalled();
    });

    it("offers canonical and speculative calls in Simulate mode", () => {
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: jest.fn()});

        render(
            <ReadActions
                simulationEnabled
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={jest.fn()}
                onOnChain={jest.fn()}
            />,
        );

        expect(screen.getByRole("button", {name: "Run simulated"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeInTheDocument();
    });
});
