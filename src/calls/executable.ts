// The minimal payload required to execute a call on-chain.
//
// This is deliberately separate from *how* a call was authored (ABI form vs
// raw calldata) and from how it is displayed, edited, decoded, or persisted.
// Authoring metadata layers around this triple; execution paths should accept
// no more than it needs.
export interface ExecutableCall {
    to: string;
    data: string;
    value: string;
}

// Projects a richer call (QueuedCall, WatchExpression, ...) down to the
// executable payload, preventing execution paths from reading UI/authoring
// fields by accident.
export function executableOf(call: ExecutableCall): ExecutableCall {
    return {to: call.to, data: call.data, value: call.value};
}
