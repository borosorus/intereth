import { BalanceChange, DecodedEvent, TokenMetadata } from "./types";
import { formatBalanceChangeAmount, formatEventArgument, metadataForToken, tokenDescription, tokenLabel } from "./tokenFormatting";

const token = "0x0000000000000000000000000000000000000010";
const metadata: TokenMetadata = {
    chainId: "1", address: token, name: "USD Coin", symbol: "USDC", decimals: 6, fetchedAtBlock: "0x64",
};

describe("token formatting", () => {
    it("formats signed balance changes while retaining raw units when requested", () => {
        const change: BalanceChange = {asset: "erc20", tokenAddress: token, account: token, delta: "-1500000"};
        expect(formatBalanceChangeAmount(change, metadata)).toBe("-1.5 USDC");
        expect(formatBalanceChangeAmount({...change, delta: "1500000"}, metadata, true)).toBe("+1.5 USDC (+1500000 raw units)");
        expect(formatBalanceChangeAmount(change)).toBe("-1500000 raw units");
    });

    it("formats ERC-20 event values without changing unrelated arguments", () => {
        const event = {
            address: token, name: "Transfer", signature: "Transfer(address,address,uint256)", kind: "erc20-transfer",
        } as DecodedEvent;
        expect(formatEventArgument(event, {name: "value", type: "uint256", value: "1500000"}, metadata)).toBe("1.5 USDC");
        expect(formatEventArgument(event, {name: "value", type: "uint256", value: "1500000"}, metadata, true))
            .toBe("1.5 USDC (1500000 raw units)");
        expect(formatEventArgument(event, {name: "to", type: "address", value: token}, metadata)).toBe(token);
    });

    it("looks up chain-scoped metadata and provides safe labels", () => {
        expect(metadataForToken({[`1:${token.toLowerCase()}`]: metadata}, "1", token)).toEqual(metadata);
        expect(metadataForToken({[`1:${token.toLowerCase()}`]: metadata}, "10", token)).toBeUndefined();
        expect(tokenLabel(token, metadata)).toBe("USDC");
        expect(tokenDescription(token, metadata)).toContain(`USD Coin · USDC · ${token}`);
    });
});
