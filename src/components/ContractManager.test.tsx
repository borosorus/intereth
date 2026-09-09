import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useWalletSession } from "../wallet/WalletSessionContext";
import ContractManager from "./ContractManager";
import {AbiLookupError, fetchVerifiedAbi} from "../abiLookup";

jest.mock("../onboard", () => {
    const chains = [{id: "1", label: "Test chain", rpcUrl: ""}];
    return {chains, chainsById: new Map(chains.map((chain) => [chain.id, chain]))};
});
jest.mock("../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));
jest.mock("../abiLookup", () => ({
    ...jest.requireActual("../abiLookup"),
    fetchVerifiedAbi: jest.fn(),
}));

const mockedWalletSession = useWalletSession as jest.MockedFunction<typeof useWalletSession>;
const mockedFetchVerifiedAbi = fetchVerifiedAbi as jest.MockedFunction<typeof fetchVerifiedAbi>;
const FIRST_ADDRESS = "0x0000000000000000000000000000000000000001";
const SECOND_ADDRESS = "0x0000000000000000000000000000000000000002";

function walletSession(overrides = {}) {
    return {
        status: "disconnected" as const,
        provider: null,
        signer: null,
        account: null,
        chainId: null,
        error: null,
        clearError: jest.fn(),
        connectWallet: jest.fn(),
        switchChain: jest.fn(),
        ...overrides,
    };
}

function renderManager(overrides = {}) {
    mockedWalletSession.mockReturnValue(walletSession(overrides));
    render(<ContractManager addContract={jest.fn()} showExamples={false} />);
}

describe("ContractManager", () => {
    afterEach(() => {
        jest.useRealTimers();
        mockedFetchVerifiedAbi.mockReset();
    });

    it("keeps the interface editor at a fixed, internally scrollable size", () => {
        renderManager();

        const editor = screen.getByLabelText("JSON ABI");
        expect(editor).toHaveAttribute("rows", "6");
        expect(window.getComputedStyle(editor).overflowY).toBe("auto");
        expect(window.getComputedStyle(editor).resize).toBe("none");

        fireEvent.change(editor, {target: {value: JSON.stringify(Array(20).fill("function value() view returns (uint256)"))}});
        expect(editor).toHaveAttribute("rows", "6");
    });

    it("switches placeholders without populating the editor", () => {
        renderManager();

        const jsonEditor = screen.getByLabelText("JSON ABI");
        expect(jsonEditor).toHaveValue("");
        expect(jsonEditor).toHaveAttribute("placeholder", expect.stringContaining('"type":"function"'));

        fireEvent.mouseDown(screen.getByLabelText("Interface format"));
        fireEvent.click(screen.getByRole("option", {name: "Solidity interface"}));

        const solidityEditor = screen.getByLabelText("Solidity interface");
        expect(solidityEditor).toHaveValue("");
        expect(solidityEditor).toHaveAttribute("placeholder", expect.stringContaining("function withdraw(address recipient, uint256 amount) external"));
    });

    it("puts network selection first and identifies predefined chains", () => {
        mockedWalletSession.mockReturnValue(walletSession());
        render(<ContractManager addContract={jest.fn()} showExamples={false} />);

        const networkHeading = screen.getByText("Network & access");
        const contractHeading = screen.getByText("Contract");
        expect(networkHeading.compareDocumentPosition(contractHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText("Test chain (Chain 1)")).toBeInTheDocument();
    });

    it("shows the browser wallet chain ID", () => {
        mockedWalletSession.mockReturnValue(walletSession({status: "ready", signer: {}, chainId: "1"}));
        render(<ContractManager addContract={jest.fn()} showExamples={false} />);

        fireEvent.click(screen.getByRole("checkbox", {name: "Use browser wallet"}));
        expect(screen.getByText("Chain ID 1")).toBeInTheDocument();
        expect(screen.getByText("Test chain")).toBeInTheDocument();
    });

    it("fetches a verified ABI in automatic mode and promotes it when disabled", async () => {
        jest.useFakeTimers();
        const fetched = [{type: "function", name: "owner", inputs: [], outputs: [{type: "address"}], stateMutability: "view"}];
        mockedFetchVerifiedAbi.mockResolvedValue({abi: fetched, source: "Sourcify"});
        mockedWalletSession.mockReturnValue(walletSession({status: "ready", signer: {}, chainId: "1"}));
        render(<ContractManager addContract={jest.fn()} showExamples={false} />);

        fireEvent.click(screen.getByRole("checkbox", {name: "Use browser wallet"}));
        fireEvent.change(screen.getByLabelText("Contract address"), {target: {value: FIRST_ADDRESS}});
        fireEvent.click(screen.getByRole("checkbox", {name: "Fetch ABI automatically"}));

        const editor = screen.getByLabelText("JSON ABI");
        expect(editor).toBeDisabled();
        expect(screen.getByLabelText("Preset")).toHaveAttribute("aria-disabled", "true");
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });

        expect(mockedFetchVerifiedAbi).toHaveBeenCalledWith(expect.objectContaining({chainId: "1"}));
        expect(editor).toHaveValue(JSON.stringify(fetched, null, 2));
        expect(screen.getByText("Fetched verified ABI from Sourcify.")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", {name: "Fetch ABI automatically"}));
        expect(editor).not.toBeDisabled();
        expect(editor).toHaveValue(JSON.stringify(fetched, null, 2));
    });

    it("ignores a late ABI response after the address changes", async () => {
        jest.useFakeTimers();
        let resolveFirst!: (value: Awaited<ReturnType<typeof fetchVerifiedAbi>>) => void;
        let resolveSecond!: (value: Awaited<ReturnType<typeof fetchVerifiedAbi>>) => void;
        mockedFetchVerifiedAbi
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
        mockedWalletSession.mockReturnValue(walletSession({status: "ready", signer: {}, chainId: "1"}));
        render(<ContractManager addContract={jest.fn()} showExamples={false} />);

        fireEvent.click(screen.getByRole("checkbox", {name: "Use browser wallet"}));
        fireEvent.change(screen.getByLabelText("Contract address"), {target: {value: FIRST_ADDRESS}});
        fireEvent.click(screen.getByRole("checkbox", {name: "Fetch ABI automatically"}));
        act(() => jest.advanceTimersByTime(500));

        fireEvent.change(screen.getByLabelText("Contract address"), {target: {value: SECOND_ADDRESS}});
        act(() => jest.advanceTimersByTime(500));
        const oldAbi = [{type: "function", name: "old", inputs: [], outputs: []}];
        const newAbi = [{type: "function", name: "current", inputs: [], outputs: []}];
        await act(async () => {
            resolveFirst({abi: oldAbi, source: "Sourcify"});
            await Promise.resolve();
        });
        expect(screen.getByLabelText("JSON ABI")).not.toHaveValue(JSON.stringify(oldAbi, null, 2));

        await act(async () => {
            resolveSecond({abi: newAbi, source: "Blockscout"});
            await Promise.resolve();
        });
        expect(screen.getByLabelText("JSON ABI")).toHaveValue(JSON.stringify(newAbi, null, 2));
        expect(screen.getByText("Fetched verified ABI from Blockscout.")).toBeInTheDocument();
    });

    it("preserves the manual ABI when automatic lookup finds no match", async () => {
        jest.useFakeTimers();
        mockedFetchVerifiedAbi.mockRejectedValue(new AbiLookupError("not-found"));
        mockedWalletSession.mockReturnValue(walletSession({status: "ready", signer: {}, chainId: "1"}));
        render(<ContractManager addContract={jest.fn()} showExamples={false} />);

        const manualAbi = JSON.stringify(["function name() view returns (string)"]);
        fireEvent.click(screen.getByRole("checkbox", {name: "Use browser wallet"}));
        fireEvent.change(screen.getByLabelText("Contract address"), {target: {value: FIRST_ADDRESS}});
        fireEvent.change(screen.getByLabelText("JSON ABI"), {target: {value: manualAbi}});
        fireEvent.click(screen.getByRole("checkbox", {name: "Fetch ABI automatically"}));
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });

        expect(screen.getByText("No verified ABI was found for this address on chain 1.")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Add instance"})).toBeDisabled();
        fireEvent.click(screen.getByRole("checkbox", {name: "Fetch ABI automatically"}));
        expect(screen.getByLabelText("JSON ABI")).toHaveValue(manualAbi);
    });
});
