import { FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { ethers } from "ethers";

export const VALUE_UNITS = [
    { label: "ETH", value: "ether" },
    { label: "gwei", value: "gwei" },
    { label: "wei", value: "wei" },
] as const;

type ValueUnit = (typeof VALUE_UNITS)[number]["value"];

interface TransactionValueInputProps {
    amount: string;
    unit: ValueUnit;
    onAmountChange: (amount: string) => void;
    onUnitChange: (unit: ValueUnit) => void;
    label?: string;
    helperText?: string;
}

export function toWeiValue(amount: string, unit: ValueUnit) {
    const trimmed = amount.trim();
    if (trimmed === "") {
        return ethers.parseUnits("0", unit);
    }
    return ethers.parseUnits(trimmed, unit);
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
                <TextField
                    label="Amount"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="0.05"
                    sx={{
                        "& .MuiInputBase-root": {
                            backgroundColor: "rgba(255,255,255,0.9)",
                        },
                    }}
                />
                <FormControl sx={{minWidth: {xs: "100%", sm: 132}}} size="small">
                    <InputLabel>Unit</InputLabel>
                    <Select
                        value={unit}
                        label="Unit"
                        onChange={(e) => onUnitChange(e.target.value as ValueUnit)}
                        sx={{backgroundColor: "rgba(255,255,255,0.9)"}}
                    >
                        {VALUE_UNITS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                {helperText}
            </Typography>
        </Stack>
    );
}
