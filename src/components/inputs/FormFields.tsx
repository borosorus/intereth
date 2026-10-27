import { FormControl, FormHelperText, Select, Stack, TextField, Typography } from "@mui/material";
import type { SelectProps, TextFieldProps } from "@mui/material";
import { useId, type ReactNode } from "react";
import { monoFont } from "../../ui/theme";

type TextInputProps = Omit<TextFieldProps, "label"> & {
    label: string;
    optional?: boolean;
    technical?: boolean;
};

export function TextInput({label, optional = false, technical = false, id, sx, ...props}: TextInputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const labelId = `${inputId}-label`;
    const inputSx = technical
        ? [
            {"& .MuiInputBase-input": {fontFamily: monoFont}},
            ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
        ]
        : sx;

    return (
        <Stack spacing={0.5} sx={{minWidth: 0, width: props.fullWidth ? "100%" : undefined}}>
            <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{minWidth: 0}}>
                <Typography id={labelId} component="label" htmlFor={inputId} variant="body2" sx={{fontWeight: 700, lineHeight: 1.35}}>
                    {label}
                </Typography>
                {optional && <Typography variant="caption" color="text.secondary">Optional</Typography>}
            </Stack>
            <TextField
                {...props}
                id={inputId}
                label={undefined}
                aria-labelledby={labelId}
                variant="outlined"
                sx={inputSx}
            />
        </Stack>
    );
}

type SelectInputProps<T> = Omit<SelectProps<T>, "label" | "variant"> & {
    label: string;
    optional?: boolean;
    helperText?: ReactNode;
};

export function SelectInput<T = string>({label, optional = false, helperText, id, sx, children, ...props}: SelectInputProps<T>) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const labelId = `${selectId}-label`;
    const helperId = `${selectId}-helper`;

    return (
        <Stack spacing={0.5} sx={{minWidth: 0, width: "100%"}}>
            <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{minWidth: 0}}>
                <Typography id={labelId} component="label" htmlFor={selectId} variant="body2" sx={{fontWeight: 700, lineHeight: 1.35}}>
                    {label}
                </Typography>
                {optional && <Typography variant="caption" color="text.secondary">Optional</Typography>}
            </Stack>
            <FormControl fullWidth error={props.error} disabled={props.disabled} sx={{minWidth: 0}}>
                <Select<T>
                    {...props}
                    id={selectId}
                    labelId={labelId}
                    aria-labelledby={labelId}
                    aria-describedby={helperText ? helperId : undefined}
                    variant="outlined"
                    sx={sx}
                >
                    {children}
                </Select>
                {helperText && <FormHelperText id={helperId}>{helperText}</FormHelperText>}
            </FormControl>
        </Stack>
    );
}
