import { createTheme } from "@mui/material/styles";

// Monospace stack for technical data (addresses, calldata, raw values).
export const monoFont = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Semantic color roles (see AGENTS.md §9):
//   neutral   navigation, surfaces, structure      -> grey/neutral, `primary` for selection/structure
//   accent    primary product actions / selection  -> `secondary` (indigo)
//   reads     reads and speculative state          -> `info` (sky blue)
//   pending   payable / warning / pending          -> `warning` (amber)
//   confirmed success / confirmed                  -> `success` (green)
//   revert    revert / destructive / error         -> `error` (red)
export const theme = createTheme({
  shape: {
    // Keep 4: component sx widely uses numeric `borderRadius: 2|2.5`, which
    // multiplies by this value (=> 8-10px cards). Override in px per component.
    borderRadius: 4,
  },
  typography: {
    fontFamily: "Roboto, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h6: { fontWeight: 700, letterSpacing: -0.2 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 700 },
    button: { textTransform: "none", letterSpacing: 0 },
  },
  palette: {
    primary: {
      main: "#334155",
      light: "#475569",
      dark: "#1e293b",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#4f46e5",
      light: "#6366f1",
      dark: "#4338ca",
      contrastText: "#ffffff",
    },
    info: {
      main: "#0284c7",
      light: "#38bdf8",
      dark: "#075985",
    },
    warning: {
      main: "#d97706",
      light: "#f59e0b",
      dark: "#b45309",
    },
    success: {
      main: "#16a34a",
      light: "#4ade80",
      dark: "#15803d",
    },
    error: {
      main: "#dc2626",
      light: "#f87171",
      dark: "#b91c1c",
    },
    background: {
      default: "#f6f8fb",
      paper: "#ffffff",
    },
    text: {
      primary: "#101828",
      secondary: "#5a6577",
    },
    divider: "#e4e8ef",
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
          "&.MuiButton-outlined:not(.Mui-disabled)": {
            borderWidth: 1.5,
            borderColor: "#98a2b3",
            backgroundColor: "#ffffff",
          },
          "&.MuiButton-outlined:not(.Mui-disabled):hover": {
            borderWidth: 1.5,
            borderColor: "#667085",
            backgroundColor: "#f8fafc",
          },
          "&.MuiButton-outlinedSecondary:not(.Mui-disabled)": {
            borderColor: "#6366f1",
          },
          "&.MuiButton-outlinedSecondary:not(.Mui-disabled):hover": {
            borderColor: "#4338ca",
            backgroundColor: "rgba(79, 70, 229, 0.08)",
          },
          "&.MuiButton-outlined.Mui-disabled": {
            borderColor: "#d0d5dd",
            backgroundColor: "#f2f4f7",
          },
          "&.MuiButton-text": {
            backgroundColor: "rgba(51, 65, 85, 0.07)",
          },
          "&.MuiButton-text:hover": {
            backgroundColor: "rgba(51, 65, 85, 0.13)",
          },
          "&.MuiButton-textSecondary:not(.Mui-disabled)": {
            color: "#4338ca",
            backgroundColor: "rgba(79, 70, 229, 0.09)",
          },
          "&.MuiButton-textSecondary:not(.Mui-disabled):hover": {
            backgroundColor: "rgba(79, 70, 229, 0.16)",
          },
          "&.MuiButton-textError:not(.Mui-disabled)": {
            color: "#b91c1c",
            backgroundColor: "rgba(220, 38, 38, 0.08)",
          },
          "&.MuiButton-textError:not(.Mui-disabled):hover": {
            backgroundColor: "rgba(220, 38, 38, 0.14)",
          },
          "&.MuiButton-text.Mui-disabled": {
            backgroundColor: "rgba(16, 24, 40, 0.045)",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(51, 65, 85, 0.07)",
          border: "1px solid rgba(51, 65, 85, 0.12)",
          "&:hover": {backgroundColor: "rgba(51, 65, 85, 0.13)"},
          "&.MuiIconButton-colorSecondary": {
            color: "#4338ca",
            backgroundColor: "rgba(79, 70, 229, 0.09)",
            borderColor: "rgba(79, 70, 229, 0.18)",
          },
          "&.MuiIconButton-colorSecondary:hover": {backgroundColor: "rgba(79, 70, 229, 0.16)"},
          "&.MuiIconButton-colorError": {
            color: "#b91c1c",
            backgroundColor: "rgba(220, 38, 38, 0.08)",
            borderColor: "rgba(220, 38, 38, 0.18)",
          },
          "&.MuiIconButton-colorError:hover": {backgroundColor: "rgba(220, 38, 38, 0.14)"},
          "&.Mui-disabled": {
            color: "#98a2b3",
            backgroundColor: "rgba(16, 24, 40, 0.045)",
            borderColor: "rgba(16, 24, 40, 0.08)",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderColor: "#cbd5e1",
          "&:hover": {backgroundColor: "#f1f5f9"},
          "&.Mui-selected": {
            color: "#ffffff",
            backgroundColor: "#4f46e5",
            "&:hover": {backgroundColor: "#4338ca"},
          },
          "&.Mui-disabled": {backgroundColor: "#f2f4f7"},
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": {
            outline: "3px solid rgba(79, 70, 229, 0.5)",
            outlineOffset: 2,
          },
          // Touch devices need the platform minimum (~44px) regardless of the
          // compact sizing that reads fine with a mouse; desktop is unaffected.
          "@media (pointer: coarse)": {
            minHeight: 44,
            minWidth: 44,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: {
          borderColor: "#e4e8ef",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
  },
});

export default theme;
