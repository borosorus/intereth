import { Stack } from "@mui/material";
import { ethers } from "ethers";
import { useMemo } from "react";
import { buildParamValues, ParamValue, ValueUnit } from "../calls/parameters";
import CopyButton from "./CopyButton";
import ParamInput from "./ParamInput";
import TransactionValueInput from "./TransactionValueInput";

interface FunctionCallEditorProps {
    fragment: ethers.FunctionFragment;
    arguments: ParamValue[];
    onArgumentsChange: (argumentsValue: ParamValue[]) => void;
    valueAmount: string;
    valueUnit: ValueUnit;
    onValueAmountChange: (amount: string) => void;
    onValueUnitChange: (unit: ValueUnit) => void;
}

export default function FunctionCallEditor({
    fragment,
    arguments: argumentValues,
    onArgumentsChange,
    valueAmount,
    valueUnit,
    onValueAmountChange,
    onValueUnitChange,
}: FunctionCallEditorProps) {
    const calldata = useMemo(() => {
        try {
            const values = buildParamValues(fragment.inputs, argumentValues);
            return new ethers.Interface([fragment]).encodeFunctionData(fragment, values);
        } catch {
            return null;
        }
    }, [argumentValues, fragment]);

    return (
        <Stack spacing={1.5}>
            {fragment.inputs.map((input, index) => (
                <ParamInput
                    key={`${input.name || input.type}-${index}`}
                    param={input}
                    value={argumentValues[index]}
                    onChange={(value) => {
                        onArgumentsChange(argumentValues.map((item, itemIndex) => itemIndex === index ? value : item));
                    }}
                    label={input.name || `Input ${index + 1}`}
                />
            ))}
            {fragment.stateMutability === "payable" && (
                <TransactionValueInput
                    amount={valueAmount}
                    unit={valueUnit}
                    onAmountChange={onValueAmountChange}
                    onUnitChange={onValueUnitChange}
                    label="Transaction value"
                />
            )}
            <CopyButton
                value={calldata ?? ""}
                label="Copy calldata"
                variant="text"
                disabled={!calldata}
            />
        </Stack>
    );
}
