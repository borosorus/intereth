import { ethers } from "ethers";
import { PlanContext, QueuedCall } from "../transaction-plan/types";
import { SimulationRpcTransport } from "../simulation/types";
import {
    createErc20ApprovalCall,
    detectErc20ApprovalRequirement,
    inferDirectApprovalToken,
    validateApprovalRecovery,
} from "./approvalRecovery";

const SPENDER = "0x0000000000000000000000000000000000000020";
const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TOKEN = "0x0000000000000000000000000000000000000010";
const TARGET = "0x0000000000000000000000000000000000000030";
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

describe("ERC-20 approval recovery preparation", () => {
    const context: PlanContext = {account: ACCOUNT, chainId: "1"};
    const requirement = {
        kind: "erc20" as const,
        spender: SPENDER,
        currentAllowance: BigInt(4),
        needed: BigInt(12),
        revertData: "0x1234",
    };
    const originalCall: QueuedCall = {
        id: "original",
        chainId: "1",
        from: ACCOUNT,
        to: TARGET,
        data: "0xabcd",
        value: "0",
        display: {kind: "raw", contractAddress: TARGET},
        editor: {kind: "raw"},
        createdAt: 1,
    };

    afterEach(() => jest.restoreAllMocks());

    it("encodes exact approvals and verifies direct token candidates by allowance", async () => {
        const approval = createErc20ApprovalCall(context, TOKEN, SPENDER, BigInt(12));
        const tokenInterface = new ethers.Interface([
            "function approve(address,uint256)",
            "function allowance(address,address) view returns (uint256)",
        ]);
        expect(tokenInterface.decodeFunctionData("approve", approval.data)).toEqual(expect.arrayContaining([SPENDER, BigInt(12)]));

        const send = jest.fn().mockResolvedValue(tokenInterface.encodeFunctionResult("allowance", [BigInt(4)]));
        await expect(inferDirectApprovalToken({send} as SimulationRpcTransport, context, TOKEN, requirement)).resolves.toBe(TOKEN);
        send.mockResolvedValueOnce(tokenInterface.encodeFunctionResult("allowance", [BigInt(3)]));
        await expect(inferDirectApprovalToken({send} as SimulationRpcTransport, context, TOKEN, requirement)).resolves.toBeNull();
    });

    it("validates the ordered sequence and derives target-only gas with a 20 percent margin", async () => {
        const fetchMock = jest.spyOn(global, "fetch")
            .mockResolvedValueOnce({ok: true, json: async () => ({jsonrpc: "2.0", id: 1, result: "0x1"})} as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: "2.0",
                    id: 2,
                    result: [{number: "0x20", calls: [
                        {status: "0x1", returnData: "0x", gasUsed: "0x40"},
                        {status: "0x1", returnData: "0x", gasUsed: "0x50", maxUsedGas: "0x64"},
                    ]}],
                }),
            } as Response);

        const result = await validateApprovalRecovery(
            "https://simulate.example",
            context,
            originalCall,
            requirement,
            TOKEN,
            BigInt(12),
        );
        expect(result.gasLimit).toBe(BigInt(120));
        expect(result.blockNumber).toBe("0x20");

        const request = JSON.parse(String(jest.mocked(fetchMock).mock.calls[1][1]?.body));
        expect(request.params[0].blockStateCalls[0].calls).toHaveLength(2);
        expect(request.params[0].blockStateCalls[0].calls[1]).toMatchObject({to: TARGET, input: "0xabcd"});
    });

    it("rejects insufficient proposed approvals before calling the RPC", async () => {
        const fetchMock = jest.spyOn(global, "fetch");
        await expect(validateApprovalRecovery(
            "https://simulate.example",
            context,
            originalCall,
            requirement,
            TOKEN,
            BigInt(11),
        )).rejects.toMatchObject({code: "INVALID_ARGUMENT"});
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
