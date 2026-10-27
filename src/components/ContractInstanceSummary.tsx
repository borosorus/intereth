import { Box, Chip, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import CopyButton from "./CopyButton";
import RpcUrlChip from "./RpcUrlChip";
import { monoFont } from "../ui/styles";

export default function ContractInstanceSummary({address, chainLabel, accessLabel, rpcUrl}: {
    address: string;
    chainLabel: string;
    accessLabel: string;
    rpcUrl?: string;
}) {
    return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{minWidth: 0}}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{minWidth: 0}}>
                <Typography variant="subtitle1" sx={{minWidth: 0, fontFamily: monoFont, fontWeight: 700, wordBreak: "break-all"}}>
                    {address}
                </Typography>
                {ethers.isAddress(address) && <CopyButton value={address} label="Copy contract address" />}
            </Stack>
            <Chip size="small" variant="outlined" label={chainLabel} />
            <Chip size="small" variant="outlined" label={accessLabel} />
            {rpcUrl && <Box sx={{minWidth: 0, maxWidth: "100%"}}><RpcUrlChip url={rpcUrl} /></Box>}
        </Stack>
    );
}
