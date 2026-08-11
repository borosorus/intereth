import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useSimulation } from "../../simulation/context";
import { PlanSimulationSnapshot } from "../../simulation/types";
import { useTransactionPlan } from "../../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../../transaction-plan/reducer";
import SimulationInspector from "./SimulationInspector";

jest.mock("../../simulation/context", () => ({useSimulation: jest.fn()}));
jest.mock("../../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));

const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;
const mockedPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const account = "0x0000000000000000000000000000000000000001";
const target = "0x0000000000000000000000000000000000000010";
const token = "0x0000000000000000000000000000000000000020";

function planState() {
    const call = (id: string, signature: string) => ({
        id, chainId: "1", from: account, to: target, data: "0x1234", value: "0", decoderAbi: [],
        display: {kind: "abi" as const, contractAddress: target, functionSignature: signature},
        editor: {kind: "abi" as const, functionFragment: "function run()", arguments: []}, createdAt: 1,
    });
    let state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: call("call-1", "mint()")});
    state = transactionPlanReducer(state, {type: "ADD_CALL", call: call("call-2", "withdraw()")});
    return state;
}

function snapshot(): PlanSimulationSnapshot {
    const rawLog = {address: token, data: "0x", topics: [], raw: {log: "raw"}};
    return {
        revision: "queue", chainId: "1", account, baseBlockNumber: "0x64", raw: {block: "raw"},
        calls: [
            {
                callId: "call-1", status: "0x1", gasUsed: "0x5208", returnData: "0x01", raw: {call: 1}, logs: [rawLog],
                decodedReturn: [{name: "minted", type: "uint256", value: "5"}],
                decodedEvents: [{address: token, name: "Transfer", signature: "Transfer(address,address,uint256)", kind: "erc20-transfer", raw: rawLog, arguments: [
                    {name: "from", type: "address", value: target}, {name: "to", type: "address", value: account}, {name: "value", type: "uint256", value: "5"},
                ]}],
            },
            {
                callId: "call-2", status: "0x0", gasUsed: "0x100", returnData: "0xdead", raw: {call: 2}, logs: [], decodedEvents: [],
                decodedRevert: {name: "Unauthorized", signature: "Unauthorized(address)", message: "Unauthorized(address)", kind: "custom", data: "0xdead", arguments: [
                    {name: "caller", type: "address", value: account},
                ]},
            },
        ],
        balanceChanges: [
            {asset: "erc20", tokenAddress: token, account, delta: "5"},
            {asset: "erc20", tokenAddress: token, account: target, delta: "-5"},
        ],
    };
}

describe("SimulationInspector", () => {
    beforeEach(() => {
        mockedPlan.mockReturnValue({state: planState(), dispatch: jest.fn(), sessionStatus: "ready", canEdit: true});
        mockedSimulation.mockReturnValue({
            active: true, watchActive: true, status: "ready", chainId: "1", error: null, snapshot: snapshot(), revision: "queue", queuedCallCount: 2,
            configured: true, watchEvaluations: {}, retry: jest.fn(), canSimulateChain: jest.fn().mockReturnValue(true), simulateRead: jest.fn(),
        });
    });

    it("shows decoded call details, failures, events, and queue-wide deltas", () => {
        render(<SimulationInspector />);
        expect(screen.getByText(/Speculative only · base block 100/)).toBeInTheDocument();
        expect(screen.getByRole("button", {name: /1\. mint\(\)/})).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: /1\. mint\(\)/}));
        expect(screen.getByText("minted · uint256")).toBeInTheDocument();
        expect(screen.getByText("Transfer")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: /2\. withdraw\(\)/}));
        expect(screen.getByText("Unauthorized")).toBeInTheDocument();
        expect(screen.getByText("Queue-wide balance changes")).toBeInTheDocument();
        expect(screen.getByText("+5 raw units")).toBeInTheDocument();
        expect(screen.getByText("-5 raw units")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Advanced raw simulation response"})).toBeInTheDocument();
    });

    it("labels retained results as stale", () => {
        mockedSimulation.mockReturnValue({...mockedSimulation(), status: "stale"});
        render(<SimulationInspector />);
        expect(screen.getByText(/last successful snapshot/)).toBeInTheDocument();
    });
});
