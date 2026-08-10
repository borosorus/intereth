import { ethers } from "ethers";

const erc20Errors = new ethers.Interface([
    "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
]);

export interface Erc20ApprovalRequirement {
    kind: "erc20";
    spender: string;
    currentAllowance: bigint;
    needed: bigint;
    revertData: string;
}

const ignoredNestedKeys = new Set(["transaction", "request", "payload"]);
const revertDataKeys = new Set(["data", "result", "returnData"]);

function collectRevertData(value: unknown, candidates: string[], seen: WeakSet<object>) {
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    seen.add(value);

    for (const [key, nested] of Object.entries(value)) {
        if (revertDataKeys.has(key) && typeof nested === "string" && ethers.isHexString(nested)) {
            candidates.push(nested);
        }
        if (!ignoredNestedKeys.has(key)) {
            collectRevertData(nested, candidates, seen);
        }
    }
}

export function detectErc20ApprovalRequirement(error: unknown): Erc20ApprovalRequirement | null {
    const candidates: string[] = [];
    collectRevertData(error, candidates, new WeakSet());

    for (const revertData of candidates) {
        try {
            const decoded = erc20Errors.parseError(revertData);
            if (decoded?.name === "ERC20InsufficientAllowance") {
                return {
                    kind: "erc20",
                    spender: ethers.getAddress(decoded.args.spender),
                    currentAllowance: ethers.getBigInt(decoded.args.allowance),
                    needed: ethers.getBigInt(decoded.args.needed),
                    revertData,
                };
            }
        } catch {
            // A nested data field is not necessarily EVM revert data.
        }
    }
    return null;
}
