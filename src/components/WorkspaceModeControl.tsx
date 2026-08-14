import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Box, IconButton, Popover, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { MouseEvent, useState } from "react";
import { WorkspaceMode, useWorkspaceMode } from "../workspace/context";

const modeDetails = {
    interact: {
        label: "Interact",
        shortDescription: "Canonical reads and wallet execution",
        explanation: "Use canonical on-chain reads and submit transactions through your wallet. Queue simulation is limited to execution previews.",
        icon: <BoltOutlinedIcon fontSize="small" />,
    },
    simulate: {
        label: "Simulate",
        shortDescription: "Speculative reads and inspection",
        explanation: "Run reads and watches against the speculative state produced by the queue. Nothing is submitted unless you return to Interact.",
        icon: <ScienceOutlinedIcon fontSize="small" />,
    },
} satisfies Record<WorkspaceMode, {label: string; shortDescription: string; explanation: string; icon: JSX.Element}>;

export default function WorkspaceModeControl() {
    const workspace = useWorkspaceMode();
    const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
    const simulated = workspace.mode === "simulate";

    return (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{width: 1, maxWidth: 620}}>
            <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={workspace.mode}
                onChange={(_, mode: WorkspaceMode | null) => mode && workspace.setMode(mode)}
                aria-label="Workspace mode"
                sx={{
                    backgroundColor: "background.paper",
                    borderRadius: 2.5,
                    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
                    "& .MuiToggleButton-root": {flex: 1, gap: 0.75, px: {xs: 1, md: 2}, py: 0.85, textTransform: "none"},
                    "& .MuiToggleButton-root.Mui-selected": {
                        color: simulated ? "info.dark" : "secondary.dark",
                        backgroundColor: simulated ? "rgba(33, 150, 243, 0.12)" : "rgba(255, 87, 34, 0.11)",
                    },
                }}
            >
                {(Object.keys(modeDetails) as WorkspaceMode[]).map((mode) => (
                    <ToggleButton key={mode} value={mode} aria-label={`${modeDetails[mode].label} workspace`}>
                        {modeDetails[mode].icon}
                        <Box sx={{textAlign: "left", minWidth: 0}}>
                            <Typography component="span" sx={{display: "block", fontWeight: 800, lineHeight: 1.1}}>{modeDetails[mode].label}</Typography>
                            <Typography component="span" variant="caption" sx={{display: {xs: "none", md: "block"}, color: "text.secondary", lineHeight: 1.15}}>
                                {modeDetails[mode].shortDescription}
                            </Typography>
                        </Box>
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
            <IconButton size="small" aria-label="About workspace modes" onClick={(event: MouseEvent<HTMLElement>) => setInfoAnchor(event.currentTarget)}>
                <HelpOutlineIcon fontSize="inherit" />
            </IconButton>
            <Popover
                open={Boolean(infoAnchor)}
                anchorEl={infoAnchor}
                onClose={() => setInfoAnchor(null)}
                anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                transformOrigin={{vertical: "top", horizontal: "center"}}
                PaperProps={{role: "dialog", "aria-label": "About workspace modes"}}
            >
                <Stack spacing={1.5} sx={{p: 2, maxWidth: 360}}>
                    {(Object.keys(modeDetails) as WorkspaceMode[]).map((mode) => (
                        <Box key={mode}>
                            <Typography variant="subtitle2" sx={{fontWeight: 800}}>{modeDetails[mode].label}</Typography>
                            <Typography variant="body2" color="text.secondary">{modeDetails[mode].explanation}</Typography>
                        </Box>
                    ))}
                </Stack>
            </Popover>
        </Stack>
    );
}
