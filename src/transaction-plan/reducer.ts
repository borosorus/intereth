import { ethers } from "ethers";
import {
    QueuedCall,
    TransactionPlanAction,
    TransactionPlanState,
} from "./types";
import { canForgetTrackedExecution, isExecutionInFlight, isExecutionMutable } from "./executionPolicy";

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
    return Boolean(context
        && context.chainId === watch.chainId
        && context.account.toLowerCase() === watch.from.toLowerCase());
}

function sameWatch(left: TransactionPlanState["plan"]["watches"][number], right: TransactionPlanState["plan"]["watches"][number]) {
    return left.chainId === right.chainId
        && left.from.toLowerCase() === right.from.toLowerCase()
        && left.to.toLowerCase() === right.to.toLowerCase()
        && left.data.toLowerCase() === right.data.toLowerCase()
        && left.value === right.value;
}

export function transactionPlanReducer(state: TransactionPlanState, action: TransactionPlanAction): TransactionPlanState {
    switch (action.type) {
        case "ADD_CALL":
            if (!isExecutionMutable(state.execution) || !callMatchesPlan(state, action.call) || hasCallId(state, action.call.id)) {
                return state;
            }
            return {...state, plan: establishPlan(state, action.call)};
        case "UPDATE_CALL": {
            if (!isExecutionMutable(state.execution) || !callMatchesPlan(state, action.call)) {
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
            if (!isExecutionMutable(state.execution)) {
                return state;
            }
            const calls = state.plan.calls.filter((call) => call.id !== action.callId);
            return {
                ...state,
                plan: {
                    ...state.plan,
                    calls,
                    context: calls.length === 0 ? null : state.plan.context,
                    watches: calls.length === 0 ? [] : state.plan.watches,
                },
            };
        }
        case "DUPLICATE_CALL": {
            if (!isExecutionMutable(state.execution) || !callMatchesPlan(state, action.call) || hasCallId(state, action.call.id)) {
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
            if (!isExecutionMutable(state.execution)) {
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
            return isExecutionInFlight(state.execution) ? state : createEmptyTransactionPlanState();
        case "ADD_WATCH":
            if (!isExecutionMutable(state.execution)
                || !watchMatchesPlan(state, action.watch)
                || state.plan.watches.some((watch) => watch.id === action.watch.id || sameWatch(watch, action.watch))) {
                return state;
            }
            return {...state, plan: {...state.plan, watches: [...state.plan.watches, action.watch]}};
        case "REMOVE_WATCH":
            return isExecutionMutable(state.execution)
                ? {...state, plan: {...state.plan, watches: state.plan.watches.filter((watch) => watch.id !== action.watchId)}}
                : state;
        case "FORGET_TRACKED_PLAN":
            return canForgetTrackedExecution(state.execution) ? createEmptyTransactionPlanState() : state;
        case "START_BATCH_SUBMISSION":
            return isExecutionMutable(state.execution) && state.plan.calls.length > 0
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
        default:
            return state;
    }
}
