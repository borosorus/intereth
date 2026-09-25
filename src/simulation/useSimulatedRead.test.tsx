import { act, render } from "@testing-library/react";
import type { Mock } from "vitest";
import { useSimulation } from "./context";
import { useSimulatedRead } from "./useSimulatedRead";
import { useWorkspaceMode } from "../workspace/context";

vi.mock("./context", () => ({useSimulation: vi.fn()}));
vi.mock("../workspace/context", () => ({useWorkspaceMode: vi.fn()}));

const mockedSimulation = vi.mocked(useSimulation);
const mockedWorkspace = vi.mocked(useWorkspaceMode);
let hook: ReturnType<typeof useSimulatedRead>;

function Probe() {
    hook = useSimulatedRead("1");
    return <span>{hook.loading ? "loading" : "idle"}</span>;
}

function simulationValue(revision: string, simulateRead: Mock) {
    return {
        active: true,
        watchActive: true,
        status: "ready" as const,
        chainId: "1",
        error: null,
        snapshot: null,
        revision,
        queuedCallCount: 2,
        configured: true,
        watchEvaluations: {},
        tokenMetadataByAddress: {},
        tokenMetadataResolving: false,
        retry: vi.fn(),
        canSimulateChain: vi.fn().mockReturnValue(true),
        simulateRead,
    };
}

describe("useSimulatedRead", () => {
    beforeEach(() => mockedWorkspace.mockReturnValue({mode: "simulate", setMode: vi.fn()}));
    it("discards an in-flight result when the queue revision changes", async () => {
        let resolveRead!: (value: {returnData: string; gasUsed: string}) => void;
        const simulateRead = vi.fn(() => new Promise<{returnData: string; gasUsed: string}>((resolve) => {
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

    it("cancels an in-flight result when leaving Simulate mode", async () => {
        let resolveRead!: (value: {returnData: string; gasUsed: string}) => void;
        const simulateRead = vi.fn(() => new Promise<{returnData: string; gasUsed: string}>((resolve) => {
            resolveRead = resolve;
        }));
        mockedSimulation.mockReturnValue(simulationValue("queue-a", simulateRead));
        const view = render(<Probe />);

        let pending!: ReturnType<typeof hook.run>;
        act(() => {
            pending = hook.run({to: "0x0000000000000000000000000000000000000010", data: "0x"});
        });
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: vi.fn()});
        view.rerender(<Probe />);
        expect(hook.available).toBe(false);
        expect(hook.enabled).toBe(false);
        expect(hook.loading).toBe(false);

        await act(async () => resolveRead({returnData: "0x01", gasUsed: "0x1"}));
        await expect(pending).resolves.toBeNull();
    });
});
