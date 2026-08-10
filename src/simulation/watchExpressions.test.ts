import { ethers } from "ethers";
import { prepareAbiWatch, prepareRawWatch, decodeWatchResult } from "./watchExpressions";

const context = {account: "0x0000000000000000000000000000000000000001", chainId: "1"};
const target = "0x0000000000000000000000000000000000000010";

describe("watch expressions", () => {
    it("prepares and decodes a portable ABI watch", () => {
        const fragment = new ethers.Interface(["function allowance(address owner, address spender) view returns (uint256 amount)"]).getFunction("allowance")!;
        const watch = prepareAbiWatch({
            context,
            target,
            fragment,
            argumentValues: [context.account, target],
            id: "watch-1",
            createdAt: 1,
        });
        expect(watch.display.functionSignature).toBe("allowance(address,address)");
        expect(watch.decoder).toEqual({kind: "abi", functionFragment: fragment.format("full")});
        const returnData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(42)]);
        expect(decodeWatchResult(watch, returnData)).toEqual({
            returnData,
            values: [{name: "amount", type: "uint256", value: "42"}],
        });
    });

    it("keeps raw watches and results ABI-independent", () => {
        const watch = prepareRawWatch({context, target, data: "0xabcd", id: "raw", createdAt: 1});
        expect(watch.data).toBe("0xabcd");
        expect(decodeWatchResult(watch, "0x1234")).toEqual({returnData: "0x1234"});
    });
});
