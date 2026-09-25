# AGENTS.md

## Purpose

Refactor Intereth's interaction and execution architecture so the application has clearer boundaries between:

- constructing calls;
- presenting/editing calls;
- executing calls;
- queueing calls;
- simulating calls;
- inspecting results.

This is a preparation and simplification pass.

The goal is not to add a new execution system yet. The goal is to make the existing one easier to extend without duplicating wallet, simulation, queue, or calldata logic.

UI and file structure changes are allowed when they improve these boundaries.

Keep existing user capabilities intact unless this guide explicitly calls for a UX change.

---

## Main Architectural Intention

The application currently tends to mix together:

```text
form state
+ ABI encoding
+ raw calldata handling
+ wallet state
+ send-now behavior
+ queue behavior
+ simulation behavior
+ result presentation
+ error handling
```

inside individual interaction components.

Move toward a simpler conceptual flow:

```text
User input
    ↓
Call preparation
    ↓
Executable call
    ↓
Shared actions
 ├─ run / send on-chain
 ├─ add to plan
 ├─ simulate
 └─ inspect
```

The exact internal types and filenames are deliberately left to the implementing agent.

---

# 1. Introduce a Clear Executable-Call Boundary

Create a small core representation for an EVM call that captures only what is required to execute it.

Conceptually:

```ts
{
  to,
  data,
  value
}
```

Additional execution context may be included if genuinely necessary, but avoid making queue-specific, editor-specific, or UI-specific metadata part of the lowest-level call representation.

ABI-driven interactions and raw calldata interactions should both eventually produce this same execution object.

Existing richer metadata can remain around it for:

- display;
- editing;
- decoding;
- persistence;
- provenance;
- transaction-plan UX.

The important distinction is:

```text
what gets executed
≠
how it was authored
≠
how it is displayed
```

---

# 2. Separate Call Preparation from Call Execution

Components that collect arguments or raw calldata should primarily be responsible for producing a valid call description.

They should not independently reimplement all execution paths.

Move toward shared mechanisms for actions such as:

- send now;
- add to plan;
- perform a read;
- simulate;
- surface execution errors/results.

The exact hook/service/component design is up to the implementing agent.

Do not create abstraction solely for abstraction's sake. The goal is to remove meaningful duplication and make execution behavior consistent.

---

# 3. Reduce Responsibilities of Large Interaction Components

Some current interaction components own too many concerns at once.

Refactor where useful so that components dealing with:

- ABI parameter editing;
- raw calldata editing;
- execution controls;
- result presentation;
- approval recovery;
- queue feedback;

can evolve independently.

Avoid replacing a few large components with a large number of tiny indirection-only wrappers.

Prefer boundaries that correspond to real responsibilities.

---

# 4. Unify ABI and Raw Call Execution Paths

ABI calls and raw calls should remain different authoring experiences, but once calldata exists they should share as much execution infrastructure as practical.

Conceptually:

```text
ABI form ───────┐
                ├─> prepared executable call ─> actions
Raw calldata ───┘
```

Do not force raw calls through ABI-specific structures.

Do not force ABI calls to discard useful source metadata.

The execution layer should care primarily about the final EVM call.

---

# 5. Make the Transaction Plan Source-Agnostic

The transaction plan should be capable of representing executable calls regardless of where they originated.

Preserve existing features such as:

- rich display metadata;
- editor reconstruction;
- ordering;
- persistence;
- simulation;
- decoding;
- execution tracking.

But avoid making the queue's core execution semantics depend on a particular authoring UI.

Treat source/editor metadata as supporting information layered around the executable call.

Existing persisted state compatibility should be considered during the refactor. Avoid unnecessary storage-format breakage.

---

# 6. Remove the Global Interact / Simulate Behavioral Mode

The current global `Interact` / `Simulate` workspace switch should be reconsidered and, preferably, removed.

Simulation is an action/capability, not a global application mode.

The desired direction is that users choose explicit actions based on what they want to do.

For reads, that can conceptually mean:

```text
Run on-chain
Simulate after plan
Pin/watch
```

For writes:

```text
Send now
Add to plan
```

The exact labels and layout are flexible.

The key requirement is that the UI should communicate the action being taken directly instead of changing the semantics of the entire application through a global mode.

---

## Simulation Should Remain

Do **not** remove the underlying simulation functionality.

Preserve capabilities including:

- speculative reads after queued calls;
- queue previews;
- watches;
- decoded events;
- decoded reverts;
- balance changes;
- simulation endpoint status;
- comparison against canonical state.

Instead, expose them contextually.

For example, simulation naturally belongs around:

- an individual read action;
- a queued transaction plan;
- a watch;
- a plan-inspection panel.

Prefer capability checks such as:

```text
Can this read be simulated?
Is queued-state simulation ready?
Is there a compatible endpoint?
```

rather than:

```text
Is the entire application in simulate mode?
```

If the workspace mode context becomes unnecessary, remove it.

---

# 7. Clarify the Transaction Plan UX

The plan is already a major execution concept and should become a clearer home for speculative inspection.

A useful conceptual organization is:

