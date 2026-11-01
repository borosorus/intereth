import { detectErc20ApprovalRequirement, Erc20ApprovalRequirement } from "../transactions/approvalRecovery";
import { PlanSimulatedCall } from "./types";

/**
 * Simulation results mirror the RPC response structure. Reuse the recovery
 * detector so preflight and failed-send handling agree on the same custom
 * error and allowance fields.
 */
export function detectCallApprovalRequirement(call: PlanSimulatedCall): Erc20ApprovalRequirement | null {
    if (call.status !== "0x0") return null;
    return detectErc20ApprovalRequirement(call.raw)
        ?? detectErc20ApprovalRequirement(call.error)
        ?? detectErc20ApprovalRequirement({returnData: call.returnData});
}
