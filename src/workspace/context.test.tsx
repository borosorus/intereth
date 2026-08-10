import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkspaceModeProvider, useWorkspaceMode } from "./context";

function Probe() {
    const workspace = useWorkspaceMode();
    return (
        <>
            <span>{workspace.mode}</span>
            <button onClick={() => workspace.setMode("simulate")}>Simulate</button>
        </>
    );
}

describe("WorkspaceModeProvider", () => {
    it("starts in Interact and switches modes in memory", () => {
        render(<WorkspaceModeProvider><Probe /></WorkspaceModeProvider>);

        expect(screen.getByText("interact")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Simulate"}));
        expect(screen.getByText("simulate")).toBeInTheDocument();
    });
});
