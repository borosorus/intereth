import { ethers } from "ethers";
import { isHexData, isHexQuantity, isRecord } from "../transaction-plan/rpcValidation";
import { SimulationRpcTransport, TokenMetadata } from "./types";

export const TOKEN_METADATA_STORAGE_KEY = "intereth.token-metadata";
const FAILURE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

type MetadataStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface SuccessfulCacheEntry {
    status: "success";
    metadata: TokenMetadata;
    accessedAt: number;
}

interface FailedCacheEntry {
    status: "failure";
    chainId: string;
    address: string;
    expiresAt: number;
    accessedAt: number;
}

type CacheEntry = SuccessfulCacheEntry | FailedCacheEntry;

const metadataInterface = new ethers.Interface([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
]);

function defaultStorage(): MetadataStorage | null {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

export function tokenMetadataKey(chainId: string, address: string) {
    return `${chainId}:${address.toLowerCase()}`;
}

function cleanText(value: string, maxLength: number) {
    const cleaned = Array.from(value)
        .filter((character) => character.codePointAt(0)! >= 32 && character.codePointAt(0) !== 127)
        .join("")
        .trim();
    return cleaned.length > 0 ? cleaned.slice(0, maxLength) : undefined;
}

function decodeText(data: string, functionName: "name" | "symbol") {
    try {
        const [value] = metadataInterface.decodeFunctionResult(functionName, data);
        return cleanText(String(value), functionName === "symbol" ? 32 : 128);
    } catch {
        try {
            const [value] = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], data);
            return cleanText(ethers.decodeBytes32String(value), functionName === "symbol" ? 32 : 128);
        } catch {
            return undefined;
        }
    }
}

function decodeDecimals(data: string) {
    try {
        const [value] = metadataInterface.decodeFunctionResult("decimals", data);
        const decimals = Number(value);
        return Number.isInteger(decimals) && decimals >= 0 && decimals <= 255 ? decimals : null;
    } catch {
        return null;
    }
}

function validMetadata(value: unknown): value is TokenMetadata {
    return isRecord(value)
        && typeof value.chainId === "string"
        && /^\d+$/.test(value.chainId)
        && typeof value.address === "string"
        && ethers.isAddress(value.address)
        && (value.name === undefined || (typeof value.name === "string" && value.name.length <= 128))
        && (value.symbol === undefined || (typeof value.symbol === "string" && value.symbol.length <= 32))
        && typeof value.decimals === "number"
        && Number.isInteger(value.decimals)
        && value.decimals >= 0
        && value.decimals <= 255
        && typeof value.fetchedAtBlock === "string"
        && isHexQuantity(value.fetchedAtBlock);
}

function parseEntry(value: unknown): CacheEntry | null {
    if (!isRecord(value) || typeof value.accessedAt !== "number" || !Number.isFinite(value.accessedAt) || value.accessedAt < 0) {
        return null;
    }
    if (value.status === "success" && validMetadata(value.metadata)) {
        return {status: "success", metadata: value.metadata, accessedAt: value.accessedAt};
    }
    if (value.status === "failure"
        && typeof value.chainId === "string"
        && /^\d+$/.test(value.chainId)
        && typeof value.address === "string"
        && ethers.isAddress(value.address)
        && typeof value.expiresAt === "number"
        && Number.isFinite(value.expiresAt)
        && value.expiresAt >= 0) {
        return {
            status: "failure",
            chainId: value.chainId,
            address: ethers.getAddress(value.address),
            expiresAt: value.expiresAt,
            accessedAt: value.accessedAt,
        };
    }
    return null;
}

export class TokenMetadataService {
    private readonly cache = new Map<string, CacheEntry>();
    private readonly inFlight = new Map<string, Promise<TokenMetadata | null>>();

    constructor(
        private readonly storage: MetadataStorage | null = defaultStorage(),
        private readonly now: () => number = Date.now,
    ) {
        this.load();
    }

    getCached(chainId: string, address: string) {
        const entry = this.cache.get(tokenMetadataKey(chainId, address));
        return entry?.status === "success" ? entry.metadata : undefined;
    }

