import { ethers } from "ethers";
import { QueuedCall } from "../transaction-plan/types";
import { analyzeBalanceChanges, NATIVE_TRANSFER_ADDRESS, TRANSFER_TOPIC } from "./balanceChanges";
import { createPlanSimulationSnapshot } from "./decode";
import { SimulatedCallResult, SimulationLog } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const OTHER = "0x0000000000000000000000000000000000000002";
const TARGET = "0x0000000000000000000000000000000000000010";
const TOKEN = "0x0000000000000000000000000000000000000020";
const contractInterface = new ethers.Interface([
    "function mint(address to, uint256 amount)",
    "event Mint(address indexed to, uint256 amount)",
    "error Unauthorized(address caller)",
]);
const call: QueuedCall = {
    id: "call-1",
    chainId: "1",
    from: ACCOUNT,
    to: TARGET,
    data: contractInterface.encodeFunctionData("mint", [ACCOUNT, 5]),
    value: "0",
    decoderAbi: contractInterface.fragments
        .filter((fragment) => fragment.type === "event" || fragment.type === "error")
        .map((fragment) => fragment.format("full")),
    display: {kind: "abi", contractAddress: TARGET, functionName: "mint"},
    editor: {kind: "abi", functionFragment: contractInterface.getFunction("mint")!.format("full"), arguments: [ACCOUNT, "5"]},
    createdAt: 1,
};

function result(overrides: Partial<SimulatedCallResult> = {}): SimulatedCallResult {
    const raw = {status: "0x1", returnData: "0x", gasUsed: "0x5208", logs: []};
    return {status: "0x1", returnData: "0x", gasUsed: "0x5208", logs: [], raw, ...overrides};
}

function transferLog(address: string, from: string, to: string, amount: bigint): SimulationLog {
    const raw = {
        address,
        topics: [TRANSFER_TOPIC, ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)],
        data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amount]),
    };
    return {...raw, raw};
}

describe("simulation decoding", () => {
    it("decodes ABI events and custom errors from portable call metadata", () => {
        const event = contractInterface.encodeEventLog(contractInterface.getEvent("Mint")!, [ACCOUNT, 5]);
        const success = result({logs: [{address: TARGET, topics: event.topics, data: event.data, raw: event}]});
        const failure = result({
            status: "0x0",
            returnData: contractInterface.encodeErrorResult("Unauthorized", [ACCOUNT]),
            error: {message: "execution reverted"},
        });

        const snapshot = createPlanSimulationSnapshot(
            {chainId: "1", account: ACCOUNT},
            [call, {...call, id: "call-2"}],
            {calls: [success, failure], blockNumber: "0x65", raw: {calls: 2}},
            "revision",
            "0x64",
        );

        expect(snapshot.calls[0].decodedEvents[0]).toMatchObject({name: "Mint", kind: "abi"});
        expect(snapshot.calls[0].decodedEvents[0].arguments).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "amount", value: "5"}),
        ]));
        expect(snapshot.calls[1].decodedRevert).toMatchObject({name: "Unauthorized", kind: "custom"});
        expect(snapshot.baseBlockNumber).toBe("0x64");
        expect(snapshot.raw).toEqual({calls: 2});
    });

    it("decodes standard and raw fallback reverts", () => {
        const standard = result({status: "0x0", returnData: new ethers.Interface(["error Error(string)"]).encodeErrorResult("Error", ["nope"])});
        const unknown = result({status: "0x0", returnData: "0xdeadbeef", error: {message: "unknown failure"}});
        const snapshot = createPlanSimulationSnapshot(
            {chainId: "1", account: ACCOUNT},
            [call, {...call, id: "call-2", decoderAbi: []}],
            {calls: [standard, unknown], raw: {}},
            "revision",
            "0x64",
        );

        expect(snapshot.calls[0].decodedRevert).toMatchObject({name: "Error", message: "nope", kind: "standard"});
        expect(snapshot.calls[1].decodedRevert).toMatchObject({name: "Reverted", message: "unknown failure", kind: "raw"});
    });
});

describe("balance change analysis", () => {
    it("aggregates ERC-20 and traced native transfers from successful calls", () => {
        const changes = analyzeBalanceChanges([
            result({logs: [
                transferLog(TOKEN, ACCOUNT, OTHER, BigInt(10)),
                transferLog(TOKEN, OTHER, ACCOUNT, BigInt(3)),
                transferLog(NATIVE_TRANSFER_ADDRESS, OTHER, ACCOUNT, BigInt(5)),
            ]}),
            result({status: "0x0", logs: [transferLog(TOKEN, ACCOUNT, OTHER, BigInt(100))]}),
        ]);

        expect(changes).toEqual(expect.arrayContaining([
            {asset: "erc20", tokenAddress: ethers.getAddress(TOKEN), account: ethers.getAddress(ACCOUNT), delta: "-7"},
            {asset: "erc20", tokenAddress: ethers.getAddress(TOKEN), account: ethers.getAddress(OTHER), delta: "7"},
            {asset: "native", account: ethers.getAddress(ACCOUNT), delta: "5"},
            {asset: "native", account: ethers.getAddress(OTHER), delta: "-5"},
        ]));
    });

    it("does not treat four-topic NFT transfers as fungible balance changes", () => {
        const nftLog = transferLog(TOKEN, ACCOUNT, OTHER, BigInt(1));
        nftLog.topics.push(ethers.zeroPadValue("0x01", 32));
        expect(analyzeBalanceChanges([result({logs: [nftLog]})])).toEqual([]);
    });
});
