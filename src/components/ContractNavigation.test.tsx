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
    it("selects and renames labeled contract instances", () => {
        const onSelect = vi.fn();
        const onRename = vi.fn();
        const onAdd = vi.fn();
        render(<ContractNavigation contracts={contracts} selectedId="one" onSelect={onSelect} onRename={onRename} onDelete={vi.fn()} onAdd={onAdd} />);
        fireEvent.click(screen.getAllByRole("button", {name: "Add contract"})[0]);
        expect(onAdd).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("Vault"));
        expect(onSelect).toHaveBeenCalledWith("two");
        fireEvent.click(screen.getAllByRole("button", {name: "Rename Token"})[0]);
        fireEvent.change(screen.getByLabelText("Contract label"), {target: {value: "USDC"}});
        fireEvent.click(screen.getByRole("button", {name: "Save"}));
        expect(onRename).toHaveBeenCalledWith("one", "USDC");
    });
});
