import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { ParamValue, ValueUnit } from "../../calls/parameters";
import { prepareAbiCall, prepareRawCall } from "../../calls/prepareCall";
import { normalizeError, NormalizedError } from "../../callUtils";
import { useTransactionPlan } from "../../transaction-plan/context";
import { selectCanForgetTrackedPlan } from "../../transaction-plan/selectors";
import { QueuedCall } from "../../transaction-plan/types";
import { useWalletSession } from "../../wallet/WalletSessionContext";
import ErrorDialog from "../ErrorDialog";
import FunctionCallEditor from "../FunctionCallEditor";
import TransactionValueInput from "../TransactionValueInput";
import AtomicBatchExecution, { useAtomicBatchExecution } from "./AtomicBatchExecution";
import SimulationControls from "./SimulationControls";
import { useTransactionPlanUi } from "../../transaction-plan/uiContext";
import ResponsiveDialog from "../ResponsiveDialog";
import { useWorkspaceMode } from "../../workspace/context";
import InteractSimulationPreview from "./InteractSimulationPreview";
import SimulationInspector from "../simulation/SimulationInspector";
import CopyButton from "../CopyButton";
import { shortAddress, summarizeArgument, summarizeNativeValue } from "../../calls/displayValues";
import { useSimulation } from "../../simulation/context";
import { CallImpact, prioritizeBalanceChanges, selectCallImpact } from "../../simulation/callImpact";
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

function QueuedCallEditor({call, onSave, onCancel}: {call: QueuedCall; onSave: (call: QueuedCall) => void; onCancel: () => void}) {
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
        } catch (fragmentError) {
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

const sessionAlertSx = {
    flexDirection: {xs: "column", sm: "row"},
    alignItems: {xs: "stretch", sm: "center"},
    "& .MuiAlert-message": {minWidth: 0, width: {xs: "100%", sm: "auto"}},
    "& .MuiAlert-action": {
        alignSelf: {xs: "flex-end", sm: "center"},
        ml: {xs: 0, sm: "auto"},
        mr: 0,
        pt: {xs: 1, sm: 0},
        pl: {xs: 0, sm: 2},
    },
};

function SessionNotice() {
    const {state, dispatch, sessionStatus} = useTransactionPlan();
    const wallet = useWalletSession();
    const [error, setError] = useState<NormalizedError | null>(null);
    const [confirmForget, setConfirmForget] = useState(false);
    const context = state.plan.context;
    if (!context || sessionStatus === "ready" || sessionStatus === "empty") {
        return null;
    }

    const canForget = selectCanForgetTrackedPlan(state);
    const forgetButton = canForget ? (
        <Button color="inherit" size="small" onClick={() => setConfirmForget(true)}>
            Forget tracking
        </Button>
    ) : null;
    const forgetDialog = (
        <ResponsiveDialog open={confirmForget} onClose={() => setConfirmForget(false)}>
            <DialogTitle>Forget batch tracking?</DialogTitle>
            <DialogContent>
                <Typography>
                    This removes the local transaction plan and batch ID. It does not cancel, reverse, or change anything in the wallet or on-chain.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConfirmForget(false)}>Cancel</Button>
                <Button color="error" onClick={() => dispatch({type: "FORGET_TRACKED_PLAN"})}>Forget tracking</Button>
            </DialogActions>
        </ResponsiveDialog>
    );

    if (sessionStatus === "chain_mismatch") {
        return (
            <>
                <Alert
                    severity="error"
                    sx={sessionAlertSx}
                    action={<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => wallet.switchChain(context.chainId).catch((switchError) => {
                                setError(normalizeError(switchError, "Network switch failed"));
                            })}
                        >
                            Switch network
                        </Button>
                        {forgetButton}
                    </Stack>}
                >
                    This transaction plan belongs to chain {context.chainId}; the wallet is on chain {wallet.chainId}.
                </Alert>
                {forgetDialog}
                <ErrorDialog error={error} onClose={() => setError(null)} />
            </>
        );
    }

    if (sessionStatus === "account_mismatch") {
        return (
            <>
                <Alert
                    severity="error"
                    sx={sessionAlertSx}
                    action={<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => wallet.connectWallet().catch((connectError) => {
                                setError(normalizeError(connectError, "Wallet connection failed"));
                            })}
                        >
                            Reconnect account
                        </Button>
                        {forgetButton}
                    </Stack>}
                >
                    This transaction plan belongs to {shortAddress(context.account)}, but {wallet.account ? shortAddress(wallet.account) : "another account"} is connected.
                </Alert>
                {forgetDialog}
                <ErrorDialog error={error} onClose={() => setError(null)} />
            </>
        );
    }

    return (
        <>
            <Alert
                severity="warning"
                sx={sessionAlertSx}
                action={(
                    <Button
                        color="inherit"
                        size="small"
                        onClick={() => wallet.connectWallet().catch((connectError) => {
                            setError(normalizeError(connectError, "Wallet connection failed"));
                        })}
                    >
                        Connect wallet
                    </Button>
                )}
            >
                Connect {shortAddress(context.account)} on chain {context.chainId} to resume this plan.
            </Alert>
            <ErrorDialog error={error} onClose={() => setError(null)} />
        </>
    );
}

