import { Dialog, DialogProps, useMediaQuery, useTheme } from "@mui/material";

type ResponsiveDialogProps = Omit<DialogProps, "fullScreen" | "fullWidth" | "PaperProps" | "sx">;

export default function ResponsiveDialog(props: ResponsiveDialogProps) {
    const theme = useTheme();
    const mobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <Dialog
            {...props}
            fullScreen={mobile}
            fullWidth
            PaperProps={{
                sx: {
                    display: "flex",
                    flexDirection: "column",
                    height: mobile ? "100dvh" : undefined,
                    maxHeight: mobile ? "100dvh" : undefined,
                },
            }}
            sx={{
                "& .MuiDialogTitle-root": {
                    px: {xs: 2, sm: 3},
                    pt: {xs: "calc(16px + env(safe-area-inset-top))", sm: 3},
                    pb: {xs: 1.5, sm: 2},
                },
                "& .MuiDialogContent-root": {
                    minHeight: 0,
                    px: {xs: 2, sm: 3},
                },
                "& .MuiDialogActions-root": {
                    alignItems: {xs: "stretch", sm: "center"},
                    flexDirection: {xs: "column", sm: "row"},
                    gap: {xs: 1, sm: 0},
                    px: {xs: 2, sm: 3},
                    pt: 1.5,
                    pb: {xs: "calc(16px + env(safe-area-inset-bottom))", sm: 2},
                    "& > :not(style) ~ :not(style)": {
                        ml: {xs: 0, sm: 1},
                    },
                    "& .MuiButton-root": {
                        minHeight: {xs: 44, sm: "auto"},
                        width: {xs: "100%", sm: "auto"},
                    },
                },
            }}
        />
    );
}
