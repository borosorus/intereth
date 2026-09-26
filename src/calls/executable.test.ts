import { ethers } from "ethers";
import { prepareAbiCall, prepareRawCall } from "./prepareCall";
import { executableOf } from "./executable";

const TARGET = "0x0000000000000000000000000000000000000010";
const ACCOUNT = "0x0000000000000000000000000000000000000001";

const transferFragment = ethers.FunctionFragment.from(
    "function transfer(address to, uint256 amount) external returns (bool)",
);

describe("executable call boundary", () => {
    it("projects a prepared ABI call to exactly the executable payload", () => {
        const prepared = prepareAbiCall({
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            fragment: transferFragment,
            argumentValues: [TARGET, {amount: "7", unit: "wei"}],
        });

        const executable = executableOf(prepared);
        expect(Object.keys(executable).sort()).toEqual(["data", "to", "value"]);
        expect(executable.to).toEqual(ethers.getAddress(TARGET));
        expect(executable.value).toEqual("0");
        expect(executable.data).toEqual(
            new ethers.Interface([transferFragment]).encodeFunctionData(transferFragment, [TARGET, 7n]),
        );
    });

    it("projects a prepared raw call to the same payload shape and value semantics", () => {
        const prepared = prepareRawCall({
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            data: "0xdeadbeef",
            valueAmount: "1",
            valueUnit: "gwei",
        });

        expect(executableOf(prepared)).toEqual({
            to: ethers.getAddress(TARGET),
            data: "0xdeadbeef",
            value: ethers.parseUnits("1", "gwei").toString(),
        });
    });

    it("keeps authoring metadata outside the executable payload", () => {
        const prepared = prepareRawCall({
            target: TARGET,
            account: ACCOUNT,
            chainId: "1",
            data: "0x",
            valueAmount: "",
            valueUnit: "wei",
        });

        const executable = executableOf(prepared);
        expect(executable).not.toHaveProperty("editor");
        expect(executable).not.toHaveProperty("display");
        expect(executable).not.toHaveProperty("decoderAbi");
        expect(executable.value).toEqual("0");
    });
});