function QueuedCallItem({call, index, total, impact, metadataByAddress}: {
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
                <QueuedCallEditor
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

export default function TransactionQueuePanel() {
    const {state, dispatch} = useTransactionPlan();
    const [open, setOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const {reviewRequest} = useTransactionPlanUi();
    const workspace = useWorkspaceMode();
    const simulation = useSimulation();
    const batchController = useAtomicBatchExecution(open && workspace.mode === "interact");
    const calls = state.plan.calls;
    const context = state.plan.context;

    useEffect(() => {
        if (reviewRequest > 0 && calls.length > 0) setOpen(true);
    }, [calls.length, reviewRequest]);

    if (calls.length === 0) {
        return null;
    }

    return (
        <>
            <Paper
                elevation={6}
                sx={{
                    position: "fixed",
                    right: {xs: 16, sm: 24},
                    bottom: {xs: "calc(72px + env(safe-area-inset-bottom))", sm: 24},
                    maxWidth: {xs: "calc(100vw - 32px)", sm: "none"},
                    zIndex: (theme) => theme.zIndex.appBar,
                }}
            >
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<PlaylistAddCheckIcon />}
                    onClick={() => setOpen(true)}
                    sx={{py: 1.25, px: 2, minHeight: {xs: 44, sm: "auto"}, textTransform: "none", fontWeight: 800}}
                >
                    {calls.length} queued {calls.length === 1 ? "call" : "calls"} · Review plan
                </Button>
            </Paper>
            <Drawer
                anchor="right"
                open={open}
                onClose={() => setOpen(false)}
                PaperProps={{sx: {
                    width: {xs: "100%", sm: 560},
                    maxWidth: "100%",
                    height: {xs: "100dvh", sm: "100%"},
                    maxHeight: {xs: "100dvh", sm: "100%"},
                }}}
            >
                <Stack sx={{height: "100%"}}>
                    <Box sx={{
                        px: 2,
                        pt: {xs: "calc(16px + env(safe-area-inset-top))", sm: 2},
                        pb: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1,
                    }}>
                        <Box>
                            <Typography variant="h6" sx={{fontWeight: 800}}>Transaction plan</Typography>
                            {context && (
                                <Typography variant="caption" color="text.secondary">
                                    Chain {context.chainId} · {shortAddress(context.account)}
                                </Typography>
                            )}
                        </Box>
                        <IconButton aria-label="Close transaction plan" onClick={() => setOpen(false)}><CloseIcon /></IconButton>
                    </Box>
                    <Divider />
                    <Box sx={{p: 2, overflowY: "auto", WebkitOverflowScrolling: "touch", flex: 1, minHeight: 0}}>
                        <Stack spacing={2}>
                            <SessionNotice />
                            {calls.map((call, index) => (
                                <QueuedCallItem
                                    key={call.id}
                                    call={call}
                                    index={index}
                                    total={calls.length}
                                    impact={selectCallImpact({callId: call.id, revision: simulation.revision, status: simulation.status, snapshot: simulation.snapshot})}
                                    metadataByAddress={simulation.tokenMetadataByAddress}
                                />
                            ))}
                            {workspace.mode === "simulate" && (
                                <>
                                    <SimulationControls />
                                    <SimulationInspector />
                                </>
                            )}
                            {workspace.mode === "interact" ? (
                                <>
                                    <InteractSimulationPreview />
                                    <AtomicBatchExecution controller={batchController} />
                                </>
                            ) : (
                                <Alert severity="info">Switch to Interact to execute this transaction plan.</Alert>
                            )}
                        </Stack>
                    </Box>
                    <Divider />
                    <Box sx={{
                        px: 2,
                        pt: 2,
                        pb: {xs: "calc(16px + env(safe-area-inset-bottom))", sm: 2},
                    }}>
                        <Button
                            color="error"
                            variant="outlined"
                            fullWidth
                            disabled={state.execution.status === "submitting" || state.execution.status === "pending"}
                            onClick={() => setConfirmClear(true)}
                        >
                            Clear plan
                        </Button>
                    </Box>
                </Stack>
            </Drawer>
            <ResponsiveDialog open={confirmClear} onClose={() => setConfirmClear(false)}>
                <DialogTitle>Clear transaction plan?</DialogTitle>
                <DialogContent>
                    <Typography>This removes all {calls.length} queued {calls.length === 1 ? "call" : "calls"}. This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            dispatch({type: "CLEAR_PLAN"});
                            setConfirmClear(false);
                            setOpen(false);
                        }}
                    >
                        Clear plan
                    </Button>
                </DialogActions>
            </ResponsiveDialog>
        </>
    );
}
