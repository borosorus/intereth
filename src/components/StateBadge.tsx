import { Chip, ChipProps } from "@mui/material";
import { BatchExecutionState } from "../transaction-plan/types";
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
        case "waiting": return {label: "Preview queued", kind: "neutral"};
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
