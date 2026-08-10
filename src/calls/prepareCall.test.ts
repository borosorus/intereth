import { ethers } from "ethers";
import { prepareAbiCall, prepareRawCall } from "./prepareCall";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const TARGET = "0x0000000000000000000000000000000000000010";
const RECIPIENT = "0x0000000000000000000000000000000000000020";

describe("prepared calls", () => {
    it("encodes ABI arguments and keeps a detached editor snapshot", () => {
        const contractInterface = new ethers.Interface([
            "function transfer(address recipient, uint256 amount)",
            "event Transfer(address indexed from, address indexed to, uint256 amount)",
            "error InsufficientBalance(uint256 available, uint256 required)",
        ]);
        const fragment = contractInterface.getFunction("transfer")!;
        const argumentValues = [RECIPIENT, {amount: "12", unit: "wei" as const}];
        const prepared = prepareAbiCall({
            fragment,
            decoderAbi: contractInterface.fragments
                .filter((item) => item.type === "event" || item.type === "error")
                .map((item) => item.format("full")),
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            argumentValues,
            id: "call-1",
            createdAt: 1,
        });

        expect(prepared.data).toBe(contractInterface.encodeFunctionData(fragment, [RECIPIENT, BigInt(12)]));
        expect(prepared.value).toBe("0");
        expect(prepared.decoderAbi).toEqual([
            "event Transfer(address indexed from, address indexed to, uint256 amount)",
            "error InsufficientBalance(uint256 available, uint256 required)",
        ]);
        expect(prepared.display).toMatchObject({
            kind: "abi",
            functionName: "transfer",
            functionSignature: "transfer(address,uint256)",
        });
        expect(prepared.display.arguments?.map((item) => item.value)).toEqual([RECIPIENT, "12"]);

        argumentValues[0] = ACCOUNT;
        expect(prepared.editor.kind === "abi" && prepared.editor.arguments[0]).toBe(RECIPIENT);
    });

    it("converts payable values to a decimal wei string", () => {
        const fragment = new ethers.Interface(["function deposit() payable"]).getFunction("deposit")!;
        const prepared = prepareAbiCall({
            fragment,
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            argumentValues: [],
            valueAmount: "0.5",
            valueUnit: "ether",
            id: "call-1",
            createdAt: 1,
        });
        expect(prepared.value).toBe("500000000000000000");
    });

    it("prepares raw calldata and rejects malformed values", () => {
        expect(prepareRawCall({
            target: TARGET,
            account: ACCOUNT,
            chainId: "10",
            data: "0x1234",
            valueAmount: "2",
            valueUnit: "gwei",
            id: "raw-1",
            createdAt: 1,
        })).toMatchObject({
            id: "raw-1",
            chainId: "10",
            data: "0x1234",
            value: "2000000000",
            decoderAbi: [],
            editor: {kind: "raw"},
        });

        expect(() => prepareRawCall({
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            data: "0x123",
            valueAmount: "",
            valueUnit: "wei",
            id: "raw-2",
            createdAt: 1,
        })).toThrow("even-length hexadecimal");
    });

    it("rejects view functions and invalid session identities", () => {
        const fragment = new ethers.Interface(["function balance() view returns (uint256)"]).getFunction("balance")!;
        expect(() => prepareAbiCall({
            fragment,
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            argumentValues: [],
            id: "call-1",
            createdAt: 1,
        })).toThrow("state-modifying");
    });

    it("rejects non-decoder ABI fragments", () => {
        const fragment = new ethers.Interface(["function pause()"]).getFunction("pause")!;
        expect(() => prepareAbiCall({
            fragment,
            decoderAbi: ["function owner() view returns (address)"],
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            argumentValues: [],
        })).toThrow("only event and error");
    });
});
