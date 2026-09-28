import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Mock } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import { prepareAbiCall, prepareRawCall } from "../../calls/prepareCall";
import { useTransactionPlan } from "../../transaction-plan/context";
import { createEmptyTransactionPlanState, transactionPlanReducer } from "../../transaction-plan/reducer";
import { useTransactionPlanUi } from "../../transaction-plan/uiContext";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import { useSimulation } from "../../simulation/context";
import ExecutionWorkspace from "./ExecutionWorkspace";
import { TRANSFER_TOPIC } from "../../simulation/balanceChanges";

vi.mock("../../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));
vi.mock("../../transaction-plan/uiContext", () => ({useTransactionPlanUi: vi.fn()}));
vi.mock("../../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));
vi.mock("../../simulation/context", () => ({useSimulation: vi.fn()}));

const mockedTransactionPlan = vi.mocked(useTransactionPlan);
const mockedPlanUi = vi.mocked(useTransactionPlanUi);
const mockedWalletSession = vi.mocked(useWalletSession);
const mockedSimulation = vi.mocked(useSimulation);
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";

function queuedState() {
    const fragment = new ethers.Interface(["function pause()"]).getFunction("pause")!;
    const abiCall = prepareAbiCall({
        fragment,
        target: TARGET,
        account: ACCOUNT,
        chainId: "1",
        argumentValues: [],
        id: "abi-call",
        createdAt: 1,
    });
    const rawCall = prepareRawCall({
        target: TARGET,
        account: ACCOUNT,
        chainId: "1",
        data: "0x1234",
        valueAmount: "0",
        valueUnit: "wei",
        id: "raw-call",
        createdAt: 2,
    });
    let state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_CALL", call: abiCall});
    state = transactionPlanReducer(state, {type: "ADD_CALL", call: rawCall});
    return state;
}

function mockWallet(chainId = "1") {
    mockedWalletSession.mockReturnValue({
        status: "ready",
        provider: null,
        signer: null,
        account: ACCOUNT,
        chainId,
        error: null,
        clearError: vi.fn(),
        connectWallet: vi.fn(),
        switchChain: vi.fn(),
    });
}

function mockRpcWallet(send: Mock, chainId = "1") {
    mockWallet(chainId);
    mockedWalletSession.mockReturnValue({
        ...mockedWalletSession(),
        provider: {send} as unknown as ethers.BrowserProvider,
    });
}

function stateWithExecution(execution: ReturnType<typeof queuedState>["execution"]) {
    return {...queuedState(), execution};
}

function mockFreshSimulation(statuses: Array<"0x0" | "0x1"> = ["0x1", "0x1"]) {
    mockedSimulation.mockReturnValue({
        ...mockedSimulation(),
        active: true,
        status: "ready",
        chainId: "1",
        configured: true,
        revision: "current-review",
        snapshot: {
            revision: "current-review", capturedAt: Date.now(), chainId: "1", account: ACCOUNT, baseBlockNumber: "0x64", raw: {}, balanceChanges: [],
            calls: ["abi-call", "raw-call"].map((callId, index) => ({
                callId, status: statuses[index], returnData: statuses[index] === "0x1" ? "0x" : "0xdead", gasUsed: "0x5208", logs: [], decodedEvents: [], raw: {},
                decodedRevert: statuses[index] === "0x0" ? {name: "Denied", message: "Denied()", arguments: [], data: "0xdead", kind: "custom" as const} : undefined,
            })),
        },
    });
}

describe("ExecutionWorkspace", () => {
    beforeEach(() => {
        mockedPlanUi.mockReturnValue({activeView: "execution", setActiveView: vi.fn(), requestExecution: vi.fn()});
        mockedSimulation.mockReturnValue({
            active: false,
            watchActive: false,
            status: "idle",
            chainId: null,
            error: null,
            snapshot: null,
            revision: "disabled",
            queuedCallCount: 0,
            configured: false,
            watchEvaluations: {},
            tokenMetadataByAddress: {},
            tokenMetadataResolving: false,
            retry: vi.fn(),
            canSimulateChain: vi.fn().mockReturnValue(false),
            simulateRead: vi.fn(),
        });
    });

    it("reviews, reorders, duplicates, and edits ABI and raw calls", async () => {
        const dispatch = vi.fn();
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch,
            sessionStatus: "ready",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);

        expect(screen.getByText(/pause\(\)/)).toBeInTheDocument();
        expect(screen.getByText(/Raw transaction/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Move call 2 up"}));
        expect(dispatch).toHaveBeenCalledWith({type: "MOVE_CALL", callId: "raw-call", direction: "up"});

        fireEvent.click(screen.getAllByRole("button", {name: /Duplicate/})[0]);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "DUPLICATE_CALL",
            afterCallId: "abi-call",
            call: expect.objectContaining({data: expect.any(String)}),
        }));

        fireEvent.click(screen.getAllByRole("button", {name: /Edit/})[0]);
        fireEvent.click(screen.getByRole("button", {name: "Save changes"}));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "UPDATE_CALL",
            call: expect.objectContaining({id: "abi-call", data: expect.stringMatching(/^0x/)}),
        }));

        fireEvent.click(screen.getAllByRole("button", {name: /Edit/})[1]);
        fireEvent.change(screen.getByRole("textbox", {name: "Hex calldata"}), {target: {value: "0xabcd"}});
        fireEvent.click(screen.getByRole("button", {name: "Save changes"}));
        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "UPDATE_CALL",
            call: expect.objectContaining({id: "raw-call", data: "0xabcd"}),
        })));

        fireEvent.click(screen.getAllByRole("button", {name: /Remove/})[0]);
        expect(dispatch).toHaveBeenCalledWith({type: "REMOVE_CALL", callId: "abi-call"});
    });

    it("makes a restored matching draft immediately editable and confirms clearing", () => {
        const dispatch = vi.fn();
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch,
            sessionStatus: "ready",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);
        expect(screen.getAllByRole("button", {name: /Edit/})[0]).toBeEnabled();

        fireEvent.click(screen.getByRole("button", {name: "Clear plan"}));
        const dialog = screen.getByRole("dialog", {name: "Clear execution plan?"});
        fireEvent.click(within(dialog).getByRole("button", {name: "Clear plan"}));
        expect(dispatch).toHaveBeenCalledWith({type: "CLEAR_PLAN"});
    });

    it("shows the speculative preview in the execution workspace", () => {
        mockedSimulation.mockReturnValue({
            ...mockedSimulation(),
            active: true,
            watchActive: true,
            status: "waiting",
            chainId: "1",
            configured: true,
        });
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: vi.fn(),
            sessionStatus: "ready",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);
        expect(screen.getByText("Speculative preview")).toBeInTheDocument();
        expect(screen.getByText("Preparing the plan preview…")).toBeInTheDocument();
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows current per-call status and prioritized balance effects", () => {
        const state = queuedState();
        const token = "0x0000000000000000000000000000000000000020";
        mockedSimulation.mockReturnValue({
            ...mockedSimulation(),
            active: true,
            status: "ready",
            chainId: "1",
            configured: true,
            revision: "current",
            tokenMetadataByAddress: {"1:0x0000000000000000000000000000000000000020": {
                chainId: "1", address: token, symbol: "TKN", decimals: 0, fetchedAtBlock: "0x64",
            }},
            snapshot: {
                revision: "current", capturedAt: 1, chainId: "1", account: ACCOUNT, baseBlockNumber: "0x64", raw: {}, balanceChanges: [],
                calls: [{
                    callId: "abi-call", status: "0x1", returnData: "0x", gasUsed: "0x5208", raw: {}, decodedRevert: undefined,
                    logs: [{address: token, topics: [TRANSFER_TOPIC, ethers.zeroPadValue(ACCOUNT, 32), ethers.zeroPadValue(TARGET, 32)], data: ethers.zeroPadValue(ethers.toBeHex(5), 32), raw: {}}],
                    decodedEvents: [{address: token, name: "Transfer", signature: "Transfer(address,address,uint256)", kind: "erc20-transfer", raw: {address: token, topics: [], data: "0x", raw: {}}, arguments: []}],
                }],
            },
        });
        mockWallet();
        mockedTransactionPlan.mockReturnValue({state, dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});

        render(<ExecutionWorkspace />);

        expect(screen.getByText("21,000 gas")).toBeInTheDocument();
        expect(screen.getByText("1 decoded event")).toBeInTheDocument();
        expect(screen.getByText("Plan sender · TKN")).toBeInTheDocument();
        expect(screen.getByText("-5 TKN")).toBeInTheDocument();
    });

    it("offers execution controls alongside the preview", () => {
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: vi.fn(),
            sessionStatus: "ready",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);

        expect(screen.queryByText(/Switch to Interact/)).not.toBeInTheDocument();
        expect(screen.getByText("Speculative preview")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Check wallet batching"})).toBeInTheDocument();
    });

    it("shows an empty plan state that returns to Explore", () => {
        const setActiveView = vi.fn();
        mockedPlanUi.mockReturnValue({activeView: "execution", setActiveView, requestExecution: vi.fn()});
        mockWallet();
        mockedTransactionPlan.mockReturnValue({
            state: createEmptyTransactionPlanState(),
            dispatch: vi.fn(),
            sessionStatus: "empty",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);
        fireEvent.click(screen.getByRole("button", {name: /Back to Explore/}));
        expect(setActiveView).toHaveBeenCalledWith("explore");
    });

    it("shows the watches-only plan state", () => {
        mockWallet();
        const state = transactionPlanReducer(createEmptyTransactionPlanState(), {type: "ADD_WATCH", watch: {
            id: "watch-1", chainId: "1", from: ACCOUNT, to: TARGET, data: "0xabcd", value: "0",
            display: {kind: "raw"}, decoder: {kind: "raw"}, createdAt: 1,
        }});
        mockedTransactionPlan.mockReturnValue({state, dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});

        render(<ExecutionWorkspace />);
        expect(screen.getByText(/pinned watches but no plan calls/)).toBeInTheDocument();
    });

    it("blocks editing and offers an explicit network switch on mismatch", async () => {
        const switchChain = vi.fn().mockResolvedValue(undefined);
        mockWallet("10");
        mockedWalletSession.mockReturnValue({...mockedWalletSession(), switchChain});
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: vi.fn(),
            sessionStatus: "chain_mismatch",
            canEdit: false,
        });

        render(<ExecutionWorkspace />);
        expect(screen.getByText(/plan belongs to chain 1/)).toBeInTheDocument();
        expect(screen.getAllByRole("button", {name: /Edit/})[0]).toBeDisabled();
        expect(screen.getByRole("button", {name: "Check wallet batching"})).toBeDisabled();
        fireEvent.click(screen.getByRole("button", {name: "Switch network"}));
        await waitFor(() => expect(switchChain).toHaveBeenCalledWith("1"));
    });

    it("disables status RPC controls when a submitted batch has a session mismatch", () => {
        const send = vi.fn();
        const dispatch = vi.fn();
        mockRpcWallet(send, "10");
        mockedTransactionPlan.mockReturnValue({
            state: stateWithExecution({status: "pending", batchId: "0x1234"}),
            dispatch,
            sessionStatus: "chain_mismatch",
            canEdit: false,
        });

        render(<ExecutionWorkspace />);
        expect(screen.getByRole("button", {name: "Refresh status"})).toBeDisabled();
        expect(screen.getByRole("button", {name: "View in wallet"})).toBeDisabled();
        expect(send).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", {name: "Forget tracking"}));
        const dialog = screen.getByRole("dialog", {name: "Forget batch tracking?"});
        expect(within(dialog).getByText(/does not cancel, reverse, or change anything/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", {name: "Forget tracking"}));
        expect(dispatch).toHaveBeenCalledWith({type: "FORGET_TRACKED_PLAN"});
    });

    it("shows the original account and a reconnect action on account mismatch", async () => {
        const connectWallet = vi.fn().mockResolvedValue(null);
        mockWallet();
        mockedWalletSession.mockReturnValue({
            ...mockedWalletSession(),
            account: "0x0000000000000000000000000000000000000002",
            connectWallet,
        });
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: vi.fn(),
            sessionStatus: "account_mismatch",
            canEdit: false,
        });

        render(<ExecutionWorkspace />);
        expect(screen.getByText(/plan belongs to 0x000000…000001/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Reconnect account"}));
        await waitFor(() => expect(connectWallet).toHaveBeenCalled());
    });

    it("checks atomic capability lazily and submits the queue with wallet_sendCalls", async () => {
        const dispatch = vi.fn();
        const send = vi.fn(async (method: string) => {
            if (method === "wallet_getCapabilities") {
                return {"0x1": {atomic: {status: "supported"}}};
            }
            if (method === "wallet_sendCalls") {
                return {id: "0x1234"};
            }
            throw new Error(`Unexpected method ${method}`);
        });
        mockRpcWallet(send);
        mockFreshSimulation();
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch,
            sessionStatus: "ready",
            canEdit: true,
        });

        const view = render(<ExecutionWorkspace active={false} />);
        expect(send).not.toHaveBeenCalled();
        view.rerender(<ExecutionWorkspace active />);
        expect(await screen.findByText(/supports atomic transaction batches/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Send atomic batch"}));
        const review = screen.getByRole("dialog", {name: "Review wallet submission"});
        expect(within(review).getByText(/Base block 100/)).toBeInTheDocument();
        expect(within(review).queryByRole("checkbox", {name: /does not have a fresh successful simulation/})).not.toBeInTheDocument();
        fireEvent.click(within(review).getByRole("button", {name: "Submit atomic batch"}));
        await waitFor(() => expect(send).toHaveBeenCalledWith("wallet_sendCalls", [expect.objectContaining({
            version: "2.0.0",
            chainId: "0x1",
            atomicRequired: true,
            calls: expect.arrayContaining([expect.objectContaining({to: ethers.getAddress(TARGET)})]),
        })]));
        expect(dispatch).toHaveBeenCalledWith({type: "START_BATCH_SUBMISSION"});
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: "BATCH_SUBMITTED", batchId: "0x1234"}));
    });

    it("warns before a wallet-managed smart-account upgrade", async () => {
        const send = vi.fn().mockResolvedValue({"0x1": {atomic: {status: "ready"}}});
        mockRpcWallet(send);
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: vi.fn(),
            sessionStatus: "ready",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);
        fireEvent.click(await screen.findByRole("button", {name: "Enable smart account and send"}));
        const review = screen.getByRole("dialog", {name: "Review wallet submission"});
        expect(within(review).getByRole("checkbox", {name: /persistent smart-account delegation/})).toBeInTheDocument();
        expect(within(review).getByRole("button", {name: "Enable and submit"})).toBeDisabled();
    });

    it("requires explicit risk acceptance without a fresh simulation", async () => {
        const send = vi.fn(async (method: string) => method === "wallet_getCapabilities"
            ? {"0x1": {atomic: {status: "supported"}}}
            : {id: "0x1234"});
        mockRpcWallet(send);
        mockedTransactionPlan.mockReturnValue({state: queuedState(), dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});

        render(<ExecutionWorkspace />);
        fireEvent.click(await screen.findByRole("button", {name: "Send atomic batch"}));
        const review = screen.getByRole("dialog", {name: "Review wallet submission"});
        const submit = within(review).getByRole("button", {name: "Submit atomic batch"});
        expect(submit).toBeDisabled();
        fireEvent.click(within(review).getByRole("checkbox", {name: /does not have a fresh successful simulation/}));
        expect(submit).toBeEnabled();
    });

    it("blocks submission when the current simulation contains a revert", async () => {
        const send = vi.fn().mockResolvedValue({"0x1": {atomic: {status: "supported"}}});
        mockRpcWallet(send);
        mockFreshSimulation(["0x1", "0x0"]);
        mockedTransactionPlan.mockReturnValue({state: queuedState(), dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});

        render(<ExecutionWorkspace />);
        fireEvent.click(await screen.findByRole("button", {name: "Send atomic batch"}));
        const review = screen.getByRole("dialog", {name: "Review wallet submission"});
        expect(within(review).getByText(/contains 1 reverting call/)).toBeInTheDocument();
        expect(within(review).getByRole("button", {name: "Submit atomic batch"})).toBeDisabled();
        expect(send).not.toHaveBeenCalledWith("wallet_sendCalls", expect.anything());
    });

    it("keeps manual sending as the fallback when wallet batching is unavailable", async () => {
        const send = vi.fn().mockRejectedValue({code: -32601, message: "method not found"});
        mockRpcWallet(send);
        mockedTransactionPlan.mockReturnValue({
            state: queuedState(),
            dispatch: vi.fn(),
            sessionStatus: "ready",
            canEdit: true,
        });

        render(<ExecutionWorkspace />);
        expect(await screen.findByText(/Atomic batching is unavailable/)).toBeInTheDocument();
        expect(screen.getByText(/Use Send now from individual function or raw-call forms/)).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: /send atomic batch/i})).not.toBeInTheDocument();
    });

    it("closes an open submission review when the workspace view changes", async () => {
        const send = vi.fn(async (method: string) => method === "wallet_getCapabilities"
            ? {"0x1": {atomic: {status: "supported"}}}
            : {id: "0x1234"});
        mockRpcWallet(send);
        mockedTransactionPlan.mockReturnValue({state: queuedState(), dispatch: vi.fn(), sessionStatus: "ready", canEdit: true});

        const view = render(<ExecutionWorkspace />);
        fireEvent.click(await screen.findByRole("button", {name: "Send atomic batch"}));
        expect(screen.getByRole("dialog", {name: "Review wallet submission"})).toBeInTheDocument();

        // Browser "back" while reviewing: the view changes underneath, and the
        // actionable submission dialog must not linger over Explore.
        mockedPlanUi.mockReturnValue({activeView: "explore", setActiveView: vi.fn(), requestExecution: vi.fn()});
        view.rerender(<ExecutionWorkspace active={false} />);
        expect(screen.queryByRole("dialog", {name: "Review wallet submission"})).not.toBeInTheDocument();
    });

    it("polls a restored pending batch while the Explore view is shown", async () => {
        vi.useFakeTimers();
        try {
            const dispatch = vi.fn();
            const send = vi.fn().mockResolvedValue({
                version: "2.0.0",
                id: "0x1234",
                chainId: "0x1",
                status: 200,
                atomic: true,
                receipts: [],
            });
            mockRpcWallet(send);
            mockedTransactionPlan.mockReturnValue({
                state: stateWithExecution({status: "pending", batchId: "0x1234", submittedAt: 10}),
                dispatch,
                sessionStatus: "ready",
                canEdit: false,
            });

            // The execution workspace stays mounted (hidden) while Explore is
            // shown, so status polling must continue without visiting it.
            render(<ExecutionWorkspace active={false} />);
            await act(async () => {
                vi.advanceTimersByTime(5000);
                await Promise.resolve();
            });
            expect(send).toHaveBeenCalledWith("wallet_getCallsStatus", ["0x1234"]);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
                type: "BATCH_STATUS_UPDATED",
                execution: expect.objectContaining({status: "confirmed", atomic: true}),
            }));
        } finally {
            vi.useRealTimers();
        }
    });

    it("requires confirmation before turning a failed batch back into a draft", () => {
        mockWallet();
        const dispatch = vi.fn();
        mockedTransactionPlan.mockReturnValue({
            state: stateWithExecution({status: "reverted", batchId: "0x1234", walletStatus: 500, atomic: true}),
            dispatch,
            sessionStatus: "ready",
            canEdit: false,
        });

        render(<ExecutionWorkspace />);
        fireEvent.click(screen.getByRole("button", {name: "Create retry draft"}));
        const dialog = screen.getByRole("dialog", {name: "Create a retry draft?"});
        fireEvent.click(within(dialog).getByRole("button", {name: "Create draft"}));
        expect(dispatch).toHaveBeenCalledWith({type: "RESET_FAILED_BATCH"});
    });
});
