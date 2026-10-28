import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { callImpactPresentation, executionPresentation, planExecutionPresentation, simulationPresentation, StateBadge, watchPresentation } from "./StateBadge";

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

    it("presents Safe multi-call and individual sequential states clearly", () => {
        expect(planExecutionPresentation({
            execution: {status: "idle"},
            sequential: {
                status: "active",
                calls: [{callId: "call-1", status: "awaiting_approvals", safeBatch: true, approvedOwners: 1, threshold: 2}],
            },
            sessionStatus: "ready",
            totalCalls: 2,
        })).toEqual({label: "Safe multi-call awaiting approvals", kind: "warning"});

        expect(planExecutionPresentation({
            execution: {status: "idle"},
            sequential: {
                status: "active",
                calls: [
                    {callId: "call-1", status: "confirmed"},
                    {callId: "call-2", status: "pending"},
                ],
            },
            sessionStatus: "ready",
            totalCalls: 3,
        })).toEqual({label: "Call 2 of 3 pending", kind: "warning"});
    });

    it("uses the shared simulation colors and labels for plan-call preview states", () => {
        expect(callImpactPresentation("refreshing")).toEqual(simulationPresentation("simulating"));
        expect(callImpactPresentation("stale")).toEqual(simulationPresentation("stale"));
        expect(callImpactPresentation("unavailable")).toEqual({label: "Preview unavailable", kind: "neutral"});
    });
});
