import { ethers } from "ethers";

export interface SavedSafeAddress {
    address: string;
    chainId: string;
}

const SAVED_SAFES_KEY = "intereth.saved-safes";
const ACTIVE_SAFE_KEY = "intereth.active-safe";
const LEGACY_SAFE_KEY = "intereth.selected-safe";

function normalizeEntry(value: unknown): SavedSafeAddress | null {
    if (!value || typeof value !== "object") return null;
    const entry = value as {address?: unknown; chainId?: unknown};
    if (typeof entry.address !== "string" || !ethers.isAddress(entry.address)
        || typeof entry.chainId !== "string" || !/^\d+$/.test(entry.chainId)) return null;
    return {address: ethers.getAddress(entry.address), chainId: BigInt(entry.chainId).toString()};
}

export function safeAddressKey(entry: SavedSafeAddress) {
    return `${BigInt(entry.chainId).toString()}:${entry.address.toLowerCase()}`;
}

export function readSavedSafes(): SavedSafeAddress[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = JSON.parse(window.localStorage.getItem(SAVED_SAFES_KEY) ?? "[]") as unknown;
        const entries = Array.isArray(raw) ? raw.map(normalizeEntry).filter((entry): entry is SavedSafeAddress => entry !== null) : [];
        // Migrate the prior single-Safe setting into the address book.
        const legacy = normalizeEntry(JSON.parse(window.localStorage.getItem(LEGACY_SAFE_KEY) ?? "null"));
        const byKey = new Map(entries.map((entry) => [safeAddressKey(entry), entry]));
        if (legacy) byKey.set(safeAddressKey(legacy), legacy);
        const merged = [...byKey.values()];
        if (merged.length !== entries.length) {
            try { window.localStorage.setItem(SAVED_SAFES_KEY, JSON.stringify(merged)); } catch { /* still return entries in memory */ }
        }
        return merged;
    } catch {
        return [];
    }
}

export function writeSavedSafes(entries: SavedSafeAddress[]) {
    try {
        window.localStorage.setItem(SAVED_SAFES_KEY, JSON.stringify(entries));
    } catch {
        // Keep the in-memory address book usable when browser storage is unavailable.
    }
}

export function readActiveSafe(): SavedSafeAddress | null {
    if (typeof window === "undefined") return null;
    try {
        const current = normalizeEntry(JSON.parse(window.localStorage.getItem(ACTIVE_SAFE_KEY) ?? "null"));
        if (current) return current;
        const legacy = normalizeEntry(JSON.parse(window.localStorage.getItem(LEGACY_SAFE_KEY) ?? "null"));
        if (legacy) {
            window.localStorage.setItem(ACTIVE_SAFE_KEY, JSON.stringify(legacy));
            window.localStorage.removeItem(LEGACY_SAFE_KEY);
        }
        return legacy;
    } catch {
        return null;
    }
}

export function writeActiveSafe(entry: SavedSafeAddress | null) {
    try {
        if (entry) window.localStorage.setItem(ACTIVE_SAFE_KEY, JSON.stringify(entry));
        else window.localStorage.removeItem(ACTIVE_SAFE_KEY);
        window.localStorage.removeItem(LEGACY_SAFE_KEY);
    } catch {
        // Active Safe state still works for the current session.
    }
}