```text
Transaction plan
├─ queued calls
├─ simulation / execution preview
├─ effects and decoded results
├─ watches
└─ execution controls
```

This is directional rather than a prescribed UI design.

The implementing agent may reorganize the panel or related components where it improves clarity.

Do not turn this branch into a visual redesign unrelated to execution semantics.

---

# 8. Simplify the Contract Workspace Layer

The top-level application currently owns significant contract-instance and workspace lifecycle logic.

Review whether contract workspace state can be represented more cleanly.

In particular, distinguish where practical between:

- serializable contract identity/configuration;
- ABI and presentation metadata;
- provider/wallet association;
- derived `ethers` contract/runner instances;
- selected UI state.

The goal is to reduce coupling between navigation/layout and live `ethers` objects.

Do not build a large state-management framework.

A focused hook/context/domain module is preferable to introducing a new global-state dependency.

---

# 9. Keep Wallet and Execution Semantics Stable

This refactor must preserve existing behavior around:

- wallet connection;
- account and network changes;
- immediate transaction submission;
- atomic batch support;
- sequential execution fallback where currently supported;
- approval recovery;
- persisted plans;
- pending batch tracking;
- transaction receipts.

Refactor these paths only as needed to consume the cleaner call model.

Do not intentionally change their semantics in this branch.

---

# 10. Keep Simulation Semantics Stable

The simulation implementation is substantial and should not be rewritten as part of this refactor.

Refactor its inputs and UI integration where useful, but preserve behavior.

In particular, avoid unnecessary changes to:

- RPC capability probing;
- endpoint fallback;
- pinned base block behavior;
- queued-state simulation;
- watch evaluation;
- decoding;
- token metadata resolution.

The goal is to make simulation easier to invoke and reason about, not to replace it.

---

# 11. Allow UI Restructuring Where It Supports the Model

UI changes are allowed.

Good reasons for UI changes include:

- making actions explicit;
- eliminating global mode-dependent behavior;
- reducing duplicate controls;
- clarifying plan vs immediate execution;
- separating call authoring from execution;
- making simulation results easier to understand.

Avoid unrelated cosmetic redesign.

Preserve the application's existing visual language unless a structural change benefits from a clearer presentation.

---

# 12. Prefer Capability-Driven UI

Where possible, UI behavior should derive from available capabilities and current state.

Examples:

```text
wallet ready
provider supports read
simulation available
plan editable
call is state-changing
call is payable
compatible chain
```

These are preferable to broad global modes that indirectly determine which operations exist.

This should make the UI easier to extend with additional execution sources later.

---

# 13. Testing Expectations

Preserve existing test coverage and add focused tests around new boundaries.

Important invariants include:

- ABI preparation and raw preparation result in valid executable calls;
- adding a call to the plan preserves its execution payload;
- immediate execution uses the same prepared payload;
- simulation consumes equivalent call data;
- authoring metadata survives where required;
- wallet/network lifecycle behavior remains stable;
- reads expose correct on-chain/simulated actions based on capability;
- removal of the global workspace mode does not remove simulation features;
- persisted transaction plans remain usable or are migrated intentionally.

Prefer testing domain behavior separately from large rendered components where the refactor makes that practical.

Do not rewrite the entire test suite for style.

---

# 14. Migration Strategy

Refactor incrementally.

A reasonable conceptual sequence is:

```text
identify core executable-call shape
        ↓
separate preparation from execution
        ↓
share execution actions
        ↓
adapt queue / simulation consumers
        ↓
simplify interaction components
        ↓
remove global mode
        ↓
adjust plan / simulation UI
        ↓
clean workspace structure
```

The implementing agent may choose a different order based on dependency flow.

Keep the application runnable throughout the work where practical.

---

# Non-Goals

Do not use this branch to:

- add a new programming language or compiler;
- add external execution engines;
- introduce new blockchain protocols;
- replace ethers;
- replace Web3-Onboard;
- replace MUI;
- replace React;
- introduce Redux or another large state framework;
- redesign the entire product;
- rewrite the simulation engine;
- rewrite wallet/batch execution semantics;
- broadly upgrade unrelated dependencies;
- introduce new transaction semantics solely for future possibilities.

This branch should leave the application **simpler and more extensible**, not more abstract.

---

# Agent Guidance

Before implementing:

1. inspect the current call preparation, function interaction, raw-call, queue, simulation, wallet, and workspace code;
2. identify actual duplication and coupling before choosing abstractions;
3. write a concrete implementation plan;
4. preserve observable execution semantics;
5. prefer a few strong domain boundaries over many small abstractions;
6. allow UI changes when they clarify the execution model;
7. keep tests passing throughout the refactor;
8. update documentation if user-facing workflows materially change.

Implementation details, file organization, naming, hook boundaries, component decomposition, and exact UI layout are intentionally left to the agent.

The intended end state is conceptually:

```text
Call authoring
     ↓
Prepared executable call
     ↓
Shared execution capabilities
 ┌───────┬──────────┬────────────┐
 read    send       add to plan
                  ↓
             simulation / inspect
```

with simulation available explicitly where relevant rather than as a global workspace mode.
