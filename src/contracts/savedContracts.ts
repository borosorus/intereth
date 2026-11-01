import { ethers } from "ethers";

export interface SavedContract {
    version: 3;
    label: string;
    address: string;
    chainId: string;
    abi: string;
    savedAt: number;
}

export const SAVED_CONTRACTS_KEY = "intereth.saved-contracts";
export const MAX_SAVED_CONTRACTS = 50;
export const MAX_SAVED_ABI_LENGTH = 512_000;
export const MAX_SAVED_LABEL_LENGTH = 120;

function defaultLabel(address: string) {
    return `Contract ${address.slice(0, 8)}…${address.slice(-6)}`;
}

function normalizedLabel(value: unknown, address: string): string {
    if (typeof value !== "string") return defaultLabel(address);
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, MAX_SAVED_LABEL_LENGTH) : defaultLabel(address);
}

function normalizedChainId(value: unknown): string | null {
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
    try {
        return BigInt(value).toString();
    } catch {
        return null;
    }
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

/**
 * Reads a stored entry as the current schema. Version 1 entries also carried
 * an access mode and provider, and version 2 dropped the label; connection
 * details are discarded and a missing label falls back to the address.
 */
function normalizeEntry(value: unknown): SavedContract | null {
    if (!value || typeof value !== "object") return null;
    const entry = value as {
        version?: unknown;
        label?: unknown;
        address?: unknown;
        chainId?: unknown;
        abi?: unknown;
        savedAt?: unknown;
    };
    if ((entry.version !== 1 && entry.version !== 2 && entry.version !== 3)
        || typeof entry.address !== "string" || !ethers.isAddress(entry.address)
        || typeof entry.savedAt !== "number" || !Number.isFinite(entry.savedAt) || entry.savedAt < 0) {
        return null;
    }
    const chainId = normalizedChainId(entry.chainId);
    const abi = normalizedAbi(entry.abi);
    if (!chainId || !abi) return null;
    const address = ethers.getAddress(entry.address);

    return {
        version: 3,
        label: normalizedLabel(entry.label, address),
        address,
        chainId,
        abi,
        savedAt: entry.savedAt,
    };
}

export function savedContractKey(entry: Pick<SavedContract, "chainId" | "address">) {
    return `${entry.chainId}:${entry.address.toLowerCase()}`;
}

export function readSavedContracts(): SavedContract[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(SAVED_CONTRACTS_KEY) ?? "[]";
        const parsed = JSON.parse(raw) as unknown;
        const normalized = Array.isArray(parsed)
            ? parsed.map(normalizeEntry).filter((entry): entry is SavedContract => entry !== null)
            : [];
        const byKey = new Map<string, SavedContract>();
        for (const entry of normalized) byKey.set(savedContractKey(entry), entry);
        const entries = [...byKey.values()]
            .sort((left, right) => right.savedAt - left.savedAt)
            .slice(0, MAX_SAVED_CONTRACTS);
        // Whitelisted serialization migrates version 1 entries and removes
        // legacy labels, access modes, and provider URLs from storage.
        const serialized = JSON.stringify(entries);
        if (raw !== serialized) {
            try { window.localStorage.setItem(SAVED_CONTRACTS_KEY, serialized); } catch { /* return cleaned entries in memory */ }
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
