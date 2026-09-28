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
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
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
