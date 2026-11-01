import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ethers } from "ethers";
import { ContractInstance } from "../contracts/workspace";
import ContractNavigation from "./ContractNavigation";

const contracts: ContractInstance[] = [
    {id: "one", label: "Token", address: "0x0000000000000000000000000000000000000001", contract: {} as ethers.BaseContract, isStatic: false, walletChainId: "1"},
    {id: "two", label: "Vault", address: "0x0000000000000000000000000000000000000002", contract: {} as ethers.BaseContract, isStatic: true, providerDetails: {label: "Base", url: "https://rpc.example", chainId: "8453"}},
];

describe("ContractNavigation", () => {
    it("selects, saves, opens saved contracts, and removes instances", () => {
        const onSelect = vi.fn();
        const onDelete = vi.fn();
        const onAdd = vi.fn();
        const onSave = vi.fn();
        const onOpenSaved = vi.fn();
        render(
            <ContractNavigation
                contracts={contracts}
                selectedId="one"
                onSelect={onSelect}
                onDelete={onDelete}
                onAdd={onAdd}
                onSave={onSave}
                onOpenSaved={onOpenSaved}
                savedCount={3}
            />,
        );
        fireEvent.click(screen.getAllByRole("button", {name: "Add contract"})[0]);
        expect(screen.getAllByRole("button", {name: "Add contract"})).toHaveLength(2);
        expect(screen.getAllByRole("button", {name: "Saved contracts (3)"})).toHaveLength(2);
        expect(onAdd).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getAllByRole("button", {name: "Saved contracts (3)"})[0]);
        expect(onOpenSaved).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getAllByRole("button", {name: "Save Token"})[0]);
        expect(onSave).toHaveBeenCalledWith("one");
        fireEvent.click(screen.getByText("Vault"));
        expect(onSelect).toHaveBeenCalledWith("two");
        expect(screen.queryByRole("button", {name: /Rename/})).not.toBeInTheDocument();
        fireEvent.click(screen.getAllByRole("button", {name: "Remove Token"})[0]);
        expect(onDelete).toHaveBeenCalledWith("one");
    });
});
