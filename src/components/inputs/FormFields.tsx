import { Box, FormControl, FormHelperText, ListSubheader, Select, Stack, TextField, Typography } from "@mui/material";
import type { SelectProps, TextFieldProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useId, type ReactNode } from "react";
import { dropdownGroupLabelSx, dropdownMenuPaperSx, monoFont } from "../../ui/styles";

type TextInputProps = Omit<TextFieldProps, "label"> & {
    label: string;
    optional?: boolean;
    technical?: boolean;
};

function FieldLabel({id, htmlFor, label, optional, hidden = false}: {id: string; htmlFor: string; label: string; optional: boolean; hidden?: boolean}) {
    return (
        <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{minWidth: 0}}>
            <Typography
                id={id}
                component="label"
                htmlFor={htmlFor}
                variant="body2"
                sx={hidden
                    ? {position: "absolute", width: "1px", height: "1px", p: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0}
                    : {fontWeight: 700, lineHeight: 1.35}}
            >
                {label}
            </Typography>
            {!hidden && optional && <Typography variant="caption" color="text.secondary">Optional</Typography>}
        </Stack>
    );
}

export function DropdownGroupLabel({children}: {children: ReactNode}) {
    return (
        <ListSubheader disableSticky sx={dropdownGroupLabelSx}>
            {children}
        </ListSubheader>
    );
}

export function DropdownOptionContent({primary, secondary, icon, metadata}: {
    primary: ReactNode;
    secondary?: ReactNode;
    icon?: ReactNode;
    metadata?: ReactNode;
}) {
    return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{width: "100%", minWidth: 0}}>
            {icon}
            <Box sx={{minWidth: 0, flex: 1}}>
                <Typography variant="body2" sx={{fontWeight: secondary ? 700 : 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                    {primary}
                </Typography>
                {secondary && <Typography variant="caption" color="text.secondary" sx={{display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{secondary}</Typography>}
            </Box>
            {metadata && <Box sx={{flex: "0 0 auto"}}>{metadata}</Box>}
        </Stack>
    );
}

function combineSx(base: SxProps<Theme>, additional?: SxProps<Theme>): SxProps<Theme> {
    return additional ? [base, ...(Array.isArray(additional) ? additional : [additional])] : base;
}

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
            <FieldLabel id={labelId} htmlFor={inputId} label={label} optional={optional} />
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

export type SelectInputProps<T> = Omit<SelectProps<T>, "label" | "variant"> & {
    label: string;
    optional?: boolean;
    visuallyHiddenLabel?: boolean;
    helperText?: ReactNode;
};

export function SelectControl<T = string>({label, optional = false, visuallyHiddenLabel = false, helperText, id, sx, children, MenuProps: callerMenuProps, ...props}: SelectInputProps<T>) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const labelId = `${selectId}-label`;
    const helperId = `${selectId}-helper`;

    return (
        <Stack spacing={0.5} sx={{minWidth: 0, width: "100%"}}>
            <FieldLabel id={labelId} htmlFor={selectId} label={label} optional={optional} hidden={visuallyHiddenLabel} />
            <FormControl fullWidth error={props.error} disabled={props.disabled} sx={{minWidth: 0}}>
                <Select<T>
                    {...props}
                    id={selectId}
                    labelId={labelId}
                    aria-labelledby={labelId}
                    aria-describedby={helperText ? helperId : undefined}
                    variant="outlined"
                    sx={sx}
                    MenuProps={{
                        anchorOrigin: {vertical: "bottom", horizontal: "left"},
                        transformOrigin: {vertical: "top", horizontal: "left"},
                        ...callerMenuProps,
                        PaperProps: {
                            ...callerMenuProps?.PaperProps,
                            sx: combineSx(dropdownMenuPaperSx, callerMenuProps?.PaperProps?.sx),
                        },
                    }}
                >
                    {children}
                </Select>
                {helperText && <FormHelperText id={helperId}>{helperText}</FormHelperText>}
            </FormControl>
        </Stack>
    );
}

export function SelectInput<T = string>(props: SelectInputProps<T>) {
    return <SelectControl<T> {...props} />;
}
