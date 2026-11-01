import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SavedContract } from "../contracts/savedContracts";
import SavedContractsRail from "./SavedContractsRail";

const entry: SavedContract = {
    version: 2,
    address: "0x0000000000000000000000000000000000000010",
    chainId: "1",
    abi: "[]",
    savedAt: 1,
};

describe("SavedContractsRail", () => {
    it("uses and removes saved contracts", () => {
        const onUse = vi.fn();
        const onRemove = vi.fn();
        render(<SavedContractsRail contracts={[entry]} onUse={onUse} onRemove={onRemove} />);

        expect(screen.getByRole("complementary", {name: "Saved contracts"})).toBeInTheDocument();
        expect(screen.getByText("Saved contracts (1)")).toBeInTheDocument();
        expect(screen.getByText("0x000000…000010")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Use saved contract 0x000000…000010 on chain 1"}));
        expect(onUse).toHaveBeenCalledWith(entry);
        fireEvent.click(screen.getByRole("button", {name: "Remove saved contract 0x000000…000010 on chain 1"}));
        expect(onRemove).toHaveBeenCalledWith(entry);
    });

    it("explains the empty address book", () => {
        render(<SavedContractsRail contracts={[]} onUse={vi.fn()} onRemove={vi.fn()} />);

        expect(screen.getByText(/No saved contracts yet/)).toBeInTheDocument();
    });
});
