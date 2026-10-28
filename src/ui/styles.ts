export const monoFont = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const workspaceSurfaceSx = {
    borderRadius: 2.5,
    borderColor: "divider",
    bgcolor: "background.paper",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.035)",
};

export const nestedSurfaceSx = {
    p: 1.5,
    borderRadius: 2,
} as const;

export const dropdownMenuPaperSx = {
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "min(440px, calc(100vh - 32px))",
    boxSizing: "border-box",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.16)",
    "& .MuiList-root": {paddingTop: "6px", paddingBottom: "6px"},
} as const;

export const dropdownMenuItemSx = {
    minHeight: 40,
    margin: "2px 6px",
    padding: "8px 12px",
    borderRadius: 8,
    whiteSpace: "normal",
    color: "#1e293b",
    "&:hover": {backgroundColor: "#f1f5f9"},
    "&.Mui-selected": {backgroundColor: "rgba(79, 70, 229, 0.075)", color: "#3730a3"},
    "&.Mui-selected:hover": {backgroundColor: "rgba(79, 70, 229, 0.11)"},
    "&&.Mui-focusVisible": {
        outline: "none !important",
        backgroundColor: "rgba(79, 70, 229, 0.11)",
        boxShadow: "inset 2px 0 0 rgba(79, 70, 229, 0.48)",
    },
    "&.Mui-disabled": {opacity: 0.55},
} as const;

export const dropdownGroupLabelSx = {
    lineHeight: "32px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
};

export const accordionSurfaceSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "8px !important",
    "&:before": {display: "none"},
};

export const actionButtonSx = {
    minHeight: 44,
    py: 1.1,
    px: 2,
    borderRadius: 2,
    textTransform: "none",
    fontWeight: 700,
} as const;
