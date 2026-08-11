import { ethers } from "ethers";
import { decoderAbiForInterface, prepareAbiCall } from "../calls/prepareCall";
import { HttpJsonRpcTransport, SimulationClient } from "../simulation/SimulationClient";
import { SimulationRpcTransport } from "../simulation/types";
import { isHexData } from "../transaction-plan/rpcValidation";
import { PlanContext, QueuedCall } from "../transaction-plan/types";

const erc20Errors = new ethers.Interface([
    "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
]);
const erc20Interface = new ethers.Interface([
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
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

export function createErc20ApprovalCall(
    context: PlanContext,
    tokenAddress: string,
    spender: string,
    amount: bigint,
): QueuedCall {
    const fragment = erc20Interface.getFunction("approve")!;
    return prepareAbiCall({
        fragment,
        decoderAbi: decoderAbiForInterface(erc20Interface),
        target: tokenAddress,
        account: context.account,
        chainId: context.chainId,
        argumentValues: [spender, {amount: amount.toString(), unit: "wei"}],
    });
}

export async function inferDirectApprovalToken(
    transport: SimulationRpcTransport,
    context: PlanContext,
    candidate: string,
    requirement: Erc20ApprovalRequirement,
) {
    const tokenAddress = ethers.getAddress(candidate);
    const data = erc20Interface.encodeFunctionData("allowance", [context.account, requirement.spender]);
    const response = await transport.send("eth_call", [{from: context.account, to: tokenAddress, data}, "latest"]);
    if (!isHexData(response)) return null;
    try {
        const [allowance] = erc20Interface.decodeFunctionResult("allowance", response);
        return ethers.getBigInt(allowance) === requirement.currentAllowance ? tokenAddress : null;
    } catch {
        return null;
    }
}

export interface ValidatedApprovalRecovery {
    approvalCall: QueuedCall;
    gasLimit: bigint;
    blockNumber?: string;
}

export async function validateApprovalRecovery(
    rpcUrl: string,
    context: PlanContext,
    originalCall: QueuedCall,
    requirement: Erc20ApprovalRequirement,
    tokenAddress: string,
    amount: bigint,
): Promise<ValidatedApprovalRecovery> {
    if (amount < requirement.needed) {
        throw Object.assign(new Error("The approval amount must cover the required allowance."), {code: "INVALID_ARGUMENT"});
    }
    const approvalCall = createErc20ApprovalCall(context, tokenAddress, requirement.spender, amount);
    const client = new SimulationClient(new HttpJsonRpcTransport(rpcUrl));
    await client.assertChain(context.chainId);
    const result = (await client.simulatePlan(context, [approvalCall, originalCall], [])).queue;
    if (result.calls.some((call) => call.status !== "0x1")) {
        throw Object.assign(new Error("The approval and transaction did not both succeed in simulation."), {
            code: "APPROVAL_RECOVERY_SIMULATION_FAILED",
        });
    }
    const targetResult = result.calls[1];
    const simulatedGas = ethers.getBigInt(targetResult.maxUsedGas ?? targetResult.gasUsed);
    const gasLimit = (simulatedGas * BigInt(120) + BigInt(99)) / BigInt(100);
    return {approvalCall, gasLimit, blockNumber: result.blockNumber};
}
