import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactNode } from "react";
import { useTransactionPlan } from "../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../transaction-plan/reducer";
import { QueuedCall, WatchExpression } from "../transaction-plan/types";
import { SimulationProvider, useSimulation } from "./context";

jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../workspace/context", () => ({useWorkspaceMode: () => ({mode: "simulate", setMode: jest.fn()})}));
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
const watch: WatchExpression = {
    id: "watch-1",
    chainId: "1",
    from: ACCOUNT,
    to: TARGET,
    data: "0xabcd",
    value: "0",
    display: {kind: "raw"},
    decoder: {kind: "raw"},
    createdAt: 2,
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

function mockWatchedPlan() {
    const state = transactionPlanReducer(planState(), {type: "ADD_WATCH", watch});
    mockedTransactionPlan.mockReturnValue({state, dispatch: jest.fn(), sessionStatus: "ready", canEdit: true});
}

function mockWatchOnlyPlan() {
    const state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_WATCH", watch});
    mockedTransactionPlan.mockReturnValue({state, dispatch: jest.fn(), sessionStatus: "ready", canEdit: true});
}

function rpcResult(method: string, params: unknown[]) {
    if (method === "eth_chainId") return "0x1";
    if (method === "eth_blockNumber") return "0x64";
    if (method === "eth_call") return "0x002a";
    const request = params[0] as {blockStateCalls: Array<{calls: unknown[]}>};
    return [{number: "0x65", calls: request.blockStateCalls[0].calls.map((_, index, calls) => ({
        status: "0x1",
        returnData: index === calls.length - 1 && calls.length > 1 ? "0x002b" : "0x",
        gasUsed: "0x5208",
        logs: [],
    }))}];
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
            const body = JSON.parse(String(init?.body)) as {id: number; method: string; params: unknown[]};
            return {ok: true, json: async () => ({jsonrpc: "2.0", id: body.id, result: rpcResult(body.method, body.params)})} as Response;
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

    it("evaluates watches and the queue with one simulation request at the exact base block", async () => {
        mockWatchedPlan();
        render(<Probe />, {wrapper: Wrapper});

        await runDebounce();
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(currentSimulation.watchEvaluations[watch.id]).toMatchObject({
            status: "ready",
            baseBlockNumber: "0x64",
            base: {returnData: "0x002a"},
            simulated: {returnData: "0x002b"},
        });
        const requests = jest.mocked(global.fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {method: string; params: unknown[]});
        expect(requests.find((request) => request.method === "eth_call")?.params[1]).toBe("0x64");
        expect(requests.filter((request) => request.method === "eth_simulateV1")).toHaveLength(1);
    });

    it("keeps the queue result and blocks watches when a queued call reverts", async () => {
        jest.mocked(global.fetch).mockImplementation(async (_input, init) => {
            const body = JSON.parse(String(init?.body)) as {id: number; method: string; params: unknown[]};
            const result = body.method === "eth_simulateV1"
                ? [{number: "0x65", calls: [
                    {status: "0x0", returnData: "0xdead", gasUsed: "0x5208", logs: []},
                    {status: "0x1", returnData: "0x002b", gasUsed: "0x5208", logs: []},
                ]}]
                : rpcResult(body.method, body.params);
            return {ok: true, json: async () => ({jsonrpc: "2.0", id: body.id, result})} as Response;
        });
        mockWatchedPlan();
        render(<Probe />, {wrapper: Wrapper});

        await runDebounce();
        expect(currentSimulation.snapshot?.calls[0].status).toBe("0x0");
        expect(currentSimulation.watchEvaluations[watch.id]).toMatchObject({status: "blocked", base: {returnData: "0x002a"}});
        const requests = jest.mocked(global.fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {method: string});
        expect(requests.filter((request) => request.method === "eth_simulateV1")).toHaveLength(1);
    });

    it("evaluates a pinned watch without requiring queued writes", async () => {
        mockWatchOnlyPlan();
        render(<Probe />, {wrapper: Wrapper});

        await act(async () => {
            jest.advanceTimersByTime(0);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(currentSimulation.watchEvaluations[watch.id]).toMatchObject({
            status: "ready",
            baseBlockNumber: "0x64",
            base: {returnData: "0x002a"},
        });
        expect(currentSimulation.watchEvaluations[watch.id].simulated).toBeUndefined();
        const requests = jest.mocked(global.fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {method: string});
        expect(requests.some((request) => request.method === "eth_call")).toBe(true);
        expect(requests.some((request) => request.method === "eth_simulateV1")).toBe(false);
    });
});
