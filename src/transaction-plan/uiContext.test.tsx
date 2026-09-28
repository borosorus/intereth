import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { TransactionPlanUiProvider, useTransactionPlanUi, WorkspaceView } from "./uiContext";

function Probe() {
    const {activeView, setActiveView, requestExecution} = useTransactionPlanUi();
    useEffect(() => {
        // Expose the latest view for hash-sync assertions without querying UI state.
        (window as unknown as {__activeView?: WorkspaceView}).__activeView = activeView;
    }, [activeView]);
    return (
        <>
            <p data-testid="view">{activeView}</p>
            <button onClick={() => setActiveView("execution")}>to execution</button>
            <button onClick={() => requestExecution()}>request execution</button>
        </>
    );
}

function renderProbe() {
    render(
        <TransactionPlanUiProvider>
            <Probe />
        </TransactionPlanUiProvider>,
    );
}

describe("workspace view state", () => {
    afterEach(() => {
        window.history.pushState(null, "", "/");
        delete (window as unknown as {__activeView?: WorkspaceView}).__activeView;
    });

    it("defaults to Explore", () => {
        renderProbe();
        expect(screen.getByTestId("view")).toHaveTextContent("explore");
    });

    it("initializes from a #/execution hash so a refresh stays on Execution", () => {
        window.history.pushState(null, "", "#/execution");
        renderProbe();
        expect(screen.getByTestId("view")).toHaveTextContent("execution");
    });

    it("updates the hash when switching views", () => {
        renderProbe();
        fireEvent.click(screen.getByRole("button", {name: "to execution"}));
        expect(screen.getByTestId("view")).toHaveTextContent("execution");
        expect(window.location.hash).toBe("#/execution");
    });

    it("switches to Execution through requestExecution", () => {
        renderProbe();
        fireEvent.click(screen.getByRole("button", {name: "request execution"}));
        expect(screen.getByTestId("view")).toHaveTextContent("execution");
    });

    it("follows browser back/forward via hashchange", () => {
        renderProbe();
        fireEvent.click(screen.getByRole("button", {name: "to execution"}));
        expect(screen.getByTestId("view")).toHaveTextContent("execution");

        // Simulate "back": the URL changes and the hashchange event fires
        // without React initiating the transition.
        window.history.pushState(null, "", "#/explore");
        act(() => {
            fireEvent(window, new HashChangeEvent("hashchange"));
        });
        expect(screen.getByTestId("view")).toHaveTextContent("explore");
    });
});
