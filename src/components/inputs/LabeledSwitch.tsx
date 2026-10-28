import { FormControlLabel, Switch } from "@mui/material";

export default function LabeledSwitch({label, checked, onChange, disabled = false}: {
    label: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
}) {
    return (
        <FormControlLabel
            labelPlacement="start"
            control={<Switch size="small" color="secondary" checked={checked} onChange={onChange} disabled={disabled} />}
            label={label}
            sx={{
                m: 0,
                px: 1.25,
                py: 0.4,
                width: {xs: "100%", sm: "auto"},
                justifyContent: "space-between",
                gap: 1,
                border: "1px solid",
                borderColor: checked ? "rgba(79, 70, 229, 0.36)" : "divider",
                borderRadius: 2,
                bgcolor: checked ? "rgba(79, 70, 229, 0.07)" : "background.paper",
                transition: "background-color 150ms ease, border-color 150ms ease",
                "& .MuiFormControlLabel-label": {fontSize: "0.875rem", fontWeight: 600, color: "text.primary", whiteSpace: "nowrap"},
            }}
        />
    );
}
