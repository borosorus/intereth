import { Box, Button, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { ethers } from "ethers";

export type ParamValue = string | ParamValue[];

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

    return "";
}

export function buildParamValue(param: ethers.ParamType, value: ParamValue): unknown {
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
