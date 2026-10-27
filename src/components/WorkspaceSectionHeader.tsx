import { Box, Typography } from "@mui/material";
import type { TypographyProps } from "@mui/material";
import { ReactNode } from "react";
import InfoHint from "./InfoHint";

export default function WorkspaceSectionHeader({title, description, action, hintLabel, hintContent, titleVariant = "subtitle1"}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    hintLabel?: string;
    hintContent?: ReactNode;
    titleVariant?: TypographyProps["variant"];
}) {
    return (
        <Box sx={{display: "flex", alignItems: {xs: "flex-start", sm: "center"}, justifyContent: "space-between", gap: 1.25, flexWrap: "wrap"}}>
            <Box sx={{display: "flex", alignItems: "stretch", gap: 1, minWidth: 0}}>
                <Box aria-hidden="true" sx={{width: 4, flex: "0 0 auto", borderRadius: 99, bgcolor: "secondary.main"}} />
                <Box sx={{minWidth: 0, display: "flex", alignItems: "center", gap: 0.35}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant={titleVariant} sx={{fontWeight: 700, lineHeight: 1.35}}>{title}</Typography>
                        {description && <Typography variant="body2" color="text.secondary" sx={{mt: 0.25}}>{description}</Typography>}
                    </Box>
                    {hintContent && <InfoHint label={hintLabel ?? `About ${title}`} content={hintContent} />}
                </Box>
            </Box>
            {action}
        </Box>
    );
}
