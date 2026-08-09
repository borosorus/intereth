import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { ethers } from "ethers";
import { CallResultData, formatAbiValue, valuesForOutputs } from "../callUtils";
import CopyButton from "./CopyButton";

function ValueTree({param, value}: {param: ethers.ParamType; value: unknown}) {
    if (param.baseType === "array") {
        const values = Array.from((value ?? []) as ArrayLike<unknown>);
        const child = param.arrayChildren as ethers.ParamType;
        return values.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Empty array</Typography>
        ) : (
            <Stack spacing={0.75}>
                {values.map((item, index) => (
                    <Box key={index} sx={{pl: 1.25, borderLeft: "2px solid", borderColor: "divider"}}>
                        <Typography variant="caption" color="text.secondary">Item {index + 1}</Typography>
                        <ValueTree param={child} value={item} />
                    </Box>
                ))}
            </Stack>
        );
    }

    if (param.baseType === "tuple") {
        const values = Array.from((value ?? []) as ArrayLike<unknown>);
        return (
            <Stack spacing={0.75}>
                {(param.components ?? []).map((component, index) => (
                    <Box key={`${component.name || component.type}-${index}`} sx={{pl: 1.25, borderLeft: "2px solid", borderColor: "divider"}}>
                        <Typography variant="caption" color="text.secondary">
                            {component.name || `Field ${index + 1}`} · {component.type}
                        </Typography>
                        <ValueTree param={component} value={values[index]} />
                    </Box>
                ))}
            </Stack>
        );
    }

    return (
        <Typography
            variant="body2"
            sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", overflowWrap: "anywhere"}}
        >
            {value == null ? "null" : String(value)}
        </Typography>
    );
}

function FunctionResult({result}: {result: Extract<CallResultData, {kind: "function"}>}) {
    const values = valuesForOutputs(result.outputs, result.value);
    if (result.outputs.length === 0) {
        return <Typography variant="body2">Call completed with no return value.</Typography>;
    }

    return (
        <Stack spacing={1} divider={<Divider flexItem />}>
            {result.outputs.map((output, index) => (
                <Box key={`${output.name || output.type}-${index}`}>
                    <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 700}}>{output.name || `Output ${index + 1}`}</Typography>
                            <Typography variant="caption" color="text.secondary">{output.type}</Typography>
                        </Box>
                        <CopyButton value={formatAbiValue(output, values[index])} label={`Copy ${output.name || `output ${index + 1}`}`} />
                    </Box>
                    <Box sx={{mt: 0.75}}><ValueTree param={output} value={values[index]} /></Box>
                </Box>
            ))}
        </Stack>
    );
}

export default function CallResult({result}: {result: CallResultData | null}) {
    if (!result) {
        return null;
    }

    return (
        <Paper variant="outlined" sx={{p: 2, borderRadius: 2, backgroundColor: "rgba(248, 250, 252, 0.82)"}}>
            <Stack spacing={1.25}>
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 800}}>
                        {result.kind === "transaction" ? "Transaction result" : result.kind === "raw" ? "Raw call result" : "Call result"}
                    </Typography>
                    {result.kind === "transaction" && (
                        <Chip
                            size="small"
                            label={({submitted: "Submitted", pending: "Pending", confirmed: "Confirmed", failed: "Failed"} as const)[result.status]}
                            color={result.status === "failed" ? "error" : result.status === "confirmed" ? "success" : "default"}
                        />
                    )}
                    {result.kind !== "transaction" && (
                        <Chip
                            size="small"
                            label={result.source.kind === "simulated" ? "Simulated" : "On-chain"}
                            color={result.source.kind === "simulated" ? "secondary" : "default"}
                            variant={result.source.kind === "simulated" ? "filled" : "outlined"}
                        />
                    )}
                </Box>
                {result.kind !== "transaction" && result.source.kind === "simulated" && (
                    <Typography variant="caption" color="text.secondary">
                        Computed after {result.source.queuedCallCount} queued {result.source.queuedCallCount === 1 ? "call" : "calls"} using the latest state when run.
                    </Typography>
                )}
                {result.kind === "function" && <FunctionResult result={result} />}
                {result.kind === "raw" && (
                    <Box sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1}}>
                        <Typography variant="body2" sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere"}}>
                            {result.data || "0x"}
                        </Typography>
                        <CopyButton value={result.data || "0x"} label="Copy return data" />
                    </Box>
                )}
                {result.kind === "transaction" && (
                    <Stack spacing={0.75}>
                        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                            <Box sx={{minWidth: 0}}>
                                <Typography variant="caption" color="text.secondary">Transaction hash</Typography>
                                <Typography variant="body2" sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere"}}>{result.hash}</Typography>
                            </Box>
                            <CopyButton value={result.hash} label="Copy transaction hash" />
                        </Box>
                        {result.blockNumber !== undefined && <Typography variant="body2"><strong>Block:</strong> {result.blockNumber}</Typography>}
                        {result.gasUsed && <Typography variant="body2"><strong>Gas used:</strong> {result.gasUsed}</Typography>}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}
