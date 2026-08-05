import { ethers } from "ethers";

export type ValueUnit = "ether" | "gwei" | "wei";

export interface NumericValue {
    amount: string;
    unit: ValueUnit;
}

export type ParamValue = string | NumericValue | ParamValue[];

export function createNumericValue(): NumericValue {
    return {amount: "", unit: "wei"};
}

export function isNumericValue(value: ParamValue): value is NumericValue {
    return typeof value === "object" && value !== null && !Array.isArray(value) && "amount" in value && "unit" in value;
}

export function serializeNumericValue(value: NumericValue, emptyAsZero = false) {
    const trimmed = value.amount.trim();
    if (trimmed === "") {
        return emptyAsZero ? ethers.parseUnits("0", value.unit) : ethers.parseUnits("", value.unit);
    }
    return ethers.parseUnits(trimmed, value.unit);
}

export function toWeiValue(amount: string, unit: ValueUnit) {
    const trimmed = amount.trim();
    return ethers.parseUnits(trimmed === "" ? "0" : trimmed, unit);
}

export function createEmptyParamValue(param: ethers.ParamType): ParamValue {
    if (param.baseType === "tuple") {
        return (param.components ?? []).map((component) => createEmptyParamValue(component));
    }

    if (param.baseType === "array") {
        const child = param.arrayChildren;
        const initialLength = param.arrayLength && param.arrayLength > 0 ? param.arrayLength : 1;
        return Array.from({length: initialLength}, () => createEmptyParamValue(child as ethers.ParamType));
    }

    if (/^uint\d*$/.test(param.type)) {
        return createNumericValue();
    }

    return "";
}

export function buildParamValue(param: ethers.ParamType, value: ParamValue): unknown {
    if (/^uint\d*$/.test(param.type)) {
        const numericValue = isNumericValue(value) ? value : createNumericValue();
        return serializeNumericValue(numericValue, false);
    }

    if (param.baseType === "tuple") {
        const children = Array.isArray(value) ? value : [];
        return (param.components ?? []).map((component, index) => buildParamValue(component, children[index] ?? createEmptyParamValue(component)));
    }

    if (param.baseType === "array") {
        const child = param.arrayChildren as ethers.ParamType;
        const children = Array.isArray(value) ? value : [];
        return children.map((childValue) => buildParamValue(child, childValue ?? createEmptyParamValue(child)));
    }

    return typeof value === "string" ? value : "";
}

export function buildParamValues(params: readonly ethers.ParamType[], values: ParamValue[]) {
    return params.map((param, index) => buildParamValue(param, values[index] ?? createEmptyParamValue(param)));
}

export function cloneParamValues(values: ParamValue[]): ParamValue[] {
    return JSON.parse(JSON.stringify(values)) as ParamValue[];
}
