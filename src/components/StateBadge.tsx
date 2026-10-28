import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import type { BatchExecutionState, SequentialExecutionState } from "../transaction-plan/types";
import type { PlanSessionStatus } from "../transaction-plan/selectors";
import { SimulationStatus } from "../simulation/context";
import { WatchEvaluationStatus } from "../simulation/types";

export type StateKind = "onchain" | "speculative" | "wallet" | "success" | "warning" | "error" | "neutral";

const colors: Record<StateKind, ChipProps["color"]> = {
    onchain: "primary",
    speculative: "info",
    wallet: "secondary",
    success: "success",
    warning: "warning",
    error: "error",
    neutral: "default",
};

export function StateBadge({kind, label, variant}: {kind: StateKind; label: string; variant?: ChipProps["variant"]}) {
    return (
        <Chip
            size="small"
            color={colors[kind]}
            label={label}
            variant={variant ?? (kind === "onchain" || kind === "neutral" ? "outlined" : "filled")}
            sx={{fontWeight: 700, flex: "0 0 auto"}}
        />
    );
}

export function simulationPresentation(status: SimulationStatus): {label: string; kind: StateKind} {
    switch (status) {
        case "waiting": return {label: "Preview waiting", kind: "neutral"};
        case "simulating": return {label: "Refreshing preview", kind: "speculative"};
        case "ready": return {label: "Simulation valid", kind: "success"};
        case "stale": return {label: "Preview stale", kind: "warning"};
        case "error": return {label: "Simulation unavailable", kind: "error"};
        default: return {label: "Preview unavailable", kind: "neutral"};
    }
}

export function watchPresentation(status: WatchEvaluationStatus): {label: string; kind: StateKind} {
    switch (status) {
        case "ready": return {label: "Up to date", kind: "success"};
        case "loading": return {label: "Evaluating", kind: "speculative"};
        case "blocked": return {label: "Blocked", kind: "warning"};
        case "error": return {label: "Failed", kind: "error"};
        default: return {label: "Stale", kind: "warning"};
    }
}

export function executionPresentation(status: BatchExecutionState["status"]): {label: string; kind: StateKind} {
    switch (status) {
        case "idle": return {label: "Draft", kind: "neutral"};
        case "submitting": return {label: "Awaiting wallet", kind: "wallet"};
        case "pending": return {label: "Submitted", kind: "warning"};
        case "confirmed": return {label: "Confirmed", kind: "success"};
        case "offchain_failed": return {label: "Not submitted", kind: "error"};
        case "reverted": return {label: "Reverted", kind: "error"};
        case "partially_reverted": return {label: "Partially reverted", kind: "error"};
        case "invalid": return {label: "Invalid response", kind: "error"};
    }
}

export function planExecutionPresentation({execution, sequential, sessionStatus, totalCalls}: {
    execution: BatchExecutionState;
    sequential: SequentialExecutionState;
    sessionStatus: PlanSessionStatus;
    totalCalls: number;
}): {label: string; kind: StateKind} | null {
    if (execution.status !== "idle") return executionPresentation(execution.status);

    if (sequential.status === "active") {
        const current = sequential.calls.at(-1);
        const confirmedCount = sequential.calls.filter((call) => call.status === "confirmed").length;
        const callNumber = confirmedCount + 1;
        const progress = totalCalls > 0 ? `${callNumber} of ${totalCalls}` : `${callNumber}`;

        if (!current) return {label: "Preparing execution", kind: "wallet"};
        if (current.status === "submitting") {
            return {label: current.safeBatch ? "Submitting Safe multi-call" : `Awaiting wallet · call ${progress}`, kind: "wallet"};
        }
        if (current.status === "awaiting_approvals") {
            return {label: current.safeBatch ? "Safe multi-call awaiting approvals" : `Safe approval · call ${progress}`, kind: "warning"};
        }
        if (current.status === "pending") {
            return {label: current.safeBatch ? "Safe multi-call pending" : `Call ${progress} pending`, kind: "warning"};
        }
        if (current.status === "failed") {
            return {label: current.safeBatch ? "Safe multi-call failed" : `Call ${progress} failed`, kind: "error"};
        }
        return {label: `Preparing call ${progress}`, kind: "wallet"};
    }

    switch (sessionStatus) {
        case "chain_mismatch": return {label: "Wrong network", kind: "warning"};
        case "account_mismatch": return {label: "Wrong account", kind: "warning"};
        case "owner_mismatch": return {label: "Safe owner required", kind: "warning"};
        case "disconnected": return {label: "Wallet disconnected", kind: "warning"};
        default: return null;
    }
}

export function callImpactPresentation(status: "refreshing" | "stale" | "unavailable"): {label: string; kind: StateKind} {
    switch (status) {
        case "refreshing": return simulationPresentation("simulating");
        case "stale": return simulationPresentation("stale");
        case "unavailable": return {label: "Preview unavailable", kind: "neutral"};
    }
}
