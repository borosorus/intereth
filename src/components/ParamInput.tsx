import { Box, Button, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { ethers } from "ethers";
import TransactionValueInput, { createNumericValue, NumericValue, serializeNumericValue, toWeiValue } from "./TransactionValueInput";

export type ParamValue = string | NumericValue | ParamValue[];

interface ParamInputProps {
    param: ethers.ParamType;
    value: ParamValue;
    onChange: (value: ParamValue) => void;
    depth?: number;
    label?: string;
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

function formatFieldLabel(param: ethers.ParamType, fallback: string) {
    if (param.name) {
        return `${param.name} · ${param.type}`;
    }

    return `${fallback} · ${param.type}`;
}

function isCompositeValue(value: ParamValue): value is ParamValue[] {
    return Array.isArray(value);
}

function isNumericValue(value: ParamValue): value is NumericValue {
    return typeof value === "object" && value !== null && !Array.isArray(value) && "amount" in value && "unit" in value;
}

function getUintPreview(value: NumericValue, paramType: string) {
    try {
        const weiValue = toWeiValue(value.amount, value.unit);
        if (weiValue < BigInt(0)) {
            return {value: "", error: "Unsigned integers cannot be negative."};
        }

        const bitWidth = Number(paramType.slice(4) || "256");
        if (weiValue >= BigInt(1) << BigInt(bitWidth)) {
            return {value: "", error: `Value exceeds the ${paramType} limit.`};
        }

        return {value: weiValue.toString(), error: ""};
    } catch {
        return {value: "", error: "Enter a valid amount for the selected unit."};
    }
}

export default function ParamInput({param, value, onChange, depth = 0, label}: ParamInputProps) {
    const indent = depth * 2;
    const groupLabel = label ?? param.name ?? (param.baseType === "array" ? "Array" : "Tuple");

    if (param.baseType === "tuple") {
        const currentValue = isCompositeValue(value) ? value : [];

        return (
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    pl: 2 + indent,
                    borderRadius: 2,
                    borderLeft: "4px solid",
                    borderColor: "secondary.main",
                    backgroundColor: "rgba(255,255,255,0.65)",
                }}
            >
                <Stack spacing={1.5}>
                    <Box sx={{display: "flex", justifyContent: "space-between", gap: 2, alignItems: "baseline"}}>
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                                {groupLabel}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {param.type}
                            </Typography>
                        </Box>
                    </Box>
                    <Stack spacing={1}>
                        {(param.components ?? []).map((component, index) => (
                            <ParamInput
                                key={`${component.name || component.type}-${index}`}
                                param={component}
                                value={currentValue[index] ?? createEmptyParamValue(component)}
                                onChange={(childValue) => {
                                    const next = [...currentValue];
                                    next[index] = childValue;
                                    onChange(next);
                                }}
                                depth={depth + 1}
                                label={component.name || `Field ${index + 1}`}
                            />
                        ))}
                    </Stack>
                </Stack>
            </Paper>
        );
    }

    if (/^uint\d*$/.test(param.type)) {
        const currentValue = isNumericValue(value) ? value : createNumericValue();
        const preview = getUintPreview(currentValue, param.type);

        return (
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    pl: 2 + indent,
                    borderRadius: 2,
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                    backgroundColor: "rgba(255,255,255,0.7)",
                }}
            >
                <Stack spacing={1.25}>
                    <Box>
                        <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                            {groupLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {param.format("full")}
                        </Typography>
                    </Box>
                    <TransactionValueInput
                        amount={currentValue.amount}
                        unit={currentValue.unit}
                        onAmountChange={(amount) => onChange({ ...currentValue, amount })}
                        onUnitChange={(unit) => onChange({ ...currentValue, unit })}
                        label="Amount"
                        helperText="Default format is wei. Change the unit only if the value is easier to read in ETH or gwei."
                    />
                    <Box
                        sx={{
                            px: 1.5,
                            py: 1.25,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: preview.error ? "error.light" : "divider",
                            backgroundColor: preview.error ? "rgba(211, 47, 47, 0.04)" : "rgba(15, 23, 42, 0.035)",
                        }}
                    >
                        <Typography
                            variant="caption"
                            color={preview.error ? "error.main" : "text.secondary"}
                            sx={{display: "block", mb: 0.35, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase"}}
                        >
                            Final uint value
                        </Typography>
                        <Typography
                            variant="body2"
                            color={preview.error ? "error.main" : "text.primary"}
                            sx={{
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontWeight: 600,
                                overflowWrap: "anywhere",
                            }}
                        >
                            {preview.error || `${preview.value} wei`}
                        </Typography>
                    </Box>
                </Stack>
            </Paper>
        );
    }

    if (param.baseType === "array") {
        const child = param.arrayChildren as ethers.ParamType;
        const currentValue = isCompositeValue(value) ? value : [];
        const fixedLength = typeof param.arrayLength === "number" && param.arrayLength >= 0;
        const labelText = `${groupLabel}${fixedLength ? ` (${param.arrayLength})` : ""}`;

        const setItem = (index: number, itemValue: ParamValue) => {
            const next = [...currentValue];
            next[index] = itemValue;
            onChange(next);
        };

        const addItem = () => {
            onChange([...currentValue, createEmptyParamValue(child)]);
        };

        const removeItem = (index: number) => {
            onChange(currentValue.filter((_, itemIndex) => itemIndex !== index));
        };

        return (
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    pl: 2 + indent,
                    borderRadius: 2,
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                    backgroundColor: "rgba(255,255,255,0.6)",
                }}
            >
                <Stack spacing={1.5}>
                    <Box sx={{display: "flex", justifyContent: "space-between", gap: 2, alignItems: "baseline"}}>
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                                {labelText}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {param.type}
                            </Typography>
                        </Box>
                        {!fixedLength && (
                            <Button
                                size="small"
                                variant="text"
                                startIcon={<AddCircleOutlineIcon />}
                                onClick={addItem}
                            >
                                Add item
                            </Button>
                        )}
                    </Box>
                    {currentValue.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No items yet. Add an item to edit this array.
                        </Typography>
                    ) : (
                        <Stack spacing={1}>
                            {currentValue.map((itemValue, index) => (
                                <Paper
                                    key={index}
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        backgroundColor: "rgba(255,255,255,0.8)",
                                    }}
                                >
                                    <Stack spacing={1}>
                                        <Box sx={{display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center"}}>
                                            <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700}}>
                                                Item {index + 1}
                                            </Typography>
                                            {!fixedLength && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => removeItem(index)}
                                                    aria-label={`Remove item ${index + 1}`}
                                                >
                                                    <RemoveCircleOutlineIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Box>
                                        <ParamInput
                                            param={child}
                                            value={itemValue ?? createEmptyParamValue(child)}
                                            onChange={(childValue) => setItem(index, childValue)}
                                            depth={depth + 1}
                                            label={child.name || `Value ${index + 1}`}
                                        />
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </Stack>
            </Paper>
        );
    }

    return (
        <TextField
            label={formatFieldLabel(param, label ?? "Value")}
            helperText={param.format("full")}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            size="small"
            fullWidth
            sx={{
                "& .MuiInputBase-root": {
                    backgroundColor: "rgba(255,255,255,0.9)",
                },
            }}
        />
    );
}
