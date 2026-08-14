import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkspaceModeProvider } from "../workspace/context";
import WorkspaceModeControl from "./WorkspaceModeControl";

describe("WorkspaceModeControl", () => {
    it("switches modes and retains the explanatory popover", () => {
        render(<WorkspaceModeProvider><WorkspaceModeControl /></WorkspaceModeProvider>);
        expect(screen.getByRole("button", {name: "Interact workspace"})).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", {name: "Simulate workspace"}));
        expect(screen.getByRole("button", {name: "Simulate workspace"})).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", {name: "About workspace modes"}));
        expect(screen.getByRole("dialog", {name: "About workspace modes"})).toBeInTheDocument();
    });
});
