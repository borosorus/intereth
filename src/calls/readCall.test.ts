import { ethers } from "ethers";
import { decodeFunctionRead, encodeFunctionRead, normalizeReadData } from "./readCall";

describe("read call helpers", () => {
    it("encodes arguments and restores decoded result shapes", () => {
        const fragment = new ethers.Interface([
            "function inspect(address owner) view returns (uint256 total, bool active)",
        ]).getFunction("inspect")!;
        const owner = "0x0000000000000000000000000000000000000001";
        const encoded = encodeFunctionRead(fragment, [owner]);
        expect(encoded.data).toBe(new ethers.Interface([fragment]).encodeFunctionData(fragment, [owner]));

        const returnData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "bool"], [BigInt(7), true]);
        expect(Array.from(decodeFunctionRead(fragment, returnData) as ArrayLike<unknown>)).toEqual([BigInt(7), true]);
    });

    it("normalizes empty and hex raw data and rejects malformed calldata", () => {
        expect(normalizeReadData("  ")).toBe("0x");
        expect(normalizeReadData("0xABCD")).toBe("0xabcd");
        expect(() => normalizeReadData("0x1")).toThrow("even-length hexadecimal");
    });
});
