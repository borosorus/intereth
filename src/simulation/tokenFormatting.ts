import { ethers } from "ethers";
import { BalanceChange, DecodedEvent, DecodedValue, TokenMetadata } from "./types";
import { tokenMetadataKey } from "./tokenMetadata";

export function metadataForToken(
    metadataByAddress: Record<string, TokenMetadata>,
    chainId: string,
    address: string | undefined,
) {
    return address ? metadataByAddress[tokenMetadataKey(chainId, address)] : undefined;
}

function signedRaw(value: bigint) {
    return value > BigInt(0) ? `+${value}` : value.toString();
}

function shortAddress(address: string) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function tokenLabel(address: string, metadata?: TokenMetadata) {
    return metadata?.symbol ?? shortAddress(address);
}

export function tokenDescription(address: string, metadata?: TokenMetadata) {
    return metadata?.name
        ? `${metadata.name} · ${metadata.symbol ?? shortAddress(address)} · ${address}`
        : address;
}

export function formatBalanceChangeAmount(change: BalanceChange, metadata?: TokenMetadata, includeRaw = false) {
    try {
        const delta = BigInt(change.delta);
        if (change.asset === "native") {
            return `${delta > BigInt(0) ? "+" : ""}${ethers.formatEther(delta)} native`;
        }
        if (!metadata) return `${signedRaw(delta)} raw units`;
        const formatted = ethers.formatUnits(delta, metadata.decimals);
        const display = `${delta > BigInt(0) ? "+" : ""}${formatted} ${tokenLabel(change.tokenAddress ?? metadata.address, metadata)}`;
        return includeRaw ? `${display} (${signedRaw(delta)} raw units)` : display;
    } catch {
        return `${change.delta} raw units`;
    }
}

export function formatEventArgument(
    event: DecodedEvent,
    argument: DecodedValue,
    metadata: TokenMetadata | undefined,
    includeRaw = false,
) {
    if (event.kind !== "erc20-transfer" || argument.name !== "value" || !metadata) return argument.value;
    try {
        const amount = ethers.formatUnits(BigInt(argument.value), metadata.decimals);
        const display = `${amount} ${tokenLabel(event.address, metadata)}`;
        return includeRaw ? `${display} (${argument.value} raw units)` : display;
    } catch {
        return argument.value;
    }
}
