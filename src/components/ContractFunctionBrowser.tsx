import SearchIcon from "@mui/icons-material/Search";
import { Box, Button, InputAdornment, Paper, Stack, TextField, ToggleButton, Typography } from "@mui/material";
import { ethers } from "ethers";
import { ReactNode, useEffect, useMemo, useState } from "react";
import ContractFunctionSection, { isReadFunction } from "./ContractFunctionSection";

export type FunctionFilter = "all" | "read" | "write" | "payable";
interface FunctionViewState {query: string; filter: FunctionFilter}
const sessionViews = new Map<string, FunctionViewState>();

export function matchesFunction(fragment: ethers.FunctionFragment, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [fragment.name, fragment.format("full"), ...fragment.inputs.flatMap((input) => [input.name, input.type])]
        .some((value) => value.toLowerCase().includes(normalized));
}

export default function ContractFunctionBrowser({contractId, functions, renderFunction, readDescription, writeTitle = "Write functions", writeDescription, writeCollapsible = false}: {
    contractId: string;
    functions: ethers.FunctionFragment[];
    renderFunction: (fragment: ethers.FunctionFragment) => ReactNode;
    readDescription: string;
    writeTitle?: string;
    writeDescription: string;
    writeCollapsible?: boolean;
}) {
    const initial = sessionViews.get(contractId) ?? {query: "", filter: "all" as const};
    const [query, setQuery] = useState(initial.query);
    const [filter, setFilter] = useState<FunctionFilter>(initial.filter);
    useEffect(() => { sessionViews.set(contractId, {query, filter}); }, [contractId, filter, query]);

    const readCount = functions.filter(isReadFunction).length;
    const writeCount = functions.length - readCount;
    const payableCount = functions.filter((fragment) => fragment.stateMutability === "payable").length;
    const visible = useMemo(() => functions.filter((fragment) => {
        if (!matchesFunction(fragment, query)) return false;
        if (filter === "read") return isReadFunction(fragment);
        if (filter === "write") return !isReadFunction(fragment);
        if (filter === "payable") return fragment.stateMutability === "payable";
        return true;
    }), [filter, functions, query]);
    const reads = visible.filter(isReadFunction);
    const writes = visible.filter((fragment) => !isReadFunction(fragment));

    return (
        <Stack spacing={2}>
            <Paper variant="outlined" sx={{p: 1.5, borderRadius: 2}}>
                <Stack spacing={1.25}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Search functions"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        InputProps={{startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>}}
                    />
                    <Box role="group" aria-label="Function filter" sx={{display: "grid", gridTemplateColumns: {xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, auto)"}, gap: 0.75, alignSelf: {sm: "flex-start"}}}>
                        {([
                            ["all", `All ${functions.length}`],
                            ["read", `Read ${readCount}`],
                            ["write", `Write ${writeCount}`],
                            ["payable", `Payable ${payableCount}`],
                        ] as Array<[FunctionFilter, string]>).map(([value, label]) => (
                            <ToggleButton key={value} size="small" value={value} selected={filter === value} onChange={() => setFilter(value)} sx={{minWidth: 0}}>{label}</ToggleButton>
                        ))}
                    </Box>
                </Stack>
            </Paper>
            {visible.length === 0 ? (
                <Paper variant="outlined" sx={{p: 3, borderRadius: 2, textAlign: "center"}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>No matching functions</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>Try another name, signature, argument, or filter.</Typography>
                    <Button onClick={() => {setQuery(""); setFilter("all");}}>Reset search</Button>
                </Paper>
            ) : <>
                <ContractFunctionSection title="Read functions" description={readDescription} functions={reads} renderFunction={renderFunction} />
                <ContractFunctionSection
                    title={filter === "payable" ? "Payable functions" : writeTitle}
                    description={writeDescription}
                    functions={writes}
                    renderFunction={renderFunction}
                    collapsible={writeCollapsible && filter === "all" && !query}
                    defaultExpanded={false}
                />
            </>}
        </Stack>
    );
}
