import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import { DynamicContract } from "../App";
import ContractNavigation from "./ContractNavigation";

const contracts: DynamicContract[] = [
    {id: "one", label: "Token", address: "0x0000000000000000000000000000000000000001", contract: {} as ethers.BaseContract, isStatic: false, walletChainId: "1"},
    {id: "two", label: "Vault", address: "0x0000000000000000000000000000000000000002", contract: {} as ethers.BaseContract, isStatic: true, providerDetails: {label: "Base", url: "https://rpc.example", chainId: "8453"}},
];

describe("ContractNavigation", () => {
    it("selects and renames labeled contract instances", () => {
        const onSelect = jest.fn();
        const onRename = jest.fn();
        const onAdd = jest.fn();
        render(<ContractNavigation contracts={contracts} selectedId="one" onSelect={onSelect} onRename={onRename} onDelete={jest.fn()} onAdd={onAdd} />);
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
