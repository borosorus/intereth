import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useSimulation } from "../../simulation/context";
import SimulationEndpointStatus from "./SimulationEndpointStatus";

jest.mock("../../simulation/context", () => ({useSimulation: jest.fn()}));

const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;

function simulationValue(overrides: Partial<ReturnType<typeof useSimulation>> = {}): ReturnType<typeof useSimulation> {
    return {
        active: false,
        watchActive: false,
        status: "idle",
        chainId: "999",
        error: null,
        snapshot: null,
        revision: "queue",
        queuedCallCount: 0,
        configured: false,
        watchEvaluations: {},
        tokenMetadataByAddress: {},
        tokenMetadataResolving: false,
        retry: jest.fn(),
        canSimulateChain: jest.fn().mockReturnValue(false),
        simulateRead: jest.fn(),
        ...overrides,
    };
}

describe("SimulationEndpointStatus", () => {
    it("shows browser capability probing without claiming the RPC is unavailable", () => {
        mockedSimulation.mockReturnValue(simulationValue({
            endpointStatus: "checking",
            browserCapability: {status: "checking", chainId: "999", error: null},
        }));

        render(<SimulationEndpointStatus />);

        expect(screen.getByText(/Checking the connected wallet RPC/)).toBeInTheDocument();
        expect(screen.queryByText(/No compatible simulation RPC/)).not.toBeInTheDocument();
    });

    it("explains unsupported browser RPCs and retries the capability check", () => {
        const retry = jest.fn();
        mockedSimulation.mockReturnValue(simulationValue({
            endpointStatus: "unavailable",
            browserCapability: {status: "unsupported", chainId: "999", error: null},
            retry,
        }));

        render(<SimulationEndpointStatus />);

        expect(screen.getByText(/wallet RPC does not support eth_simulateV1/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Retry"}));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["fixed", "Configured RPC", "Provided by Intereth for this chain"],
        ["browser", "Wallet RPC", "Provided by the connected wallet"],
    ] as const)("labels the selected %s endpoint", (source, label, description) => {
        mockedSimulation.mockReturnValue(simulationValue({
            configured: true,
            endpointStatus: "ready",
            endpointSource: source,
        }));

        render(<SimulationEndpointStatus />);

        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText(description)).toBeInTheDocument();
    });
});
