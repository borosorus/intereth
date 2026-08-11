import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import ContractFunctionSection, { FunctionMutabilityBadge, isReadFunction } from "./ContractFunctionSection";

const iface = new ethers.Interface([
    "function viewed() view returns (uint256)",
    "function calculated() pure returns (uint256)",
    "function update()",
    "function deposit() payable",
]);

describe("contract function presentation", () => {
    it("classifies and labels every Solidity mutability", () => {
        const fragments = ["viewed", "calculated", "update", "deposit"].map((name) => iface.getFunction(name)!);
        expect(fragments.map(isReadFunction)).toEqual([true, true, false, false]);

        render(<>{fragments.map((fragment) => <FunctionMutabilityBadge key={fragment.name} fragment={fragment} />)}</>);
        expect(screen.getByText("View")).toBeInTheDocument();
        expect(screen.getByText("Pure")).toBeInTheDocument();
        expect(screen.getByText("Write")).toBeInTheDocument();
        expect(screen.getByText("Payable")).toBeInTheDocument();
    });

    it("keeps an unavailable function group collapsed until requested", () => {
        const update = iface.getFunction("update")!;
        render(
            <ContractFunctionSection
                title="Write functions · wallet required"
                description="Add this contract using Browser Wallet to call these functions."
                functions={[update]}
                collapsible
                defaultExpanded={false}
                renderFunction={(fragment) => <span key={fragment.name}>{fragment.name}</span>}
            />,
        );

        const toggle = screen.getByRole("button", {name: /Write functions · wallet required/});
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("update")).not.toBeInTheDocument();
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("update")).toBeInTheDocument();
    });
});
