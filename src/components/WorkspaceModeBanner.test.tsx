import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkspaceModeProvider } from "../workspace/context";
import WorkspaceModeBanner from "./WorkspaceModeBanner";

function renderBanner() {
    return render(
        <WorkspaceModeProvider>
            <WorkspaceModeBanner />
        </WorkspaceModeProvider>,
    );
}

describe("WorkspaceModeBanner", () => {
    it("makes the active workspace and its purpose explicit", () => {
        renderBanner();

        expect(screen.getByRole("button", {name: "Interact workspace"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText(/Interact mode:/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Simulate workspace"}));

        expect(screen.getByRole("button", {name: "Simulate workspace"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText(/Simulate mode:/)).toBeInTheDocument();
    });

    it("explains both workspace modes", () => {
        renderBanner();
        fireEvent.click(screen.getByRole("button", {name: "About workspace modes"}));

        expect(screen.getByRole("dialog", {name: "About workspace modes"})).toBeInTheDocument();
        expect(screen.getByText(/Use canonical on-chain reads/)).toBeInTheDocument();
        expect(screen.getByText(/Run reads and watches against the speculative state/)).toBeInTheDocument();
    });
});
