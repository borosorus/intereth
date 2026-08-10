import { ethers } from "ethers";
import { detectErc20ApprovalRequirement } from "./approvalRecovery";

const SPENDER = "0x0000000000000000000000000000000000000020";
const errorInterface = new ethers.Interface([
    "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
]);

describe("ERC-20 approval recovery detection", () => {
    it.each([
        (data: string) => ({data}),
        (data: string) => ({error: {data}}),
        (data: string) => ({info: {error: {data: {data}}}}),
        (data: string) => ({cause: {result: data}}),
    ])("decodes standardized allowance errors from nested provider errors", (wrap) => {
        const data = errorInterface.encodeErrorResult("ERC20InsufficientAllowance", [SPENDER, BigInt(4), BigInt(12)]);
        expect(detectErc20ApprovalRequirement(wrap(data))).toEqual({
            kind: "erc20",
            spender: ethers.getAddress(SPENDER),
            currentAllowance: BigInt(4),
            needed: BigInt(12),
            revertData: data,
        });
    });

    it("does not infer approval from messages, unrelated errors, or transaction calldata", () => {
        const custom = new ethers.Interface(["error Unauthorized(address caller)"])
            .encodeErrorResult("Unauthorized", [SPENDER]);
        const allowanceError = errorInterface.encodeErrorResult("ERC20InsufficientAllowance", [SPENDER, BigInt(0), BigInt(1)]);

        expect(detectErc20ApprovalRequirement({message: "ERC20: insufficient allowance"})).toBeNull();
        expect(detectErc20ApprovalRequirement({data: custom})).toBeNull();
        expect(detectErc20ApprovalRequirement({transaction: {data: allowanceError}})).toBeNull();
    });

    it("handles circular provider error objects", () => {
        const error: {error?: unknown} = {};
        error.error = error;
        expect(detectErc20ApprovalRequirement(error)).toBeNull();
    });
});
