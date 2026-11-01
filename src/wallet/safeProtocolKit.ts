import type Safe from "@safe-global/protocol-kit";

export type SafeProtocolKit = Safe;

let protocolKitModule: Promise<typeof import("@safe-global/protocol-kit")> | null = null;

export function loadSafeProtocolKit() {
    protocolKitModule ??= import("@safe-global/protocol-kit");
    return protocolKitModule;
}
