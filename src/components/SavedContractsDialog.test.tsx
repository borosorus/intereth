import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import { SavedContract } from "../contracts/savedContracts";
import SavedContractsDialog from "./SavedContractsDialog";

const entry: SavedContract = {
    version: 1,
    id: "saved-1",
    label: "Saved token",
    address: "0x0000000000000000000000000000000000000010",
    chainId: "1",
    abi: new ethers.Interface(["function balanceOf(address account) view returns (uint256)"]).formatJson(),
    access: "read-only",
    provider: {label: "Ethereum", url: "https://rpc.example", chainId: "1"},
    savedAt: 1,
};

describe("SavedContractsDialog", () => {
    it("opens and removes saved contracts", () => {
        const onOpen = vi.fn();
        const onRemove = vi.fn();
        render(
            <SavedContractsDialog
                open
                contracts={[entry]}
                onClose={vi.fn()}
                onOpen={onOpen}
                onRemove={onRemove}
            />,
        );

        expect(screen.getByText("Saved token")).toBeInTheDocument();
        expect(screen.getByText("Chain 1")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Open"}));
        expect(onOpen).toHaveBeenCalledWith(entry);
        fireEvent.click(screen.getByRole("button", {name: "Remove saved contract Saved token"}));
        expect(onRemove).toHaveBeenCalledWith(entry);
    });

    it("explains the empty state", () => {
        render(
            <SavedContractsDialog
                open
                contracts={[]}
                onClose={vi.fn()}
                onOpen={vi.fn()}
                onRemove={vi.fn()}
            />,
        );
        expect(screen.getByText(/No saved contracts yet/)).toBeInTheDocument();
    });
});
