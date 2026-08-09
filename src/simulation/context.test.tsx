import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactNode } from "react";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { QueuedCall } from "../transaction-plan/types";
import { SimulationProvider, useSimulation } from "./context";

jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../onboard", () => ({
    chainsById: new Map([["1", {id: "1", simulationRpcUrl: "https://simulate.example"}]]),
}));

const mockedTransactionPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const call: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: ACCOUNT,
    to: TARGET,
    data: "0x1234",
    value: "0",
    display: {kind: "raw", contractAddress: TARGET},
    editor: {kind: "raw"},
    createdAt: 1,
};

function planState() {
    return transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call});
}

function mockPlan(sessionStatus: "ready" | "disconnected" = "ready", execution = planState().execution) {
    mockedTransactionPlan.mockReturnValue({
        state: {...planState(), execution},
        dispatch: jest.fn(),
        sessionStatus,
        canEdit: sessionStatus === "ready",
    });
}

let currentSimulation: ReturnType<typeof useSimulation>;
function Probe() {
    currentSimulation = useSimulation();
    return <span>{currentSimulation.status}</span>;
}

function Wrapper({children}: {children: ReactNode}) {
    return <SimulationProvider>{children}</SimulationProvider>;
}

describe("SimulationProvider", () => {
    beforeEach(() => {
        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            json: async () => ({jsonrpc: "2.0", id: 1, result: "0x1"}),
        } as Response);
    });

    afterEach(() => jest.restoreAllMocks());

    it("checks the endpoint and remains ready across wallet disconnects", async () => {
        mockPlan();
        const view = render(<Probe />, {wrapper: Wrapper});

        await act(async () => currentSimulation.enable());
        expect(screen.getByText("ready")).toBeInTheDocument();
        expect(currentSimulation.canSimulateChain("1")).toBe(true);

        mockPlan("disconnected");
        view.rerender(<Probe />);
        expect(screen.getByText("ready")).toBeInTheDocument();
        expect(currentSimulation.canSimulateChain("1")).toBe(true);
    });

    it("disables simulation when execution starts", async () => {
        mockPlan();
        const view = render(<Probe />, {wrapper: Wrapper});
        await act(async () => currentSimulation.enable());

        mockPlan("ready", {status: "submitting"});
        view.rerender(<Probe />);
        expect(screen.getByText("disabled")).toBeInTheDocument();
        expect(currentSimulation.enabled).toBe(false);
    });

    it("moves endpoint failures into retryable error state", async () => {
        jest.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 503,
        } as Response);
        mockPlan();
        render(<Probe />, {wrapper: Wrapper});

        await act(async () => currentSimulation.enable());
        expect(screen.getByText("error")).toBeInTheDocument();
        expect(currentSimulation.error?.code).toBe("SIMULATION_RPC_UNAVAILABLE");
        expect(currentSimulation.canEnable).toBe(true);
    });
});
