import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { ethers } from "ethers";
import { useState } from "react";
import { ParamValue, ValueUnit } from "../../calls/parameters";
import { prepareAbiCall, prepareRawCall } from "../../calls/prepareCall";
import { normalizeError, NormalizedError } from "../../callUtils";
import { useTransactionPlan } from "../../transaction-plan/context";
import { QueuedCall } from "../../transaction-plan/types";
import ErrorDialog from "../ErrorDialog";
import FunctionCallEditor from "../FunctionCallEditor";
import TransactionValueInput from "../TransactionValueInput";
import CopyButton from "../CopyButton";
import { shortAddress, summarizeArgument, summarizeNativeValue } from "../../calls/displayValues";
import { CallImpact, prioritizeBalanceChanges } from "../../simulation/callImpact";
import { TokenMetadata } from "../../simulation/types";
import { formatBalanceChangeAmount, metadataForToken, tokenLabel } from "../../simulation/tokenFormatting";

function createCallId() {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : ethers.id(`${Date.now()}-${Math.random()}`);
}

function duplicateCall(call: QueuedCall): QueuedCall {
    return {
        ...call,
        id: createCallId(),
        createdAt: Date.now(),
        display: {
            ...call.display,
            arguments: call.display.arguments?.map((argument) => ({...argument})),
        },
        editor: call.editor.kind === "abi"
            ? {...call.editor, arguments: JSON.parse(JSON.stringify(call.editor.arguments)) as ParamValue[]}
            : {kind: "raw"},
        decoderAbi: [...call.decoderAbi],
    };
}

