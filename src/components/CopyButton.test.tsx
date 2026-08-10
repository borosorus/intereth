import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CopyButton from "./CopyButton";

function setClipboard(writeText: jest.Mock) {
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {writeText},
    });
}

describe("CopyButton", () => {
    it("copies the complete value and confirms success", async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        setClipboard(writeText);
        render(<CopyButton value="0x1234" label="Copy address" />);

        fireEvent.click(screen.getByRole("button", {name: "Copy address"}));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith("0x1234"));
        expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
    });

    it("reports clipboard failures", async () => {
        setClipboard(jest.fn().mockRejectedValue(new Error("denied")));
        render(<CopyButton value="0x1234" label="Copy address" />);

        fireEvent.click(screen.getByRole("button", {name: "Copy address"}));

        expect(await screen.findByText("Clipboard access failed")).toBeInTheDocument();
    });

    it("copies URL values without rendering a navigable link", async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        setClipboard(writeText);
        render(<CopyButton value="https://rpc.example" label="Copy RPC URL" variant="url" />);

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Copy RPC URL"}));

        expect(writeText).toHaveBeenCalledWith("https://rpc.example");
        expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
    });
});
