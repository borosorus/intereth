import { ethers } from "ethers";
import { ABI_PRESETS, CONTRACT_EXAMPLES, formatAbi } from "./presets";

describe("ABI presets", () => {
    it("provides three valid standard interfaces", () => {
        expect(ABI_PRESETS).toHaveLength(3);
        expect(ABI_PRESETS.map((preset) => preset.id)).toEqual(["erc20", "erc721", "erc1155"]);

        ABI_PRESETS.forEach((preset) => {
            expect(() => new ethers.Interface(formatAbi(preset.abi))).not.toThrow();
        });
    });
});

describe("contract examples", () => {
    it("provides three valid Ethereum examples with only one ERC-20", () => {
        expect(CONTRACT_EXAMPLES).toHaveLength(3);
        expect(CONTRACT_EXAMPLES.filter((example) => example.category === "erc20")).toHaveLength(1);

        CONTRACT_EXAMPLES.forEach((example) => {
            expect(ethers.isAddress(example.address)).toBe(true);
            expect(() => new ethers.Interface(formatAbi(example.abi))).not.toThrow();
        });
    });
});
