import { ethers } from "ethers";
import {
    QueuedCall,
    SequentialCallExecution,
    TransactionPlanAction,
    TransactionPlanState,
} from "./types";
import {
    canForgetTrackedExecution,
    isExecutionInFlight,
    isExecutionMutable,
    isSequentialExecutionInFlight,
    isSequentialExecutionMutable,
} from "./executionPolicy";

export function createEmptyTransactionPlanState(): TransactionPlanState {
    return {
        plan: {
            context: null,
            calls: [],
            watches: [],
        },
        execution: {
            status: "idle",
        },
        sequentialExecution: {
            status: "idle",
            calls: [],
        },
    };
}

function callsHaveSameContext(left: QueuedCall, right: QueuedCall) {
    return left.chainId === right.chainId && left.from.toLowerCase() === right.from.toLowerCase();
}

function callMatchesPlan(state: TransactionPlanState, call: QueuedCall) {
    const context = state.plan.context;
    return !context || (context.chainId === call.chainId && context.account.toLowerCase() === call.from.toLowerCase());
}

function hasCallId(state: TransactionPlanState, callId: string) {
    return state.plan.calls.some((call) => call.id === callId);
}

function establishPlan(state: TransactionPlanState, call: QueuedCall): TransactionPlanState["plan"] {
    return {
        ...state.plan,
        context: state.plan.context ?? {account: ethers.getAddress(call.from), chainId: call.chainId},
        calls: [...state.plan.calls, call],
    };
}

function watchMatchesPlan(state: TransactionPlanState, watch: TransactionPlanState["plan"]["watches"][number]) {
    const context = state.plan.context;
    return !context || (context.chainId === watch.chainId
        && context.account.toLowerCase() === watch.from.toLowerCase());
}

function sameWatch(left: TransactionPlanState["plan"]["watches"][number], right: TransactionPlanState["plan"]["watches"][number]) {
    return left.chainId === right.chainId
        && left.from.toLowerCase() === right.from.toLowerCase()
        && left.to.toLowerCase() === right.to.toLowerCase()
        && left.data.toLowerCase() === right.data.toLowerCase()
        && left.value === right.value;
}

function planIsMutable(state: TransactionPlanState) {
    return isExecutionMutable(state.execution) && isSequentialExecutionMutable(state.sequentialExecution);
}

function currentSequentialRecord(state: TransactionPlanState) {
    return state.sequentialExecution.calls[state.sequentialExecution.calls.length - 1];
}

function nextSequentialCall(state: TransactionPlanState) {
    const completedCount = state.sequentialExecution.calls.filter((call) => call.status === "confirmed").length;
    return state.plan.calls[completedCount];
}

function replaceCurrentSequentialRecord(state: TransactionPlanState, record: SequentialCallExecution) {
    const calls = [...state.sequentialExecution.calls];
    calls[calls.length - 1] = record;
    return calls;
}

