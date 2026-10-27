import { Stack } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

export default function ActionButtonRow({children, sx}: {children: ReactNode; sx?: SxProps<Theme>}) {
    return (
        <Stack direction={{xs: "column", sm: "row"}} spacing={1.25} sx={sx}>
            {children}
        </Stack>
    );
}
