import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { executionPresentation, simulationPresentation, StateBadge, watchPresentation } from "./StateBadge";

describe("state presentation", () => {
    it("uses contextual labels instead of generic readiness", () => {
        expect(simulationPresentation("ready")).toEqual({label: "Simulation valid", kind: "success"});
        expect(watchPresentation("ready")).toEqual({label: "Up to date", kind: "success"});
        expect(executionPresentation("submitting")).toEqual({label: "Awaiting wallet", kind: "wallet"});
        expect(executionPresentation("pending")).toEqual({label: "Submitted", kind: "warning"});
    });

    it("renders an explicit text label in addition to color", () => {
        render(<StateBadge kind="speculative" label="Speculative" />);
        expect(screen.getByText("Speculative")).toBeInTheDocument();
    });
});
