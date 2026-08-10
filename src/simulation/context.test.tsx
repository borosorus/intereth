import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactNode } from "react";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { QueuedCall } from "../transaction-plan/types";
import { SimulationProvider, useSimulation } from "./context";

jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../chainConfig", () => ({
    chainsById: new Map([["1", {id: "1", rpcUrl: "https://simulate.example"}]]),
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
    decoderAbi: [],
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

function rpcResult(method: string) {
    if (method === "eth_chainId") return "0x1";
    if (method === "eth_blockNumber") return "0x64";
    return [{number: "0x65", calls: [{status: "0x1", returnData: "0x", gasUsed: "0x5208", logs: []}]}];
}

let currentSimulation: ReturnType<typeof useSimulation>;
function Probe() {
    currentSimulation = useSimulation();
    return <span>{currentSimulation.status}</span>;
}

function Wrapper({children}: {children: ReactNode}) {
    return <SimulationProvider>{children}</SimulationProvider>;
}

async function runDebounce() {
    await act(async () => {
        jest.advanceTimersByTime(350);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("SimulationProvider", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
            const body = JSON.parse(String(init?.body)) as {id: number; method: string};
            return {ok: true, json: async () => ({jsonrpc: "2.0", id: body.id, result: rpcResult(body.method)})} as Response;
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("automatically pins a base block and remains ready across wallet disconnects", async () => {
        mockPlan();
        const view = render(<Probe />, {wrapper: Wrapper});
        expect(screen.getByText("waiting")).toBeInTheDocument();

        await runDebounce();
        expect(screen.getByText("ready")).toBeInTheDocument();
        expect(currentSimulation.snapshot?.baseBlockNumber).toBe("0x64");
        expect(currentSimulation.canSimulateChain("1")).toBe(true);

        mockedTransactionPlan.mockReturnValue({
            ...mockedTransactionPlan(),
            sessionStatus: "disconnected",
            canEdit: false,
        });
        view.rerender(<Probe />);
        expect(screen.getByText("ready")).toBeInTheDocument();
        expect(currentSimulation.canSimulateChain("1")).toBe(true);
    });

    it("retains the last snapshot as stale when execution starts", async () => {
        mockPlan();
        const view = render(<Probe />, {wrapper: Wrapper});
        await runDebounce();

        mockPlan("ready", {status: "submitting"});
        view.rerender(<Probe />);
        expect(screen.getByText("stale")).toBeInTheDocument();
        expect(currentSimulation.active).toBe(false);
        expect(currentSimulation.snapshot).not.toBeNull();
    });

    it("moves endpoint failures into retryable error state", async () => {
        jest.mocked(global.fetch).mockResolvedValueOnce({ok: false, status: 503} as Response);
        mockPlan();
        render(<Probe />, {wrapper: Wrapper});

        await runDebounce();
        expect(screen.getByText("error")).toBeInTheDocument();
        expect(currentSimulation.error?.code).toBe("SIMULATION_RPC_UNAVAILABLE");
        expect(currentSimulation.active).toBe(true);
    });
});
