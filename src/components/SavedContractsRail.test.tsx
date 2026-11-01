import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SavedContract } from "../contracts/savedContracts";
import SavedContractsRail from "./SavedContractsRail";

const entry: SavedContract = {
    version: 1,
    id: "saved-1",
    label: "Saved token",
    address: "0x0000000000000000000000000000000000000010",
    chainId: "1",
    abi: "[]",
    access: "read-only",
    provider: {label: "Ethereum", url: "https://rpc.example", chainId: "1"},
    savedAt: 1,
};

describe("SavedContractsRail", () => {
    it("opens and removes saved contracts", () => {
        const onOpen = vi.fn();
        const onRemove = vi.fn();
        render(<SavedContractsRail contracts={[entry]} onOpen={onOpen} onRemove={onRemove} />);

        expect(screen.getByRole("complementary", {name: "Saved contracts"})).toBeInTheDocument();
        expect(screen.getByText("Saved contracts (1)")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Open"}));
        expect(onOpen).toHaveBeenCalledWith(entry);
        fireEvent.click(screen.getByRole("button", {name: "Remove saved contract Saved token"}));
        expect(onRemove).toHaveBeenCalledWith(entry);
    });

    it("explains the empty address book", () => {
        render(<SavedContractsRail contracts={[]} onOpen={vi.fn()} onRemove={vi.fn()} />);

        expect(screen.getByText(/No saved contracts yet/)).toBeInTheDocument();
    });
});
