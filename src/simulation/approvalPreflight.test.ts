import { ethers } from "ethers";
import { detectCallApprovalRequirement } from "./approvalPreflight";
import { PlanSimulatedCall } from "./types";

const SPENDER = "0x0000000000000000000000000000000000000020";
const erc20Errors = new ethers.Interface([
    "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
]);

function simulatedCall(overrides: Partial<PlanSimulatedCall> = {}): PlanSimulatedCall {
    return {
        callId: "call-1",
        status: "0x0",
        returnData: "0x",
        gasUsed: "0x5208",
        logs: [],
        decodedEvents: [],
        raw: {},
        ...overrides,
    };
}

describe("detectCallApprovalRequirement", () => {
    it("detects an allowance revert nested in the simulation response", () => {
        const revertData = erc20Errors.encodeErrorResult("ERC20InsufficientAllowance", [SPENDER, BigInt(3), BigInt(12)]);
        const requirement = detectCallApprovalRequirement(simulatedCall({raw: {error: {data: revertData}}}));

        expect(requirement).toMatchObject({
            kind: "erc20",
            spender: SPENDER,
            currentAllowance: BigInt(3),
            needed: BigInt(12),
            revertData,
        });
    });

    it("falls back to the normalized error and return data fields", () => {
        const revertData = erc20Errors.encodeErrorResult("ERC20InsufficientAllowance", [SPENDER, BigInt(0), BigInt(9)]);
        expect(detectCallApprovalRequirement(simulatedCall({error: {message: "reverted", data: revertData}}))?.needed).toBe(BigInt(9));
        expect(detectCallApprovalRequirement(simulatedCall({returnData: revertData}))?.needed).toBe(BigInt(9));
    });

    it("ignores successful calls and unrelated revert data", () => {
        const revertData = erc20Errors.encodeErrorResult("ERC20InsufficientAllowance", [SPENDER, BigInt(0), BigInt(9)]);
        expect(detectCallApprovalRequirement(simulatedCall({status: "0x1", raw: {error: {data: revertData}}}))).toBeNull();
        expect(detectCallApprovalRequirement(simulatedCall({returnData: "0xdead"}))).toBeNull();
    });
});
