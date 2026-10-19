import { Box, Typography } from "@mui/material";
import { ReactNode } from "react";
import InfoHint from "./InfoHint";

export const workspaceSurfaceSx = {
    borderRadius: 2.5,
    borderColor: "divider",
    bgcolor: "background.paper",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.035)",
};

export default function WorkspaceSectionHeader({title, description, action, hintLabel, hintContent}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    hintLabel?: string;
    hintContent?: ReactNode;
}) {
    return (
        <Box sx={{display: "flex", alignItems: {xs: "flex-start", sm: "center"}, justifyContent: "space-between", gap: 1.25, flexWrap: "wrap"}}>
            <Box sx={{display: "flex", alignItems: "stretch", gap: 1, minWidth: 0}}>
                <Box aria-hidden="true" sx={{width: 4, flex: "0 0 auto", borderRadius: 99, bgcolor: "secondary.main"}} />
                <Box sx={{minWidth: 0}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 0.75}}>
                        <Typography variant="subtitle1" sx={{fontWeight: 800, lineHeight: 1.35}}>{title}</Typography>
                        {hintContent && <InfoHint label={hintLabel ?? `About ${title}`} content={hintContent} />}
                    </Box>
                    {description && <Typography variant="body2" color="text.secondary" sx={{mt: 0.25}}>{description}</Typography>}
                </Box>
            </Box>
            {action}
        </Box>
    );
}
