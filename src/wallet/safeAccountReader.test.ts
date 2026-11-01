import { ethers } from "ethers";
import { readSafeAccount, SafeCallProvider } from "./safeAccountReader";

const INTERFACE = new ethers.Interface([
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
    "function nonce() view returns (uint256)",
    "function VERSION() view returns (string)",
]);
const CODER = ethers.AbiCoder.defaultAbiCoder();
const OWNER = "0x0000000000000000000000000000000000000001";
const SECOND_OWNER = "0x0000000000000000000000000000000000000002";

type SafeFunction = "getOwners" | "getThreshold" | "nonce" | "VERSION";

const selectors: Record<SafeFunction, string> = {
    getOwners: INTERFACE.getFunction("getOwners")!.selector,
    getThreshold: INTERFACE.getFunction("getThreshold")!.selector,
    nonce: INTERFACE.getFunction("nonce")!.selector,
    VERSION: INTERFACE.getFunction("VERSION")!.selector,
};

function fakeProvider(options: {
    code?: string;
    owners?: string[];
    threshold?: bigint;
    nonce?: bigint;
    version?: string;
    failing?: SafeFunction[];
} = {}) {
    const calls: string[] = [];
    const provider: SafeCallProvider = {
        getCode: async () => options.code ?? "0x6080",
        call: async ({data}) => {
            const selector = data.slice(0, 10);
            calls.push(selector);
            if (options.failing?.some((name) => selectors[name] === selector)) {
                throw new Error("execution reverted");
            }
            if (selector === selectors.getOwners) return CODER.encode(["address[]"], [options.owners ?? [OWNER, SECOND_OWNER]]);
            if (selector === selectors.getThreshold) return CODER.encode(["uint256"], [options.threshold ?? 2n]);
            if (selector === selectors.nonce) return CODER.encode(["uint256"], [options.nonce ?? 7n]);
            if (selector === selectors.VERSION) return CODER.encode(["string"], [options.version ?? "1.4.1"]);
            throw new Error(`Unexpected Safe read: ${selector}`);
        },
    };
    return {provider, calls};
}

describe("readSafeAccount", () => {
    it("reads the owner configuration in one wave", async () => {
        const {provider, calls} = fakeProvider();

        await expect(readSafeAccount(provider, OWNER)).resolves.toEqual({
            owners: [ethers.getAddress(OWNER), ethers.getAddress(SECOND_OWNER)],
            threshold: 2,
            nonce: 7,
            version: "1.4.1",
        });
        expect(calls).toHaveLength(4);
    });

    it("accepts a legacy Safe without VERSION", async () => {
        const {provider} = fakeProvider({failing: ["VERSION"]});

        await expect(readSafeAccount(provider, OWNER)).resolves.toEqual({
            owners: [ethers.getAddress(OWNER), ethers.getAddress(SECOND_OWNER)],
            threshold: 2,
            nonce: 7,
            version: null,
        });
    });

    it("rejects a contract that does not implement the Safe interface", async () => {
        const {provider} = fakeProvider({failing: ["getOwners"]});

        await expect(readSafeAccount(provider, OWNER)).rejects.toMatchObject({
            code: "NOT_A_SAFE",
            message: expect.stringMatching(/does not implement the Safe account interface/),
        });
    });

    it("rejects an address without contract code", async () => {
        const {provider} = fakeProvider({code: "0x"});

        await expect(readSafeAccount(provider, OWNER)).rejects.toMatchObject({
            code: "NOT_A_SAFE",
            message: expect.stringMatching(/no contract code/),
        });
    });

    it("rejects an invalid owner configuration", async () => {
        const {provider} = fakeProvider({owners: [OWNER], threshold: 2n});

        await expect(readSafeAccount(provider, OWNER)).rejects.toMatchObject({
            code: "NOT_A_SAFE",
            message: expect.stringMatching(/invalid Safe owner configuration/),
        });
    });

    it("rejects an invalid address before reading", async () => {
        const {provider, calls} = fakeProvider();

        await expect(readSafeAccount(provider, "not-an-address")).rejects.toMatchObject({code: "INVALID_ARGUMENT"});
        expect(calls).toHaveLength(0);
    });
});