export function transactionPlanReducer(state: TransactionPlanState, action: TransactionPlanAction): TransactionPlanState {
    switch (action.type) {
        case "ADD_CALL":
            if (!planIsMutable(state) || !callMatchesPlan(state, action.call) || hasCallId(state, action.call.id)) {
                return state;
            }
            return {...state, plan: establishPlan(state, action.call)};
        case "UPDATE_CALL": {
            if (!planIsMutable(state) || !callMatchesPlan(state, action.call)) {
                return state;
            }
            const previous = state.plan.calls.find((call) => call.id === action.call.id);
            if (!previous || !callsHaveSameContext(previous, action.call)) {
                return state;
            }
            return {
                ...state,
                plan: {...state.plan, calls: state.plan.calls.map((call) => call.id === action.call.id ? action.call : call)},
            };
        }
        case "REMOVE_CALL": {
            if (!planIsMutable(state)) {
                return state;
            }
            const calls = state.plan.calls.filter((call) => call.id !== action.callId);
            return {
                ...state,
                plan: {
                    ...state.plan,
                    calls,
                    context: calls.length === 0 && state.plan.watches.length === 0 ? null : state.plan.context,
                },
            };
        }
        case "DUPLICATE_CALL": {
            if (!planIsMutable(state) || !callMatchesPlan(state, action.call) || hasCallId(state, action.call.id)) {
                return state;
            }
            const index = state.plan.calls.findIndex((call) => call.id === action.afterCallId);
            if (index < 0) {
                return state;
            }
            const calls = [...state.plan.calls];
            calls.splice(index + 1, 0, action.call);
            return {...state, plan: {...state.plan, calls}};
        }
        case "MOVE_CALL": {
            if (!planIsMutable(state)) {
                return state;
            }
            const index = state.plan.calls.findIndex((call) => call.id === action.callId);
            const target = action.direction === "up" ? index - 1 : index + 1;
            if (index < 0 || target < 0 || target >= state.plan.calls.length) {
                return state;
            }
            const calls = [...state.plan.calls];
            [calls[index], calls[target]] = [calls[target], calls[index]];
            return {...state, plan: {...state.plan, calls}};
        }
        case "CLEAR_PLAN":
            return isExecutionInFlight(state.execution) || isSequentialExecutionInFlight(state.sequentialExecution)
                ? state
                : createEmptyTransactionPlanState();
        case "ADD_WATCH":
            if (!planIsMutable(state)
                || !watchMatchesPlan(state, action.watch)
                || state.plan.watches.some((watch) => watch.id === action.watch.id || sameWatch(watch, action.watch))) {
                return state;
            }
            return {
                ...state,
                plan: {
                    ...state.plan,
                    context: state.plan.context ?? {account: ethers.getAddress(action.watch.from), chainId: action.watch.chainId},
                    watches: [...state.plan.watches, action.watch],
                },
            };
        case "REMOVE_WATCH": {
            if (!planIsMutable(state)) return state;
            const watches = state.plan.watches.filter((watch) => watch.id !== action.watchId);
            return {
                ...state,
                plan: {
                    ...state.plan,
                    watches,
                    context: watches.length === 0 && state.plan.calls.length === 0 ? null : state.plan.context,
                },
            };
        }
        case "FORGET_TRACKED_PLAN":
            return canForgetTrackedExecution(state.execution) && !isSequentialExecutionInFlight(state.sequentialExecution)
                ? createEmptyTransactionPlanState()
                : state;
        case "START_BATCH_SUBMISSION":
            return isExecutionMutable(state.execution)
                && isSequentialExecutionMutable(state.sequentialExecution)
                && state.plan.calls.length > 0
                ? {...state, execution: {status: "submitting"}}
                : state;
        case "BATCH_SUBMITTED":
            return state.execution.status === "submitting"
                ? {
                    ...state,
                    execution: {
                        status: "pending",
                        batchId: action.batchId,
                        submittedAt: action.submittedAt,
                        updatedAt: action.submittedAt,
                    },
                }
                : state;
        case "BATCH_SUBMISSION_FAILED":
            return state.execution.status === "submitting"
                ? {...state, execution: {status: "idle", error: action.error}}
                : state;
        case "BATCH_STATUS_UPDATED":
            return (state.execution.status === "pending" || state.execution.status === "invalid")
                && state.execution.batchId
                && action.execution.batchId === state.execution.batchId
                ? {
                    ...state,
                    execution: {
                        ...action.execution,
                        submittedAt: state.execution.submittedAt,
                        updatedAt: action.updatedAt,
                    },
                }
                : state;
        case "RESET_FAILED_BATCH":
            return state.execution.status === "offchain_failed" || state.execution.status === "reverted"
                ? {...state, execution: {status: "idle"}}
                : state;
        case "START_SEQUENTIAL_EXECUTION":
            return state.sequentialExecution.status === "idle"
                && isExecutionMutable(state.execution)
                && state.plan.calls.length > 0
                ? {
                    ...state,
                    sequentialExecution: {status: "active", calls: [], startedAt: action.startedAt, updatedAt: action.startedAt},
                }
                : state;
        case "START_SEQUENTIAL_CALL": {
            if (state.sequentialExecution.status !== "active") return state;
            const current = currentSequentialRecord(state);
            if (current && current.status !== "confirmed") return state;
            const next = nextSequentialCall(state);
            if (!next || next.id !== action.callId) return state;
            return {
                ...state,
                sequentialExecution: {
                    ...state.sequentialExecution,
                    calls: [...state.sequentialExecution.calls, {callId: action.callId, status: "submitting"}],
                },
            };
        }
        case "SEQUENTIAL_CALL_SUBMITTED": {
            const current = currentSequentialRecord(state);
            if (state.sequentialExecution.status !== "active" || !current || current.callId !== action.callId || current.status !== "submitting") {
                return state;
            }
            return {
                ...state,
                sequentialExecution: {
                    ...state.sequentialExecution,
                    calls: replaceCurrentSequentialRecord(state, {
                        ...current,
                        status: "pending",
                        transactionHash: action.transactionHash,
                        submittedAt: action.submittedAt,
                        updatedAt: action.submittedAt,
                    }),
                    updatedAt: action.submittedAt,
                },
            };
        }
        case "SEQUENTIAL_CALL_CONFIRMED": {
            const current = currentSequentialRecord(state);
            if (state.sequentialExecution.status !== "active" || !current || current.callId !== action.callId || (current.status !== "pending" && current.status !== "submitting")) {
                return state;
            }
            const confirmed = {
                ...current,
                status: "confirmed" as const,
                transactionHash: action.transactionHash,
                blockNumber: action.blockNumber,
                gasUsed: action.gasUsed,
                updatedAt: action.updatedAt,
                error: undefined,
            };
            const calls = replaceCurrentSequentialRecord(state, confirmed);
            const completed = calls.length === state.plan.calls.length;
            return {
                ...state,
                sequentialExecution: {
                    ...state.sequentialExecution,
                    status: completed ? "completed" : "active",
                    calls,
                    updatedAt: action.updatedAt,
                },
            };
        }
        case "SEQUENTIAL_CALL_FAILED": {
            const current = currentSequentialRecord(state);
            if (state.sequentialExecution.status !== "active" || !current || current.callId !== action.callId || (current.status !== "pending" && current.status !== "submitting")) {
                return state;
            }
            return {
                ...state,
                sequentialExecution: {
                    ...state.sequentialExecution,
                    calls: replaceCurrentSequentialRecord(state, {
                        ...current,
                        status: "failed",
                        transactionHash: action.transactionHash ?? current.transactionHash,
                        blockNumber: action.blockNumber,
                        gasUsed: action.gasUsed,
                        error: action.error,
                        updatedAt: action.updatedAt,
                    }),
                    updatedAt: action.updatedAt,
                },
            };
        }
        case "RETRY_SEQUENTIAL_CALL": {
            const current = currentSequentialRecord(state);
            if (state.sequentialExecution.status !== "active" || !current || current.callId !== action.callId || current.status !== "failed") {
                return state;
            }
            return {
                ...state,
                sequentialExecution: {
                    ...state.sequentialExecution,
                    calls: state.sequentialExecution.calls.slice(0, -1),
                },
            };
        }
        case "STOP_SEQUENTIAL_EXECUTION": {
            if (state.sequentialExecution.status !== "active") return state;
            const current = currentSequentialRecord(state);
            if (current && (current.status === "submitting" || current.status === "pending")) return state;
            return {
                ...state,
                sequentialExecution: {...state.sequentialExecution, status: "stopped", updatedAt: action.updatedAt},
            };
        }
        case "RESET_SEQUENTIAL_EXECUTION":
            return state.sequentialExecution.status === "completed" || state.sequentialExecution.status === "stopped"
                ? {...state, sequentialExecution: {status: "idle", calls: []}}
                : state;
        default:
            return state;
    }
}