    async resolve(
        chainId: string,
        addresses: readonly string[],
        baseBlock: string,
        transport: SimulationRpcTransport,
    ): Promise<Record<string, TokenMetadata>> {
        const normalized = Array.from(new Set(addresses.flatMap((address) => {
            try {
                return [ethers.getAddress(address)];
            } catch {
                return [];
            }
        })));
        const results = await mapWithConcurrency(normalized, 4, (address) => this.resolveOne(chainId, address, baseBlock, transport));
        return Object.fromEntries(results.flatMap((metadata) => metadata
            ? [[tokenMetadataKey(metadata.chainId, metadata.address), metadata] as const]
            : []));
    }

    private resolveOne(chainId: string, address: string, baseBlock: string, transport: SimulationRpcTransport) {
        const key = tokenMetadataKey(chainId, address);
        const cached = this.cache.get(key);
        if (cached?.status === "success") return Promise.resolve(cached.metadata);
        if (cached?.status === "failure" && cached.expiresAt > this.now()) return Promise.resolve(null);
        if (cached) this.cache.delete(key);
        const current = this.inFlight.get(key);
        if (current) return current;

        const request = this.fetchMetadata(chainId, address, baseBlock, transport)
            .then((metadata) => {
                const accessedAt = this.now();
                this.cache.set(key, metadata
                    ? {status: "success", metadata, accessedAt}
                    : {status: "failure", chainId, address, expiresAt: accessedAt + FAILURE_TTL_MS, accessedAt});
                this.pruneAndSave();
                return metadata;
            })
            .finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, request);
        return request;
    }

    private async fetchMetadata(chainId: string, address: string, baseBlock: string, transport: SimulationRpcTransport) {
        const read = async (functionName: "name" | "symbol" | "decimals") => {
            const response = await transport.send("eth_call", [{
                to: address,
                data: metadataInterface.encodeFunctionData(functionName),
            }, baseBlock]);
            if (!isHexData(response)) throw new Error("Invalid token metadata response");
            return response;
        };
        const [name, symbol, decimals] = await Promise.allSettled([read("name"), read("symbol"), read("decimals")]);
        if (decimals.status !== "fulfilled") return null;
        const parsedDecimals = decodeDecimals(decimals.value);
        if (parsedDecimals === null) return null;
        const parsedName = name.status === "fulfilled" ? decodeText(name.value, "name") : undefined;
        const parsedSymbol = symbol.status === "fulfilled" ? decodeText(symbol.value, "symbol") : undefined;
        return {
            chainId,
            address,
            ...(parsedName ? {name: parsedName} : {}),
            ...(parsedSymbol ? {symbol: parsedSymbol} : {}),
            decimals: parsedDecimals,
            fetchedAtBlock: baseBlock,
        };
    }

    private load() {
        if (!this.storage) return;
        try {
            const serialized = this.storage.getItem(TOKEN_METADATA_STORAGE_KEY);
            if (!serialized) return;
            const value: unknown = JSON.parse(serialized);
            if (!Array.isArray(value)) throw new Error("Invalid metadata cache");
            const entries = value.map(parseEntry);
            if (entries.some((entry) => entry === null)) throw new Error("Invalid metadata cache");
            for (const entry of entries as CacheEntry[]) {
                const chainId = entry.status === "success" ? entry.metadata.chainId : entry.chainId;
                const address = entry.status === "success" ? entry.metadata.address : entry.address;
                const key = tokenMetadataKey(chainId, address);
                if (this.cache.has(key)) throw new Error("Duplicate metadata cache entry");
                this.cache.set(key, entry);
            }
            this.pruneAndSave();
        } catch {
            this.cache.clear();
            try {
                this.storage.removeItem(TOKEN_METADATA_STORAGE_KEY);
            } catch {
                // Storage failures must not affect simulation.
            }
        }
    }

    private pruneAndSave() {
        while (this.cache.size > MAX_CACHE_ENTRIES) {
            const oldest = Array.from(this.cache.entries()).reduce((left, right) => left[1].accessedAt <= right[1].accessedAt ? left : right);
            this.cache.delete(oldest[0]);
        }
        if (!this.storage) return;
        try {
            this.storage.setItem(TOKEN_METADATA_STORAGE_KEY, JSON.stringify(Array.from(this.cache.values())));
        } catch {
            // Storage quota and privacy-mode failures leave the memory cache usable.
        }
    }
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await mapper(items[index]);
        }
    };
    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
    return results;
}
