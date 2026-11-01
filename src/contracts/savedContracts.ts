import { ethers } from "ethers";
import { ProviderDetails } from "../presets";

export type SavedContractAccess = "read-only" | "wallet";

export interface SavedContract {
    version: 1;
    id: string;
    label: string;
    address: string;
    chainId: string;
    abi: string;
    access: SavedContractAccess;
    provider?: ProviderDetails;
    savedAt: number;
}

export const SAVED_CONTRACTS_KEY = "intereth.saved-contracts";
export const MAX_SAVED_CONTRACTS = 50;
export const MAX_SAVED_ABI_LENGTH = 512_000;
const MAX_LABEL_LENGTH = 120;
const MAX_PROVIDER_URL_LENGTH = 2048;

function normalizedChainId(value: unknown): string | null {
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
    try {
        return BigInt(value).toString();
    } catch {
        return null;
    }
}

function normalizedProvider(value: unknown, chainId: string): ProviderDetails | null {
    if (!value || typeof value !== "object") return null;
    const provider = value as {label?: unknown; url?: unknown; chainId?: unknown};
    if (typeof provider.label !== "string" || !provider.label.trim() || provider.label.length > MAX_LABEL_LENGTH) return null;
    if (typeof provider.url !== "string" || provider.url.length > MAX_PROVIDER_URL_LENGTH) return null;
    try {
        const url = new URL(provider.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    } catch {
        return null;
    }
    const providerChainId = normalizedChainId(provider.chainId);
    if (!providerChainId || providerChainId !== chainId) return null;
    return {label: provider.label.trim(), url: provider.url, chainId};
}

function normalizedAbi(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_SAVED_ABI_LENGTH) return null;
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) return null;
        new ethers.Interface(parsed);
        return value;
    } catch {
        return null;
    }
}

function normalizeEntry(value: unknown): SavedContract | null {
    if (!value || typeof value !== "object") return null;
    const entry = value as {
        version?: unknown;
        id?: unknown;
        label?: unknown;
        address?: unknown;
        chainId?: unknown;
        abi?: unknown;
        access?: unknown;
        provider?: unknown;
        savedAt?: unknown;
    };
    if (entry.version !== 1
        || typeof entry.id !== "string" || entry.id.length === 0 || entry.id.length > 100
        || typeof entry.label !== "string" || !entry.label.trim() || entry.label.length > MAX_LABEL_LENGTH
        || typeof entry.address !== "string" || !ethers.isAddress(entry.address)
        || (entry.access !== "read-only" && entry.access !== "wallet")
        || typeof entry.savedAt !== "number" || !Number.isFinite(entry.savedAt) || entry.savedAt < 0) {
        return null;
    }
    const chainId = normalizedChainId(entry.chainId);
    const abi = normalizedAbi(entry.abi);
    if (!chainId || !abi) return null;

    const provider = entry.access === "read-only"
        ? (entry.provider === undefined ? undefined : normalizedProvider(entry.provider, chainId))
        : undefined;
    if (entry.access === "read-only" && entry.provider !== undefined && provider === null) return null;

    return {
        version: 1,
        id: entry.id,
        label: entry.label.trim(),
        address: ethers.getAddress(entry.address),
        chainId,
        abi,
        access: entry.access,
        ...(provider ? {provider} : {}),
        savedAt: entry.savedAt,
    };
}

export function savedContractKey(entry: Pick<SavedContract, "chainId" | "address">) {
    return `${entry.chainId}:${entry.address.toLowerCase()}`;
}

export function readSavedContracts(): SavedContract[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = JSON.parse(window.localStorage.getItem(SAVED_CONTRACTS_KEY) ?? "[]") as unknown;
        const parsed = Array.isArray(raw)
            ? raw.map(normalizeEntry).filter((entry): entry is SavedContract => entry !== null)
            : [];
        const byKey = new Map<string, SavedContract>();
        for (const entry of parsed) byKey.set(savedContractKey(entry), entry);
        const entries = [...byKey.values()]
            .sort((left, right) => right.savedAt - left.savedAt)
            .slice(0, MAX_SAVED_CONTRACTS);
        if (entries.length !== parsed.length) {
            try { window.localStorage.setItem(SAVED_CONTRACTS_KEY, JSON.stringify(entries)); } catch { /* return cleaned entries in memory */ }
        }
        return entries;
    } catch {
        return [];
    }
}

export function writeSavedContracts(entries: SavedContract[]): boolean {
    if (typeof window === "undefined") return false;
    try {
        window.localStorage.setItem(SAVED_CONTRACTS_KEY, JSON.stringify(entries));
        return true;
    } catch {
        return false;
    }
}

export function upsertSavedContract(entries: SavedContract[], entry: SavedContract): SavedContract[] {
    const normalized = normalizeEntry(entry);
    if (!normalized) return entries;
    const key = savedContractKey(normalized);
    return [normalized, ...entries.filter((candidate) => savedContractKey(candidate) !== key)]
        .sort((left, right) => right.savedAt - left.savedAt)
        .slice(0, MAX_SAVED_CONTRACTS);
}

export function removeSavedContractEntry(entries: SavedContract[], entry: SavedContract): SavedContract[] {
    const key = savedContractKey(entry);
    return entries.filter((candidate) => savedContractKey(candidate) !== key);
}
