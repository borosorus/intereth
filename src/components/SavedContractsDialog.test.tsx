import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import { SavedContract } from "../contracts/savedContracts";
import SavedContractsDialog from "./SavedContractsDialog";

const entry: SavedContract = {
    version: 3,
    label: "Saved token",
    address: "0x0000000000000000000000000000000000000010",
    chainId: "1",
    abi: new ethers.Interface(["function balanceOf(address account) view returns (uint256)"]).formatJson(),
    savedAt: 1,
};

describe("SavedContractsDialog", () => {
    it("uses and removes saved contracts", () => {
        const onUse = vi.fn();
        const onRemove = vi.fn();
        render(
            <SavedContractsDialog
                open
                contracts={[entry]}
                onClose={vi.fn()}
                onUse={onUse}
                onRemove={onRemove}
            />,
        );

        expect(screen.getByText("Saved token")).toBeInTheDocument();
        expect(screen.getByText(entry.address)).toBeInTheDocument();
        expect(screen.getByText("Chain 1")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Use saved contract 0x000000…000010 on chain 1"}));
        expect(onUse).toHaveBeenCalledWith(entry);
        fireEvent.click(screen.getByRole("button", {name: "Remove saved contract 0x000000…000010 on chain 1"}));
        expect(onRemove).toHaveBeenCalledWith(entry);
    });

    it("explains that saved contracts only keep identity and interface data", () => {
        render(
            <SavedContractsDialog
                open
                contracts={[]}
                onClose={vi.fn()}
                onUse={vi.fn()}
                onRemove={vi.fn()}
            />,
        );
        expect(screen.getByText(/keep only the label, address, ABI, and chain ID/)).toBeInTheDocument();
        expect(screen.getByText(/No saved contracts yet/)).toBeInTheDocument();
    });
});
