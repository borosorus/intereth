import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, ButtonBase, Chip, Collapse, Divider, Paper, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { ReactNode, useState } from "react";

export function isReadFunction(fragment: ethers.FunctionFragment) {
    return fragment.stateMutability === "view" || fragment.stateMutability === "pure";
}

export function FunctionMutabilityBadge({fragment}: {fragment: ethers.FunctionFragment}) {
    const details = fragment.stateMutability === "view"
        ? {label: "View", color: "info" as const}
        : fragment.stateMutability === "pure"
            ? {label: "Pure", color: "info" as const}
            : fragment.stateMutability === "payable"
                ? {label: "Payable", color: "secondary" as const}
                : {label: "Write", color: "warning" as const};

    return <Chip size="small" color={details.color} label={details.label} sx={{fontWeight: 800, flex: "0 0 auto"}} />;
}

interface ContractFunctionSectionProps {
    title: string;
    description: string;
    functions: ethers.FunctionFragment[];
    renderFunction: (fragment: ethers.FunctionFragment) => ReactNode;
    collapsible?: boolean;
    defaultExpanded?: boolean;
}

export default function ContractFunctionSection({
    title,
    description,
    functions,
    renderFunction,
    collapsible = false,
    defaultExpanded = true,
}: ContractFunctionSectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    if (functions.length === 0) return null;

    const header = (
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, width: 1, p: 2}}>
            <Box sx={{minWidth: 0, textAlign: "left"}}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>{title}</Typography>
                    <Chip size="small" variant="outlined" label={functions.length} aria-label={`${functions.length} ${functions.length === 1 ? "function" : "functions"}`} />
                </Stack>
                <Typography variant="caption" color="text.secondary">{description}</Typography>
            </Box>
            {collapsible && (
                <ExpandMoreIcon
                    color="action"
                    sx={{transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease", flex: "0 0 auto"}}
                />
            )}
        </Box>
    );

    return (
        <Paper variant="outlined" sx={{borderRadius: 2, overflow: "hidden"}}>
            {collapsible ? (
                <ButtonBase
                    onClick={() => setExpanded((current) => !current)}
                    aria-expanded={expanded}
                    aria-label={`${title}: ${description}`}
                    sx={{display: "block", width: 1}}
                >
                    {header}
                </ButtonBase>
            ) : header}
            <Collapse in={!collapsible || expanded} unmountOnExit={collapsible}>
                <Divider />
                <Stack spacing={1.5} sx={{p: 2}}>
                    {functions.map(renderFunction)}
                </Stack>
            </Collapse>
        </Paper>
    );
}
