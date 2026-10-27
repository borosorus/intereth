import { Box, MenuItem, Stack, Typography } from "@mui/material";
import { createNumericValue, NumericValue, serializeNumericValue, toWeiValue, ValueUnit } from "../calls/parameters";
import { SelectInput, TextInput } from "./inputs/FormFields";

export {createNumericValue, serializeNumericValue, toWeiValue};
export type {NumericValue, ValueUnit};

export const VALUE_UNITS = [
    { label: "wei", value: "wei" },
    { label: "gwei", value: "gwei" },
    { label: "ETH", value: "ether" },
] as const;

interface TransactionValueInputProps {
    amount: string;
    unit: ValueUnit;
    onAmountChange: (amount: string) => void;
    onUnitChange: (unit: ValueUnit) => void;
    label?: string;
    helperText?: string;
}

export default function TransactionValueInput({
    amount,
    unit,
    onAmountChange,
    onUnitChange,
    label = "Transaction value",
    helperText = "Used only for payable calls and raw transactions.",
}: TransactionValueInputProps) {
    return (
        <Stack spacing={0.75}>
            <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                {label}
            </Typography>
            <Stack direction={{xs: "column", sm: "row"}} spacing={1.25}>
                <TextInput
                    label="Amount"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="0.05"
                    technical
                />
                <Box sx={{width: {xs: "100%", sm: 132}, flex: "0 0 auto"}}>
                    <SelectInput<ValueUnit>
                        label="Unit"
                        size="small"
                        value={unit}
                        onChange={(e) => onUnitChange(e.target.value as ValueUnit)}
                        sx={{width: "100%"}}
                    >
                        {VALUE_UNITS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </SelectInput>
                </Box>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                {helperText}
            </Typography>
        </Stack>
    );
}
