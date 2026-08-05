import { Stack } from "@mui/material";
import { ethers } from "ethers";
import { ParamValue, ValueUnit } from "../calls/parameters";
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
        </Stack>
    );
}
