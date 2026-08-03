import { ethers } from "ethers";
import { formatAbiValue, normalizeAbiValue, normalizeError, valuesForOutputs } from "./callUtils";

const iface = new ethers.Interface([
    "function inspect() view returns (uint256 total, tuple(address owner, uint256[] amounts) details)",
]);
const outputs = iface.getFunction("inspect")!.outputs;

describe("call result formatting", () => {
    it("preserves multiple outputs and formats bigint values exactly", () => {
        const value = [BigInt(12), ["0x0000000000000000000000000000000000000001", [BigInt(1), BigInt(2)]]];
        const values = valuesForOutputs(outputs, value);

        expect(values).toHaveLength(2);
        expect(formatAbiValue(outputs[0], values[0])).toBe("12");
        expect(normalizeAbiValue(outputs[1], values[1])).toEqual({
            owner: "0x0000000000000000000000000000000000000001",
            amounts: ["1", "2"],
        });
    });

    it("handles zero and single outputs", () => {
        expect(valuesForOutputs([], undefined)).toEqual([]);
        expect(valuesForOutputs([outputs[0]], BigInt(42))).toEqual([BigInt(42)]);
    });
});

describe("error normalization", () => {
    it.each([
        ["ACTION_REJECTED", "Request rejected"],
        ["CALL_EXCEPTION", "Contract call reverted"],
        ["NETWORK_ERROR", "Network request failed"],
        ["TIMEOUT", "Confirmation timed out"],
        ["INVALID_ARGUMENT", "Invalid input"],
        ["NO_CONTRACT_CODE", "No contract on this network"],
        ["BAD_DATA", "Result could not be decoded"],
    ])("maps %s to a useful title", (code, title) => {
        expect(normalizeError({code, shortMessage: "technical message"}).title).toBe(title);
    });

    it("explains ABI decode failures in terms of the target configuration", () => {
        expect(normalizeError({code: "BAD_DATA", shortMessage: "could not decode result data"}).message)
            .toContain("contract address, selected network, and ABI");
    });

    it("supports plain and unknown errors", () => {
        expect(normalizeError(new Error("plain failure")).message).toBe("plain failure");
        expect(normalizeError(42).message).toBe("An unexpected error occurred.");
    });
});
