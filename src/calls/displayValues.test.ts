import { summarizeArgument, summarizeNativeValue } from "./displayValues";

describe("queued call display values", () => {
    it("summarizes common scalar values without losing their exact representation", () => {
        expect(summarizeArgument({name: "owner", type: "address", value: "0x0000000000000000000000000000000000000010"})).toEqual({
            primary: "0x000000…000010",
            secondary: "0x0000000000000000000000000000000000000010",
        });
        expect(summarizeArgument({name: "amount", type: "uint256", value: "1234567"})).toEqual({primary: "1,234,567", secondary: "1234567"});
        expect(summarizeArgument({name: "enabled", type: "bool", value: "true"})).toEqual({primary: "True"});
        expect(summarizeArgument({name: "data", type: "bytes", value: "0x123456"})).toEqual({primary: "0x123456", secondary: "3 bytes"});
    });

    it("collapses collections and safely falls back for malformed values", () => {
        expect(summarizeArgument({name: "recipients", type: "address[]", value: '["0x1","0x2"]'}).primary).toBe("2 items");
        expect(summarizeArgument({name: "settings", type: "tuple", value: '[true,"5"]'}).primary).toBe("2 fields");
        expect(summarizeArgument({name: "amount", type: "uint256", value: "not-a-number"})).toEqual({primary: "not-a-number"});
    });

    it("formats native value for review while retaining exact wei", () => {
        expect(summarizeNativeValue("1000000000000000000")).toEqual({primary: "1.0 ETH", secondary: "1,000,000,000,000,000,000 wei"});
        expect(summarizeNativeValue("0")).toEqual({primary: "0 ETH", secondary: "0 wei"});
    });
});
