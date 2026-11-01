import { ethers } from "ethers";
import {
    MAX_SAVED_ABI_LENGTH,
    MAX_SAVED_CONTRACTS,
    SAVED_CONTRACTS_KEY,
    SavedContract,
    readSavedContracts,
    removeSavedContractEntry,
    savedContractKey,
    upsertSavedContract,
    writeSavedContracts,
} from "./savedContracts";

const ADDRESS = "0x0000000000000000000000000000000000000010";
const ABI = new ethers.Interface(["function balanceOf(address account) view returns (uint256)"]).formatJson();

function entry(overrides: Partial<SavedContract> = {}): SavedContract {
    return {
        version: 1,
        id: overrides.id ?? "saved-1",
        label: overrides.label ?? "Saved token",
        address: overrides.address ?? ADDRESS,
        chainId: overrides.chainId ?? "1",
        abi: overrides.abi ?? ABI,
        access: overrides.access ?? "read-only",
        savedAt: overrides.savedAt ?? 1,
        ...(overrides.provider ? {provider: overrides.provider} : {}),
    };
}

function address(index: number) {
    return ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(index), 20));
}

describe("savedContracts", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("round-trips saved contracts and updates duplicates by chain and address", () => {
        const first = entry({savedAt: 1});
        expect(writeSavedContracts([first])).toBe(true);
        expect(readSavedContracts()).toEqual([first]);

        const updated = entry({label: "Updated token", savedAt: 2});
        const next = upsertSavedContract(readSavedContracts(), updated);
        expect(writeSavedContracts(next)).toBe(true);
        expect(readSavedContracts()).toEqual([updated]);
    });

    it("drops malformed entries instead of partially loading them", () => {
        window.localStorage.setItem(SAVED_CONTRACTS_KEY, JSON.stringify([
            entry(),
            entry({address: "not-an-address"}),
            entry({chainId: "1.5"}),
            entry({abi: "not-json"}),
            entry({abi: JSON.stringify({not: "an array"})}),
            entry({provider: {label: "Wrong chain", url: "https://rpc.example", chainId: "10"}}),
            entry({access: "wallet", provider: {label: "Ignored", url: "https://rpc.example", chainId: "1"}}),
        ]));

        expect(readSavedContracts()).toEqual([entry({access: "wallet"})]);
    });

    it("caps stored entries and ABI size", () => {
        const entries = Array.from({length: MAX_SAVED_CONTRACTS + 5}, (_, index) => entry({
            id: `saved-${index}`,
            address: address(index + 1),
            savedAt: index + 1,
        }));
        const capped = upsertSavedContract([], entries[0]);
        const all = entries.reduce((current, candidate) => upsertSavedContract(current, candidate), capped);
        expect(all).toHaveLength(MAX_SAVED_CONTRACTS);
        expect(all[0].address).toBe(address(MAX_SAVED_CONTRACTS + 5));

        expect(upsertSavedContract([], entry({abi: "x".repeat(MAX_SAVED_ABI_LENGTH + 1)}))).toEqual([]);
    });

    it("keeps storage failures in memory and exposes key helpers", () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota exceeded");
        });
        try {
            expect(writeSavedContracts([entry()])).toBe(false);
        } finally {
            setItem.mockRestore();
        }

        expect(savedContractKey(entry())).toBe(`1:${ADDRESS.toLowerCase()}`);
        expect(removeSavedContractEntry([entry()], entry())).toEqual([]);
    });

    it("ignores malformed storage payloads", () => {
        window.localStorage.setItem(SAVED_CONTRACTS_KEY, "{");
        expect(readSavedContracts()).toEqual([]);
        window.localStorage.setItem(SAVED_CONTRACTS_KEY, JSON.stringify({not: "an array"}));
        expect(readSavedContracts()).toEqual([]);
    });

    it("normalizes checksummed addresses and chain IDs", () => {
        const lowerAddress = ADDRESS.toLowerCase();
        const raw = entry({address: lowerAddress, chainId: "0001"});
        const next = upsertSavedContract([], raw);
        expect(next[0]?.address).toBe(ADDRESS);
        expect(next[0]?.chainId).toBe("1");
    });
});
