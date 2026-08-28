import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useWalletSession } from "../wallet/WalletSessionContext";
import ContractManager from "./ContractManager";

jest.mock("../onboard", () => ({chains: [{id: "1", label: "Test chain", rpcUrl: ""}]}));
jest.mock("../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));

const mockedWalletSession = useWalletSession as jest.MockedFunction<typeof useWalletSession>;

function renderManager() {
    mockedWalletSession.mockReturnValue({
        status: "disconnected",
        provider: null,
        signer: null,
        account: null,
        chainId: null,
        error: null,
        clearError: jest.fn(),
        connectWallet: jest.fn(),
        switchChain: jest.fn(),
    });
    render(<ContractManager addContract={jest.fn()} showExamples={false} />);
}

describe("ContractManager", () => {
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
});
