import { act, render } from "@testing-library/react";
import { useSimulation } from "./context";
import { useSimulatedRead } from "./useSimulatedRead";

jest.mock("./context", () => ({useSimulation: jest.fn()}));

const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;
let hook: ReturnType<typeof useSimulatedRead>;

function Probe() {
    hook = useSimulatedRead("1");
    return <span>{hook.loading ? "loading" : "idle"}</span>;
}

function simulationValue(revision: string, simulateRead: jest.Mock) {
    return {
        active: true,
        status: "ready" as const,
        chainId: "1",
        error: null,
        snapshot: null,
        revision,
        queuedCallCount: 2,
        configured: true,
        watchEvaluations: {},
        retry: jest.fn(),
        canSimulateChain: jest.fn().mockReturnValue(true),
        simulateRead,
    };
}

describe("useSimulatedRead", () => {
    it("discards an in-flight result when the queue revision changes", async () => {
        let resolveRead!: (value: {returnData: string; gasUsed: string}) => void;
        const simulateRead = jest.fn(() => new Promise<{returnData: string; gasUsed: string}>((resolve) => {
            resolveRead = resolve;
        }));
        mockedSimulation.mockReturnValue(simulationValue("queue-a", simulateRead));
        const view = render(<Probe />);

        let pending!: ReturnType<typeof hook.run>;
        act(() => {
            pending = hook.run({to: "0x0000000000000000000000000000000000000010", data: "0x"});
        });
        expect(hook.loading).toBe(true);

        mockedSimulation.mockReturnValue(simulationValue("queue-b", simulateRead));
        view.rerender(<Probe />);
        expect(hook.loading).toBe(false);

        await act(async () => resolveRead({returnData: "0x01", gasUsed: "0x1"}));
        await expect(pending).resolves.toBeNull();
    });
});
