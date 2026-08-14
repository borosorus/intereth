import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import ContractFunctionBrowser, { matchesFunction } from "./ContractFunctionBrowser";

const fragments = new ethers.Interface([
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender,uint256 amount)",
    "function deposit() payable",
]).fragments.filter((fragment): fragment is ethers.FunctionFragment => fragment.type === "function");

describe("ContractFunctionBrowser", () => {
    it("matches names, signatures, argument names, and types", () => {
        expect(matchesFunction(fragments[0], "balance")).toBe(true);
        expect(matchesFunction(fragments[1], "spender")).toBe(true);
        expect(matchesFunction(fragments[1], "uint256")).toBe(true);
        expect(matchesFunction(fragments[2], "owner")).toBe(false);
    });

    it("searches, filters, and resets the visible functions", () => {
        render(<ContractFunctionBrowser contractId="test" functions={fragments} renderFunction={(fragment) => <div key={fragment.name}>{fragment.name}</div>} readDescription="Reads" writeDescription="Writes" />);
        fireEvent.change(screen.getByLabelText("Search functions"), {target: {value: "owner"}});
        expect(screen.getByText("balanceOf")).toBeInTheDocument();
        expect(screen.queryByText("approve")).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Search functions"), {target: {value: "missing"}});
        expect(screen.getByText("No matching functions")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Reset search"}));
        fireEvent.click(screen.getByRole("button", {name: "Payable 1"}));
        expect(screen.getByText("deposit")).toBeInTheDocument();
        expect(screen.queryByText("approve")).not.toBeInTheDocument();
    });
});
