import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IconButton, Tooltip } from "@mui/material";
import { ReactNode } from "react";

// Secondary explanation that should stay reachable but off the main surface.
// The trigger is a focusable button with an accessible name; the tooltip
// opens on hover, keyboard focus, and touch.
export default function InfoHint({label, content}: {label: string; content: ReactNode}) {
    return (
        <Tooltip title={content} placement="top" enterTouchDelay={0} leaveTouchDelay={4000} sx={{maxWidth: 340}}>
            <IconButton
                size="small"
                aria-label={label}
                sx={{
                    width: 24,
                    height: 24,
                    minWidth: 24,
                    minHeight: 24,
                    p: 0,
                    color: "text.secondary",
                    flex: "0 0 auto",
                    backgroundColor: "transparent",
                    border: 0,
                    boxShadow: "none",
                    "&:hover": {backgroundColor: "transparent", color: "text.primary", border: 0, boxShadow: "none"},
                    "@media (pointer: coarse)": {
                        width: 44,
                        height: 44,
                        minWidth: 44,
                        minHeight: 44,
                        justifyContent: "flex-start",
                    },
                }}
            >
                <InfoOutlinedIcon sx={{fontSize: 17}} />
            </IconButton>
        </Tooltip>
    );
}
