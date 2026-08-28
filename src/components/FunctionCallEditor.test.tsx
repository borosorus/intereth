import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import FunctionCallEditor from "./FunctionCallEditor";

const noop = () => undefined;

describe("FunctionCallEditor calldata copy", () => {
    it("copies calldata encoded from the current function arguments", async () => {
        const clipboardWrite = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {writeText: clipboardWrite},
        });
        const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
        const fragment = iface.getFunction("approve")!;
        const spender = "0x0000000000000000000000000000000000000010";

        render(
            <FunctionCallEditor
                fragment={fragment}
                arguments={[spender, {amount: "42", unit: "wei"}]}
                onArgumentsChange={noop}
                valueAmount=""
                valueUnit="wei"
                onValueAmountChange={noop}
                onValueUnitChange={noop}
            />,
        );

        fireEvent.click(screen.getByRole("button", {name: "Copy calldata"}));
        await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(
            iface.encodeFunctionData(fragment, [spender, 42n]),
        ));
    });

    it("disables calldata copying until arguments can be encoded", () => {
        const fragment = new ethers.Interface(["function approve(address spender, uint256 amount)"]).getFunction("approve")!;

        render(
            <FunctionCallEditor
                fragment={fragment}
                arguments={["", {amount: "", unit: "wei"}]}
                onArgumentsChange={noop}
                valueAmount=""
                valueUnit="wei"
                onValueAmountChange={noop}
                onValueUnitChange={noop}
            />,
        );

        expect(screen.getByRole("button", {name: "Copy calldata"})).toBeDisabled();
    });
});