function CallSummary({call, index}: {call: QueuedCall; index: number}) {
    const nativeValue = summarizeNativeValue(call.value);
    return (
        <Stack spacing={1}>
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                <Typography variant="subtitle2" sx={{fontWeight: 800, overflowWrap: "anywhere"}}>
                    {index + 1}. {call.display.functionSignature ?? "Raw transaction"}
                </Typography>
                <Chip size="small" variant="outlined" label={call.display.kind === "abi" ? "ABI" : "Raw"} />
            </Box>
            <Box sx={{display: "flex", alignItems: "center", gap: 0.25}}>
                <Typography variant="caption" color="text.secondary">Contract {shortAddress(call.to)}</Typography>
                <CopyButton value={call.to} label={`Copy destination for call ${index + 1}`} />
            </Box>
            {call.display.arguments && call.display.arguments.length > 0 && (
                <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">Arguments</Typography>
                    {call.display.arguments.map((argument, argumentIndex) => {
                        const summary = summarizeArgument(argument);
                        const showSecondary = summary.secondary?.match(/^\d+ bytes?$/);
                        return (
                            <Box key={`${argument.name}-${argumentIndex}`} sx={{display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, pl: 1, borderLeft: "2px solid", borderColor: "divider"}}>
                                <Typography variant="caption" color="text.secondary">{argument.name}</Typography>
                                <Box sx={{minWidth: 0, textAlign: "right"}}>
                                    <Typography variant="body2" sx={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere"}}>{summary.primary}</Typography>
                                    {showSecondary && <Typography variant="caption" color="text.secondary">{summary.secondary}</Typography>}
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            )}
            {call.value !== "0" && <Typography variant="body2"><strong>Native value:</strong> {nativeValue.primary}</Typography>}
            <Accordion disableGutters elevation={0} sx={{"&:before": {display: "none"}, bgcolor: "transparent"}}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{px: 0, minHeight: 36, "& .MuiAccordionSummary-content": {my: 0.5}}}>
                    <Typography variant="caption" color="text.secondary" sx={{fontWeight: 700}}>Technical details</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{px: 0, pt: 0}}>
                    <Stack spacing={1}>
                        <Box><Typography variant="caption" color="text.secondary">Destination</Typography><Typography variant="body2" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>{call.to}</Typography></Box>
                        <Box><Typography variant="caption" color="text.secondary">Value</Typography><Typography variant="body2" sx={{fontFamily: "monospace"}}>{nativeValue.secondary}</Typography></Box>
                        {call.display.arguments?.map((argument, argumentIndex) => (
                            <Box key={`raw-${argument.name}-${argumentIndex}`}>
                                <Typography variant="caption" color="text.secondary">{argument.name} · {argument.type}</Typography>
                                <Typography variant="body2" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>{argument.value}</Typography>
                            </Box>
                        ))}
                        <Box><Typography variant="caption" color="text.secondary">Calldata</Typography><Typography variant="body2" sx={{fontFamily: "monospace", overflowWrap: "anywhere"}}>{call.data}</Typography></Box>
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </Stack>
    );
}

function decimalQuantity(value: string) {
    try {
        return ethers.getBigInt(value).toLocaleString("en-US");
    } catch {
        return value;
    }
}

function CallImpactSummary({impact, call, metadataByAddress}: {
    impact: CallImpact;
    call: QueuedCall;
    metadataByAddress: Record<string, TokenMetadata>;
}) {
    const [showAll, setShowAll] = useState(false);
    if (impact.state !== "ready") {
        const label = impact.state === "refreshing" ? "Refreshing preview" : impact.state === "stale" ? "Preview stale" : "Preview unavailable";
        return <Chip size="small" variant="outlined" label={label} color={impact.state === "stale" ? "warning" : "default"} sx={{alignSelf: "flex-start"}} />;
    }

    const ordered = prioritizeBalanceChanges(impact.balanceChanges, call.from, call.to);
    const visible = showAll ? ordered : ordered.slice(0, 2);
    return (
        <Box sx={{p: 1.25, borderRadius: 1.5, bgcolor: "action.hover"}}>
            <Stack spacing={0.75}>
                <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75}}>
                    <Chip size="small" label={impact.call.status === "0x1" ? "Success" : "Reverted"} color={impact.call.status === "0x1" ? "success" : "error"} />
                    <Typography variant="caption" color="text.secondary">{decimalQuantity(impact.call.gasUsed)} gas</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {impact.call.decodedEvents.length} decoded {impact.call.decodedEvents.length === 1 ? "event" : "events"}
                    </Typography>
                </Box>
                {impact.call.decodedRevert && (
                    <Typography variant="caption" color="error.main" sx={{overflowWrap: "anywhere"}}>
                        {impact.call.decodedRevert.name}: {impact.call.decodedRevert.message}
                    </Typography>
                )}
                {visible.map((change) => {
                    const metadata = change.asset === "erc20" ? metadataForToken(metadataByAddress, call.chainId, change.tokenAddress) : undefined;
                    return (
                        <Box key={`${change.asset}:${change.tokenAddress ?? "native"}:${change.account}`} sx={{display: "flex", flexDirection: {xs: "column", sm: "row"}, justifyContent: "space-between", gap: {xs: 0.25, sm: 1}}}>
                            <Typography variant="caption" color="text.secondary">
                                {change.account.toLowerCase() === call.from.toLowerCase() ? "Plan sender" : change.account.toLowerCase() === call.to.toLowerCase() ? "Call target" : shortAddress(change.account)}
                                {" · "}{change.asset === "native" ? "Native asset" : tokenLabel(change.tokenAddress ?? "", metadata)}
                            </Typography>
                            <Typography variant="caption" sx={{fontFamily: "monospace", fontWeight: 700, overflowWrap: "anywhere"}}>{formatBalanceChangeAmount(change, metadata)}</Typography>
                        </Box>
                    );
                })}
                {ordered.length > 2 && (
                    <Button size="small" sx={{alignSelf: "flex-start", p: 0, minWidth: 0, textTransform: "none"}} onClick={() => setShowAll((current) => !current)}>
                        {showAll ? "Show fewer effects" : `Show ${ordered.length - 2} more ${ordered.length - 2 === 1 ? "effect" : "effects"}`}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}

function PlanCallEditor({call, onSave, onCancel}: {call: QueuedCall; onSave: (call: QueuedCall) => void; onCancel: () => void}) {
    const [error, setError] = useState<NormalizedError | null>(null);
    const [rawData, setRawData] = useState(call.data);
    const [valueAmount, setValueAmount] = useState(call.value);
    const [valueUnit, setValueUnit] = useState<ValueUnit>("wei");
    const [argumentValues, setArgumentValues] = useState<ParamValue[]>(
        call.editor.kind === "abi" ? JSON.parse(JSON.stringify(call.editor.arguments)) as ParamValue[] : [],
    );

    let fragment: ethers.FunctionFragment | null = null;
    if (call.editor.kind === "abi") {
        try {
            fragment = ethers.FunctionFragment.from(call.editor.functionFragment);
        } catch {
            return (
                <Alert severity="error" action={<Button onClick={onCancel}>Close editor</Button>}>
                    The saved function definition is invalid and cannot be edited.
                </Alert>
            );
        }
    }

    const save = () => {
        try {
            const updated = fragment
                ? prepareAbiCall({
                    fragment,
                    decoderAbi: call.decoderAbi,
                    target: call.to,
                    account: call.from,
                    chainId: call.chainId,
                    argumentValues,
                    valueAmount,
                    valueUnit,
                    id: call.id,
                    createdAt: call.createdAt,
                })
                : prepareRawCall({
                    target: call.to,
                    account: call.from,
                    chainId: call.chainId,
                    data: rawData,
                    valueAmount,
                    valueUnit,
                    id: call.id,
                    createdAt: call.createdAt,
                });
            onSave(updated);
        } catch (saveError) {
            setError(normalizeError(saveError, "Could not update call"));
        }
    };

    return (
        <Stack spacing={1.5}>
            {fragment ? (
                <FunctionCallEditor
                    fragment={fragment}
                    arguments={argumentValues}
                    onArgumentsChange={setArgumentValues}
                    valueAmount={valueAmount}
                    valueUnit={valueUnit}
                    onValueAmountChange={setValueAmount}
                    onValueUnitChange={setValueUnit}
                />
            ) : (
                <>
                    <TextField
                        label="Hex calldata"
                        value={rawData}
                        onChange={(event) => setRawData(event.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <TransactionValueInput
                        amount={valueAmount}
                        unit={valueUnit}
                        onAmountChange={setValueAmount}
                        onUnitChange={setValueUnit}
                        label="Transaction value"
                    />
                </>
            )}
            <Stack direction={{xs: "column", sm: "row"}} spacing={1}>
                <Button variant="contained" color="secondary" fullWidth onClick={save}>Save changes</Button>
                <Button variant="outlined" fullWidth onClick={onCancel}>Cancel</Button>
            </Stack>
            <ErrorDialog error={error} onClose={() => setError(null)} />
        </Stack>
    );
}

export default function PlanCallItem({call, index, total, impact, metadataByAddress}: {
    call: QueuedCall;
    index: number;
    total: number;
    impact: CallImpact;
    metadataByAddress: Record<string, TokenMetadata>;
}) {
    const {dispatch, canEdit} = useTransactionPlan();
    const [editing, setEditing] = useState(false);

    return (
        <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
            {editing ? (
                <PlanCallEditor
                    call={call}
                    onSave={(updated) => {
                        dispatch({type: "UPDATE_CALL", call: updated});
                        setEditing(false);
                    }}
                    onCancel={() => setEditing(false)}
                />
            ) : (
                <Stack spacing={1.5}>
                    <CallSummary call={call} index={index} />
                    <CallImpactSummary impact={impact} call={call} metadataByAddress={metadataByAddress} />
                    <Divider />
                    <Box sx={{display: "flex", flexWrap: "wrap", gap: 0.5}}>
                        <IconButton
                            size="small"
                            aria-label={`Move call ${index + 1} up`}
                            disabled={!canEdit || index === 0}
                            onClick={() => dispatch({type: "MOVE_CALL", callId: call.id, direction: "up"})}
                        >
                            <KeyboardArrowUpIcon />
                        </IconButton>
                        <IconButton
                            size="small"
                            aria-label={`Move call ${index + 1} down`}
                            disabled={!canEdit || index === total - 1}
                            onClick={() => dispatch({type: "MOVE_CALL", callId: call.id, direction: "down"})}
                        >
                            <KeyboardArrowDownIcon />
                        </IconButton>
                        <CopyButton value={call.data} label="Copy calldata" variant="text" />
                        <Button size="small" startIcon={<EditOutlinedIcon />} disabled={!canEdit} onClick={() => setEditing(true)}>
                            Edit
                        </Button>
                        <Button
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            disabled={!canEdit}
                            onClick={() => dispatch({type: "DUPLICATE_CALL", afterCallId: call.id, call: duplicateCall(call)})}
                        >
                            Duplicate
                        </Button>
                        <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            disabled={!canEdit}
                            onClick={() => dispatch({type: "REMOVE_CALL", callId: call.id})}
                        >
                            Remove
                        </Button>
                    </Box>
                </Stack>
            )}
        </Paper>
    );
}
