import { ethers } from "ethers";
import {
    QueuedCall,
    TRANSACTION_PLAN_STORAGE_VERSION,
    TransactionPlanAction,
    TransactionPlanState,
} from "./types";

export function createEmptyTransactionPlanState(): TransactionPlanState {
    return {
        version: TRANSACTION_PLAN_STORAGE_VERSION,
        plan: {
            context: null,
            calls: [],
            requiresResume: false,
        },
        execution: {
            status: "idle",
            resultsByCallId: {},
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

function canMutate(state: TransactionPlanState) {
    return state.execution.status === "idle" && !state.plan.requiresResume;
}

function establishPlan(state: TransactionPlanState, call: QueuedCall): TransactionPlanState["plan"] {
    return {
        ...state.plan,
        context: state.plan.context ?? {account: ethers.getAddress(call.from), chainId: call.chainId},
        calls: [...state.plan.calls, call],
    };
}

export function transactionPlanReducer(state: TransactionPlanState, action: TransactionPlanAction): TransactionPlanState {
    switch (action.type) {
        case "ADD_CALL":
            if (!canMutate(state) || !callMatchesPlan(state, action.call)) {
                return state;
            }
            return {...state, plan: establishPlan(state, action.call)};
        case "UPDATE_CALL": {
            if (!canMutate(state) || !callMatchesPlan(state, action.call)) {
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
            if (!canMutate(state)) {
                return state;
            }
            const calls = state.plan.calls.filter((call) => call.id !== action.callId);
            return {
                ...state,
                plan: {
                    ...state.plan,
                    calls,
                    context: calls.length === 0 ? null : state.plan.context,
                },
            };
        }
        case "DUPLICATE_CALL": {
            if (!canMutate(state) || !callMatchesPlan(state, action.call)) {
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
            if (!canMutate(state)) {
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
            return state.execution.status === "executing" ? state : createEmptyTransactionPlanState();
        case "RESUME_PLAN":
            return {...state, plan: {...state.plan, requiresResume: false}};
        case "RESTORE_PLAN":
            return {
                ...action.state,
                plan: {...action.state.plan, requiresResume: action.state.plan.calls.length > 0},
                execution: {
                    ...action.state.execution,
                    status: action.state.execution.status === "executing" ? "halted" : action.state.execution.status,
                },
            };
        case "SET_EXECUTION":
            return {...state, execution: action.execution};
        default:
            return state;
    }
}
