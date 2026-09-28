import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import styled from "@emotion/styled";
import { Accordion, Box, ButtonBase, Chip, Collapse, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { ReactNode, useState } from "react";

export function isReadFunction(fragment: ethers.FunctionFragment) {
    return fragment.stateMutability === "view" || fragment.stateMutability === "pure";
}

// Shared chrome for per-function accordions in Explore: bordered, rounded,
// no default MUI separator, so function lists work without an enclosing card.
export const FunctionAccordion = styled(Accordion)({
    borderRadius: "10px !important",
    overflow: "hidden",
    border: "1px solid",
    borderColor: "rgba(0, 0, 0, 0.12)",
    "&:before": {display: "none"},
});

export function FunctionMutabilityBadge({fragment}: {fragment: ethers.FunctionFragment}) {
    const details = fragment.stateMutability === "view"
        ? {label: "View", color: "info" as const}
        : fragment.stateMutability === "pure"
            ? {label: "Pure", color: "info" as const}
            : fragment.stateMutability === "payable"
                ? {label: "Payable", color: "warning" as const}
                : {label: "Write", color: "default" as const};

    return (
        <Chip
            size="small"
            color={details.color}
            variant={details.color === "default" ? "outlined" : "filled"}
            label={details.label}
            sx={{fontWeight: 800, flex: "0 0 auto"}}
        />
    );
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
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, width: 1, py: 1}}>
            <Box sx={{minWidth: 0, textAlign: "left"}}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{fontWeight: 800}}>{title}</Typography>
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
        <Box>
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
                <Stack spacing={1} sx={{pt: 0.75}}>
                    {functions.map(renderFunction)}
                </Stack>
            </Collapse>
        </Box>
    );
}
