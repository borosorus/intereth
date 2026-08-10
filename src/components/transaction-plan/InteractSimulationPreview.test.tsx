import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { prepareRawCall } from "../../calls/prepareCall";
import { useSimulation } from "../../simulation/context";
import { PlanSimulationSnapshot } from "../../simulation/types";
import { useTransactionPlan } from "../../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../../transaction-plan/reducer";
import InteractSimulationPreview from "./InteractSimulationPreview";

jest.mock("../../simulation/context", () => ({useSimulation: jest.fn()}));
jest.mock("../../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));

const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;
const mockedPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const OTHER = "0x0000000000000000000000000000000000000002";
const TARGET = "0x0000000000000000000000000000000000000010";
const TOKEN = "0x0000000000000000000000000000000000000020";

function planState() {
    const first = prepareRawCall({target: TARGET, account: ACCOUNT, chainId: "1", data: "0x1234", valueAmount: "0", valueUnit: "wei", id: "first", createdAt: 1});
    const second = prepareRawCall({target: TARGET, account: ACCOUNT, chainId: "1", data: "0xabcd", valueAmount: "0", valueUnit: "wei", id: "second", createdAt: 2});
    let state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: first});
    state = transactionPlanReducer(state, {type: "ADD_CALL", call: second});
    return state;
}

function snapshot(): PlanSimulationSnapshot {
    const rawLog = {address: TOKEN, data: "0x", topics: [], raw: {}};
    return {
        revision: "queue",
        chainId: "1",
        account: ACCOUNT,
        baseBlockNumber: "0x64",
        simulatedBlockNumber: "0x65",
        calls: [
            {
                callId: "first",
                status: "0x1",
                returnData: "0x",
                gasUsed: "0x5208",
                logs: [rawLog],
                raw: {},
                decodedEvents: [{
                    address: TOKEN,
                    name: "Transfer",
                    signature: "Transfer(address,address,uint256)",
                    arguments: [{name: "value", type: "uint256", value: "7"}],
                    kind: "erc20-transfer",
                    raw: rawLog,
                }],
            },
            {
                callId: "second",
                status: "0x0",
                returnData: "0xdead",
                gasUsed: "0x100",
                logs: [],
                raw: {},
                decodedEvents: [],
                decodedRevert: {name: "Denied", message: "Denied(address)", arguments: [], data: "0xdead", kind: "custom"},
            },
        ],
        balanceChanges: [
            {asset: "erc20", tokenAddress: TOKEN, account: ACCOUNT, delta: "-7"},
            {asset: "erc20", tokenAddress: TOKEN, account: OTHER, delta: "99"},
        ],
        raw: {},
    };
}

function mockReady() {
    mockedPlan.mockReturnValue({state: planState(), dispatch: jest.fn(), sessionStatus: "ready", canEdit: true});
    mockedSimulation.mockReturnValue({
        active: true,
        status: "ready",
        chainId: "1",
        error: null,
        snapshot: snapshot(),
        revision: "queue",
        queuedCallCount: 2,
        configured: true,
        watchEvaluations: {},
        retry: jest.fn(),
        canSimulateChain: jest.fn().mockReturnValue(true),
        simulateRead: jest.fn(),
    });
}

describe("InteractSimulationPreview", () => {
    it("stays compact until opened and summarizes calls, events, reverts, and account deltas", () => {
        mockReady();
        render(<InteractSimulationPreview />);

        const summary = screen.getByRole("button", {name: /Speculative preview/});
        expect(summary).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("Base block 100")).toBeInTheDocument();

        fireEvent.click(summary);
        expect(screen.getByText("21,000 gas used")).toBeInTheDocument();
        expect(screen.getByText("Transfer")).toBeInTheDocument();
        expect(screen.getByText(/Denied:/)).toBeInTheDocument();
        expect(screen.getByText("-7 raw units")).toBeInTheDocument();
        expect(screen.queryByText("+99 raw units")).not.toBeInTheDocument();
        expect(screen.getByText(/Speculative results only/)).toBeInTheDocument();
    });

    it("marks retained results stale", () => {
        mockReady();
        mockedSimulation.mockReturnValue({...mockedSimulation(), status: "stale"});
        render(<InteractSimulationPreview />);

        fireEvent.click(screen.getByRole("button", {name: /Speculative preview/}));
        expect(screen.getByText("This preview is stale and does not match the current queue.")).toBeInTheDocument();
    });
});
