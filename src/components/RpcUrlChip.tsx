import { Chip, Stack, Tooltip } from "@mui/material";
import CopyButton from "./CopyButton";

export default function RpcUrlChip({url}: {url: string}) {
    return (
        <Stack direction="row" spacing={0.25} alignItems="center" sx={{minWidth: 0, maxWidth: "100%"}}>
            <Tooltip title={url} placement="top">
                <Chip
                    size="small"
                    variant="outlined"
                    label={url}
                    sx={{
                        maxWidth: {xs: "min(260px, 65vw)", sm: 320},
                        bgcolor: "background.paper",
                        "& .MuiChip-label": {overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"},
                    }}
                />
            </Tooltip>
            <CopyButton value={url} label="Copy RPC URL" size="small" />
        </Stack>
    );
}
