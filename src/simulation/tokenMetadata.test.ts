import { ethers } from "ethers";
import { SimulationRpcTransport } from "./types";
import { TOKEN_METADATA_STORAGE_KEY, tokenMetadataKey, TokenMetadataService } from "./tokenMetadata";

const TOKEN = "0x0000000000000000000000000000000000000010";
const OTHER_TOKEN = "0x0000000000000000000000000000000000000020";
const coder = ethers.AbiCoder.defaultAbiCoder();
const selectors = {
    name: ethers.id("name()").slice(0, 10),
    symbol: ethers.id("symbol()").slice(0, 10),
    decimals: ethers.id("decimals()").slice(0, 10),
};

function memoryStorage(initial?: string) {
    const entries = new Map<string, string>();
    if (initial !== undefined) entries.set(TOKEN_METADATA_STORAGE_KEY, initial);
    return {
        getItem: jest.fn((key: string) => entries.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => entries.set(key, value)),
        removeItem: jest.fn((key: string) => entries.delete(key)),
    };
}

function metadataTransport(overrides: Partial<Record<keyof typeof selectors, unknown>> = {}) {
    const values = {
        name: coder.encode(["string"], ["USD Coin"]),
        symbol: coder.encode(["string"], ["USDC"]),
        decimals: coder.encode(["uint8"], [6]),
        ...overrides,
    };
    const send = jest.fn(async (_method: string, params: unknown[]) => {
        const [{data}] = params as [{data: string}, string];
        const entry = (Object.entries(selectors) as Array<[keyof typeof selectors, string]>).find(([, selector]) => selector === data);
        if (!entry) throw new Error("Unknown selector");
        const value = values[entry[0]];
        if (value instanceof Error) throw value;
        return value;
    });
    return {transport: {send} as SimulationRpcTransport, send};
}

describe("TokenMetadataService", () => {
    it("resolves metadata once and restores it from session storage", async () => {
        const storage = memoryStorage();
        const firstTransport = metadataTransport();
        const first = new TokenMetadataService(storage, () => 100);
        await expect(first.resolve("1", [TOKEN], "0x64", firstTransport.transport)).resolves.toEqual({
            [tokenMetadataKey("1", TOKEN)]: {
                chainId: "1",
                address: TOKEN,
                name: "USD Coin",
                symbol: "USDC",
                decimals: 6,
                fetchedAtBlock: "0x64",
            },
        });
        expect(firstTransport.send).toHaveBeenCalledTimes(3);

        const restoredTransport = metadataTransport();
        const restored = new TokenMetadataService(storage, () => 200);
        await restored.resolve("1", [TOKEN], "0x65", restoredTransport.transport);
        expect(restoredTransport.send).not.toHaveBeenCalled();
        expect(restored.getCached("1", TOKEN)?.fetchedAtBlock).toBe("0x64");
    });

    it("supports bytes32 text and tolerates optional metadata failures", async () => {
        const {transport} = metadataTransport({
            name: new Error("missing"),
            symbol: coder.encode(["bytes32"], [ethers.encodeBytes32String("LEGACY")]),
        });
        const service = new TokenMetadataService(null, () => 100);
        const result = await service.resolve("1", [TOKEN], "0x64", transport);
        expect(result[tokenMetadataKey("1", TOKEN)]).toEqual({
            chainId: "1", address: TOKEN, symbol: "LEGACY", decimals: 6, fetchedAtBlock: "0x64",
        });
    });

    it("deduplicates concurrent requests and isolates addresses by chain", async () => {
        const {transport, send} = metadataTransport();
        const service = new TokenMetadataService(null, () => 100);
        await Promise.all([
            service.resolve("1", [TOKEN, TOKEN], "0x64", transport),
            service.resolve("1", [TOKEN], "0x64", transport),
        ]);
        expect(send).toHaveBeenCalledTimes(3);

        await service.resolve("10", [TOKEN], "0x64", transport);
        expect(send).toHaveBeenCalledTimes(6);
        expect(service.getCached("1", TOKEN)?.chainId).toBe("1");
        expect(service.getCached("10", TOKEN)?.chainId).toBe("10");
    });

    it("briefly caches failures and retries after one hour", async () => {
        let now = 100;
        const failed = metadataTransport({decimals: "0x"});
        const service = new TokenMetadataService(null, () => now);
        await expect(service.resolve("1", [TOKEN], "0x64", failed.transport)).resolves.toEqual({});
        await service.resolve("1", [TOKEN], "0x64", failed.transport);
        expect(failed.send).toHaveBeenCalledTimes(3);

        now += 60 * 60 * 1000 + 1;
        const recovered = metadataTransport();
        await expect(service.resolve("1", [TOKEN], "0x65", recovered.transport)).resolves.toHaveProperty(tokenMetadataKey("1", TOKEN));
        expect(recovered.send).toHaveBeenCalledTimes(3);
    });

    it("discards malformed storage and skips invalid addresses", async () => {
        const storage = memoryStorage("not-json");
        const service = new TokenMetadataService(storage, () => 100);
        expect(storage.removeItem).toHaveBeenCalledWith(TOKEN_METADATA_STORAGE_KEY);
        const {transport, send} = metadataTransport();
        await expect(service.resolve("1", ["invalid"], "0x64", transport)).resolves.toEqual({});
        expect(send).not.toHaveBeenCalled();
    });

    it("resolves multiple unique token addresses", async () => {
        const {transport, send} = metadataTransport();
        const service = new TokenMetadataService(null, () => 100);
        const result = await service.resolve("1", [TOKEN, OTHER_TOKEN], "0x64", transport);
        expect(Object.keys(result)).toHaveLength(2);
        expect(send).toHaveBeenCalledTimes(6);
    });

    it("bounds restored session caches to the 500 most recently used entries", () => {
        const entries = Array.from({length: 501}, (_, index) => {
            const address = ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(index + 1), 20));
            return {
                status: "success",
                metadata: {chainId: "1", address, symbol: `T${index}`, decimals: 18, fetchedAtBlock: "0x64"},
                accessedAt: index,
            };
        });
        const storage = memoryStorage(JSON.stringify(entries));
        const service = new TokenMetadataService(storage, () => 1000);
        const persisted = JSON.parse(storage.setItem.mock.calls.at(-1)![1]) as unknown[];
        expect(persisted).toHaveLength(500);
        expect(service.getCached("1", entries[0].metadata.address)).toBeUndefined();
        expect(service.getCached("1", entries[500].metadata.address)).toBeDefined();
    });
});
