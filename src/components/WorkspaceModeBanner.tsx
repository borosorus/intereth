import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import {
    Box,
    Container,
    IconButton,
    Popover,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { MouseEvent, useState } from "react";
import { WorkspaceMode, useWorkspaceMode } from "../workspace/context";

const modeDetails = {
    interact: {
        label: "Interact",
        shortDescription: "Read canonical state, build a queue, and execute contract calls.",
        explanation: "Use canonical on-chain reads and submit transactions through your wallet. Queue simulation is limited to execution previews.",
        icon: <BoltOutlinedIcon fontSize="small" />,
    },
    simulate: {
        label: "Simulate",
        shortDescription: "Explore speculative queued state with watches and detailed inspection.",
        explanation: "Run reads and watches against the speculative state produced by the queue. Nothing is submitted unless you return to Interact.",
        icon: <ScienceOutlinedIcon fontSize="small" />,
    },
} satisfies Record<WorkspaceMode, {
    label: string;
    shortDescription: string;
    explanation: string;
    icon: JSX.Element;
}>;

export default function WorkspaceModeBanner() {
    const workspace = useWorkspaceMode();
    const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
    const active = modeDetails[workspace.mode];
    const simulated = workspace.mode === "simulate";

    return (
        <Box
            component="section"
            aria-label="Workspace selection"
            sx={{
                borderBottom: "1px solid",
                borderColor: simulated ? "info.light" : "secondary.light",
                backgroundColor: simulated ? "rgba(33, 150, 243, 0.08)" : "rgba(255, 87, 34, 0.07)",
                transition: "background-color 180ms ease, border-color 180ms ease",
            }}
        >
            <Container maxWidth="lg" sx={{py: {xs: 1.5, sm: 2}, px: {xs: 2, sm: 3}}}>
                <Stack spacing={1} alignItems="center">
                    <ToggleButtonGroup
                        exclusive
                        fullWidth
                        value={workspace.mode}
                        onChange={(_, mode: WorkspaceMode | null) => {
                            if (mode) workspace.setMode(mode);
                        }}
                        aria-label="Workspace mode"
                        sx={{
                            maxWidth: 720,
                            backgroundColor: "background.paper",
                            borderRadius: 2.5,
                            boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
                            "& .MuiToggleButton-root": {
                                flex: 1,
                                gap: 1,
                                px: {xs: 1.5, sm: 2.5},
                                py: {xs: 1, sm: 1.25},
                                borderColor: "divider",
                                textTransform: "none",
                            },
                            "& .MuiToggleButton-root.Mui-selected": {
                                color: simulated ? "info.dark" : "secondary.dark",
                                backgroundColor: simulated ? "rgba(33, 150, 243, 0.12)" : "rgba(255, 87, 34, 0.11)",
                            },
                        }}
                    >
                        {(Object.keys(modeDetails) as WorkspaceMode[]).map((mode) => {
                            const details = modeDetails[mode];
                            return (
                                <ToggleButton key={mode} value={mode} aria-label={`${details.label} workspace`}>
                                    {details.icon}
                                    <Box sx={{textAlign: "left", minWidth: 0}}>
                                        <Typography component="span" sx={{display: "block", fontWeight: 800, lineHeight: 1.2}}>
                                            {details.label}
                                        </Typography>
                                        <Typography
                                            component="span"
                                            variant="caption"
                                            sx={{display: {xs: "none", sm: "block"}, color: "text.secondary", lineHeight: 1.25}}
                                        >
                                            {details.shortDescription}
                                        </Typography>
                                    </Box>
                                </ToggleButton>
                            );
                        })}
                    </ToggleButtonGroup>
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                        <Typography variant="caption" color="text.secondary" sx={{textAlign: "center"}}>
                            <Box component="span" sx={{fontWeight: 800, color: simulated ? "info.dark" : "secondary.dark"}}>
                                {active.label} mode:
                            </Box>{" "}{active.shortDescription}
                        </Typography>
                        <IconButton
                            size="small"
                            aria-label="About workspace modes"
                            onClick={(event: MouseEvent<HTMLElement>) => setInfoAnchor(event.currentTarget)}
                        >
                            <HelpOutlineIcon fontSize="inherit" />
                        </IconButton>
                    </Stack>
                </Stack>
            </Container>
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
        </Box>
    );
}
