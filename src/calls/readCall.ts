import { ethers } from "ethers";
import { buildParamValues, ParamValue } from "./parameters";

export function encodeFunctionRead(fragment: ethers.FunctionFragment, values: ParamValue[]) {
    const args = buildParamValues(fragment.inputs, values);
    const iface = new ethers.Interface([fragment]);
    return {
        args,
        data: iface.encodeFunctionData(fragment, args),
    };
}

export function decodeFunctionRead(fragment: ethers.FunctionFragment, returnData: string) {
    const decoded = new ethers.Interface([fragment]).decodeFunctionResult(fragment, returnData);
    if (fragment.outputs.length === 0) return undefined;
    if (fragment.outputs.length === 1) return decoded[0];
    return decoded;
}

export function normalizeReadData(data: string) {
    const callData = data.trim() || "0x";
    try {
        ethers.dataLength(callData);
        return ethers.hexlify(ethers.getBytes(callData));
    } catch {
        throw Object.assign(new Error("Calldata must be a valid even-length hexadecimal value prefixed with 0x."), {code: "INVALID_ARGUMENT"});
    }
}
