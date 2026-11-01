import { ethers } from "ethers";

/**
 * The subset of the Safe account interface Intereth needs to verify a Safe and
 * track its execution state. Reading these directly keeps the Safe Protocol Kit
 * out of the selection path: the kit is a large lazy chunk that is only needed
 * when a Safe transaction is actually created.
 */
const SAFE_ACCOUNT_INTERFACE = new ethers.Interface([
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
    "function nonce() view returns (uint256)",
    "function VERSION() view returns (string)",
]);

export interface SafeAccountDetails {
    owners: string[];
    threshold: number;
    nonce: number;
    version: string | null;
}

export interface SafeCallProvider {
    getCode(address: string): Promise<string>;
    call(tx: {to: string; data: string}): Promise<string>;
}

function notASafe(message: string) {
    return Object.assign(new Error(message), {code: "NOT_A_SAFE"});
}

async function readSafeFunction(
    provider: SafeCallProvider,
    address: string,
    functionName: "getOwners" | "getThreshold" | "nonce" | "VERSION",
) {
    const data = SAFE_ACCOUNT_INTERFACE.encodeFunctionData(functionName);
    return SAFE_ACCOUNT_INTERFACE.decodeFunctionResult(functionName, await provider.call({to: address, data}));
}

/**
 * Reads a Safe's owner configuration in one parallel round trip. Legacy Safes
 * without `VERSION()` are still valid; they report a null version, mirroring
 * how the protocol kit fell back to its default version.
 */
export async function readSafeAccount(provider: SafeCallProvider, address: string): Promise<SafeAccountDetails> {
    if (!ethers.isAddress(address)) {
        throw Object.assign(new Error("Enter a valid Safe address."), {code: "INVALID_ARGUMENT"});
    }
    const safeAddress = ethers.getAddress(address);
    const [code, owners, threshold, nonce, version] = await Promise.allSettled([
        provider.getCode(safeAddress),
        readSafeFunction(provider, safeAddress, "getOwners"),
        readSafeFunction(provider, safeAddress, "getThreshold"),
        readSafeFunction(provider, safeAddress, "nonce"),
        readSafeFunction(provider, safeAddress, "VERSION"),
    ]);

    if (code.status === "fulfilled" && (!code.value || code.value === "0x")) {
        throw notASafe("The selected address has no contract code on the connected network.");
    }
    if (owners.status === "rejected" || threshold.status === "rejected" || nonce.status === "rejected") {
        throw notASafe("The selected address does not implement the Safe account interface on the connected network.");
    }

    const parsedOwners = (owners.value[0] as string[]).filter((owner) => ethers.isAddress(owner)).map(ethers.getAddress);
    const thresholdValue = threshold.value[0] as bigint;
    const nonceValue = nonce.value[0] as bigint;
    if (parsedOwners.length === 0 || thresholdValue < 1n || thresholdValue > BigInt(parsedOwners.length)) {
        throw notASafe("The selected address returned an invalid Safe owner configuration.");
    }
    if (nonceValue < 0n || !Number.isSafeInteger(Number(nonceValue))) {
        throw notASafe("The selected address returned an invalid Safe nonce.");
    }

    return {
        owners: parsedOwners,
        threshold: Number(thresholdValue),
        nonce: Number(nonceValue),
        version: version.status === "fulfilled" ? String(version.value[0]) : null,
    };
}
