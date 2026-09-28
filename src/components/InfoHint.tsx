import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IconButton, Tooltip } from "@mui/material";
import { ReactNode } from "react";

// Secondary explanation that should stay reachable but off the main surface.
// The trigger is a focusable button with an accessible name; the tooltip
// opens on hover, keyboard focus, and touch.
export default function InfoHint({label, content}: {label: string; content: ReactNode}) {
    return (
        <Tooltip title={content} placement="top" enterTouchDelay={0} leaveTouchDelay={4000} sx={{maxWidth: 340}}>
            <IconButton size="small" aria-label={label} sx={{p: 0.25, color: "text.secondary", flex: "0 0 auto"}}>
                <InfoOutlinedIcon sx={{fontSize: 17}} />
            </IconButton>
        </Tooltip>
    );
}
