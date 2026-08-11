import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useSimulation } from "../../simulation/context";
import { useTransactionPlan } from "../../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../../transaction-plan/reducer";
import { useWorkspaceMode } from "../../workspace/context";
import WatchPanel from "./WatchPanel";

jest.mock("../../simulation/context", () => ({useSimulation: jest.fn()}));
jest.mock("../../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../../workspace/context", () => ({useWorkspaceMode: jest.fn()}));

const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;
const mockedPlan = useTransactionPlan as jest.MockedFunction<typeof useTransactionPlan>;
const mockedWorkspace = useWorkspaceMode as jest.MockedFunction<typeof useWorkspaceMode>;

const account = "0x0000000000000000000000000000000000000001";
const target = "0x0000000000000000000000000000000000000010";

function watchedState() {
    const draft = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: {
        id: "call-1", chainId: "1", from: account, to: target, data: "0x1234", value: "0", decoderAbi: [],
        display: {kind: "raw", contractAddress: target}, editor: {kind: "raw"}, createdAt: 1,
    }});
    return transactionPlanReducer(draft, {type: "ADD_WATCH", watch: {
        id: "watch-1", chainId: "1", from: account, to: target, data: "0xabcd", value: "0",
        display: {kind: "abi", functionSignature: "balanceOf(address)"},
        decoder: {kind: "abi", functionFragment: "function balanceOf(address) view returns (uint256)"}, createdAt: 2,
    }});
}

describe("WatchPanel", () => {
    it("compares base and speculative values and exposes refresh and removal", () => {
        const dispatch = jest.fn();
        const retry = jest.fn();
        mockedWorkspace.mockReturnValue({mode: "simulate", setMode: jest.fn()});
        mockedPlan.mockReturnValue({state: watchedState(), dispatch, sessionStatus: "ready", canEdit: true});
        mockedSimulation.mockReturnValue({
            active: true, watchActive: true, status: "ready", chainId: "1", error: null, revision: "queue", queuedCallCount: 1,
            configured: true, retry, canSimulateChain: jest.fn().mockReturnValue(true), simulateRead: jest.fn(),
            snapshot: {revision: "queue", chainId: "1", account, baseBlockNumber: "0x64", calls: [], balanceChanges: [], raw: {}},
            watchEvaluations: {"watch-1": {
                watchId: "watch-1", revision: "queue|watch", baseBlockNumber: "0x64", status: "ready",
                base: {returnData: "0x", values: [{name: "Output 1", type: "uint256", value: "10"}]},
                simulated: {returnData: "0x", values: [{name: "Output 1", type: "uint256", value: "42"}]},
            }},
            tokenMetadataByAddress: {}, tokenMetadataResolving: false,
        });

        render(<WatchPanel />);
        expect(screen.getByText("On-chain at base block")).toBeInTheDocument();
        expect(screen.getByText("Speculative after queue")).toBeInTheDocument();
        expect(screen.getByText("10")).toBeInTheDocument();
        expect(screen.getByText("42")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Refresh"}));
        fireEvent.click(screen.getByRole("button", {name: "Remove watch balanceOf(address)"}));
        expect(retry).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({type: "REMOVE_WATCH", watchId: "watch-1"});
    });

    it("is absent from Interact mode", () => {
        mockedWorkspace.mockReturnValue({mode: "interact", setMode: jest.fn()});
        mockedPlan.mockReturnValue({state: createEmptyTransactionPlanState(), dispatch: jest.fn(), sessionStatus: "empty", canEdit: false});
        mockedSimulation.mockReturnValue({} as ReturnType<typeof useSimulation>);
        const {container} = render(<WatchPanel />);
        expect(container).toBeEmptyDOMElement();
    });
});
