# AGENTS.md

## Purpose

Refactor Intereth's user interface and experience into a coherent product rather than a collection of adjacent tools.

A substantial UI restructure is allowed.

The target product model is:

```text
Explore
  ↓
inspect contracts and prepare individual actions
  ↓
send immediately
  OR
add to execution
  ↓
Execution
  ↓
review, edit, simulate, inspect, and execute
```

The refactor should make this flow feel natural without reducing Intereth's current power.

Implementation details, component boundaries, exact filenames, and visual micro-decisions are intentionally left to the implementing agent. The guidance below defines the product structure, interaction priorities, and invariants that should survive the refactor.

---

# 1. Product Model: Explore + Execution

Intereth should have two clear conceptual areas:

## Explore

Explore is the default contract interaction workspace.

It is responsible for:

- opening and switching between contract instances;
- adding contracts;
- selecting RPC or wallet-backed access;
- inspecting contract identity and network context;
- searching and filtering functions;
- editing function arguments;
- raw calldata authoring;
- canonical reads;
- speculative reads when available;
- immediate transaction submission;
- adding state-changing calls to execution;
- pinning read expressions for later inspection.

Explore should remain useful for the simplest workflow:

```text
open contract → call one function → inspect result
```

A user who only wants one read or one transaction should not need to understand the execution workspace.

## Execution

Execution is the workspace for composed or stateful work.

It should become the natural home for:

- queued calls;
- call ordering;
- editing and duplication;
- pinned watches;
- speculative state;
- simulation status;
- decoded execution effects;
- events;
- reverts;
- balance changes;
- batch/execution capability review;
- submission and receipt/status tracking;
- session/account/network mismatch recovery.

The current transaction-plan drawer and globally prominent watch panel should be reconsidered as parts of this one execution experience.

The implementation does not need to use literal route names or tabs named "Explore" and "Execution", but the information architecture must make these two responsibilities clear.

---

# 2. Preserve the Existing Domain Model

The previous architecture work separated call authoring from execution.

Preserve that boundary.

The UI should continue to treat a prepared executable call as conceptually separate from:

- its ABI/raw authoring form;
- display metadata;
- queue metadata;
- simulation data;
- transaction status.

Do not re-couple execution logic into visual components for convenience.

UI restructuring may be extensive; execution-domain semantics should remain stable.

---

# 3. Make Execution First-Class

The transaction plan is currently accessed mainly through a floating review button and right-side drawer.

That interaction was appropriate when the plan was a secondary queue. It is becoming too important to remain visually secondary.

Refactor toward a first-class execution workspace.

Possible presentations include:

- a dedicated application view;
- a persistent or collapsible workspace pane on larger screens;
- a full-screen execution surface on mobile;
- another equally clear solution.

The exact pattern is up to the implementing agent.

The important requirement is that execution must feel like a destination with enough room for:

```text
plan
simulation
watches
effects
execution controls
status / receipts
```

Avoid forcing all of these into a narrow drawer if that harms clarity.

---

# 4. Integrate Watches into Execution

Pinned watches are part of speculative execution context.

They should not dominate the Explore page when no watch is relevant.

Move their primary presentation into, or directly alongside, the execution workspace.

Explore should still allow a read expression to be pinned naturally.

Conceptually:

```text
Explore
balanceOf(...)
[ Run on-chain ] [ Run speculative ] [ Pin ]

                         ↓

Execution
Watches
balanceOf(...)
on-chain       speculative
100            80
```

When there are no queued writes, watches may still show canonical state and should remain useful.

Preserve existing watch evaluation semantics and pinned-base-block behavior.

---

# 5. Keep Actions Explicit

Do not reintroduce a global Interact / Simulate mode.

Actions should continue to describe what they do.

For reads, keep the conceptual distinction between:

- canonical/on-chain read;
- speculative read after the current execution plan;
- pinning a watch.

For state-changing calls, keep the conceptual distinction between:

- immediate wallet submission;
- adding the call to execution.

Labels may be improved during the redesign.

For example, "Add to queue" may become "Add to execution" if that better matches the new product model.

Do not hide materially different operations behind ambiguous primary buttons.

---

# 6. Simplify the Explore Workspace

The existing Explore-style surface is functional but visually nested:

```text
page
  paper
    section
      paper
        accordion
          controls
```

Reduce unnecessary surface nesting.

Prefer clear hierarchy through:

- spacing;
- typography;
- grouping;
- separators;
- state;
- restrained use of cards.

Contract functions should be easy to scan.

A useful conceptual hierarchy is:

```text
Contract
  identity / network / access

  Search and filters

  Read
    function(...)
    function(...)

  Write
    function(...)
    function(...)

  Raw call
```

Do not remove search, mutability filters, raw calls, or advanced inputs.

Function signatures and technical data should remain readable and copyable.

---

# 7. Improve Contract Navigation

Contract instances are a central workspace concept.

The navigation should continue to support:

- multiple open contracts;
- selection;
- rename;
- delete;
- add;
- chain identity;
- read-only vs wallet-backed access.

Improve visual hierarchy so users can quickly answer:

- Which contract am I working on?
- Which chain is it on?
- Is it read-only or wallet-backed?
- Which account/network will execute a write?

The desktop experience may keep a contract rail or replace it with an equally clear workspace-navigation model.

On mobile, prioritize usable switching over trying to mimic the desktop rail.

---

# 8. Improve the Add-Contract Experience

The existing ContractManager has many capabilities and should retain them:

- predefined RPC providers;
- custom RPC;
- browser wallet;
- chain detection;
- contract address and label;
- automatic ABI lookup;
- JSON ABI input;
- Solidity function declarations;
- ABI presets;
- raw-only contracts;
- example contracts.

The UI may be substantially reorganized.

The user should not perceive all options as equally important at once.

Prefer progressive disclosure.

A natural flow is conceptually:

```text
1. Choose access / network
2. Choose contract
3. Resolve interface
4. Review and open
```

This does not have to become a wizard.

Advanced options should remain discoverable without overwhelming the primary path.

---

# 9. Establish a Real Visual System

The current UI uses MUI successfully but relies heavily on local `sx` styling and default component appearance.

Create a more coherent visual system.

The desired character is:

- clean;
- technical;
- calm;
- trustworthy;
- modern;
- dense enough for developer tooling without becoming IDE-like by default.

Avoid ornamental "web3" aesthetics such as excessive gradients, neon effects, glassmorphism, or decorative crypto imagery.

## Palette

Prefer a restrained neutral foundation.

Use color primarily to communicate meaning.

Conceptually:

```text
neutral       navigation, surfaces, structure
accent        primary product actions / selection
blue/cyan     reads and speculative state
amber         payable / warning / pending
green         success / confirmed
red           revert / destructive / error
```

The exact palette is up to the implementing agent.

Do not rely on color alone for state.

## Surfaces

Prefer:

- subtle borders;
- limited elevation;
- consistent radius;
- deliberate spacing;
- clear selected states.

Avoid excessive stacks of outlined `Paper` components.

## Typography

Use a strong UI sans-serif hierarchy.

Use monospace intentionally for:

- addresses;
- calldata;
- raw values;
- signatures where appropriate;
- technical responses.

Do not make the entire product look like a terminal.

## Theme

Move reusable visual decisions into the MUI theme or shared design primitives when practical.

Do not replace MUI.

Avoid creating an elaborate custom design-system package.

---

# 10. Make State Easy to Understand

Intereth exposes several different state concepts:

- connected wallet;
- active account;
- active chain;
- contract chain;
- read-only provider;
- transaction-plan ownership;
- simulation readiness;
- speculative snapshot freshness;
- submitted/pending/confirmed execution.

The redesign should help users distinguish them.

Do not solve this by showing more alerts everywhere.

Prefer persistent context in predictable places and alerts only when user attention is actually required.

Critical mismatches must remain explicit:

- wrong wallet account;
- wrong wallet network;
- unavailable provider;
- stale simulation;
- reverted simulation;
- locked/submitted plan.

---

# 11. Clarify Canonical vs Speculative Data

Canonical and speculative values are an important product distinction.

They should have a consistent visual language throughout:

- read results;
- watches;
- plan previews;
- simulation inspection.

Users should never mistake speculative output for confirmed on-chain state.

Use consistent terms and presentation.

The current explicit-action model should be preserved.

---

# 12. Redesign the Execution Workspace Around Review

The execution workspace should answer, in order:

1. What will be executed?
2. In what order?
3. Under which account and chain?
4. What is expected to happen?
5. Are there warnings or reverts?
6. How can it be executed?
7. What happened after submission?

Structure the execution workspace around that review flow rather than around the current component boundaries.

A conceptual layout might be:

```text
Execution
────────────────────────

Context
account · chain · status

Plan
1. approve(...)
2. transfer(...)

Observed state / Watches
...

Simulation
summary
effects
events
reverts
balances

Execution
available method
review / submit

Status
pending / receipts
```

This is not a required exact layout.

The implementing agent should optimize information hierarchy based on actual data density.

---

# 13. Progressive Disclosure for Technical Detail

Intereth is technical software, but raw detail should not obscure the main answer.

Primary surfaces should favor:

- function name/signature;
- destination;
- human-readable arguments;
- native value;
- success/revert;
- important balance changes;
- decoded events;
- gas information where useful.

Raw calldata, raw RPC responses, undecoded logs, and other low-level information should remain accessible through clearly labeled advanced/detail affordances.

Do not remove raw technical visibility.

---

# 14. Responsive Behavior Is Part of the Design

Do not design desktop first and merely stack everything on mobile.

The product should remain usable on narrow screens.

Desktop may use:

- side navigation;
- multi-column workspace;
- persistent execution context.

Mobile should prefer:

- clear top-level switching;
- full-width interaction surfaces;
- full-screen or near-full-screen execution review;
- safe-area aware controls;
- limited sticky UI.

Avoid multiple simultaneous drawers or overlapping floating controls.

---

# 15. Preserve Accessibility

Maintain or improve:

- semantic button labels;
- accessible dialog titles;
- keyboard navigation;
- visible focus;
- meaningful selected states;
- non-color state indicators;
- sufficient contrast;
- responsive touch targets.

Existing tests around accessible labels are valuable and should not be discarded casually.

---

# 16. Preserve Existing Features

The refactor must not intentionally remove current capability.

Preserve, where presently supported:

- predefined networks;
- custom HTTP RPCs;
- wallet-backed contract instances;
- read-only contract instances;
- verified ABI lookup;
- JSON ABI input;
- Solidity interface input;
- ABI presets;
- raw calldata;
- nested parameter editing;
- transaction value/unit input;
- function search and filters;
- canonical reads;
- speculative reads;
- pinned watches;
- immediate sends;
- transaction-plan creation and editing;
- call reorder / duplicate / remove;
- simulation;
- decoded returns;
- decoded events;
- decoded reverts;
- supported token/native balance changes;
- approval recovery;
- atomic wallet execution;
- existing alternative execution paths where currently exposed;
- transaction status and receipts;
- persistence and session recovery;
- account/network mismatch handling.

If a feature moves to a new surface, update tests and documentation accordingly.

---

# 17. Do Not Change Execution Semantics Casually

This is primarily a product/UI refactor.

Do not use it as an excuse to redesign:

- transaction preparation;
- wallet transaction semantics;
- EIP-5792 behavior;
- approval recovery rules;
- persistence invariants;
- simulation RPC behavior;
- simulation endpoint fallback;
- account/chain ownership of plans;
- stale snapshot semantics.

Small supporting code refactors are allowed when they make the new UI structure cleaner.

Any semantic change must be deliberate, justified, and covered by tests.

---

# 18. Component Refactoring Is Encouraged

A consequential visual refactor will likely expose components that are too large or too tied to the previous layout.

It is acceptable to significantly reorganize the component tree.

Good boundaries correspond to product responsibilities such as:

- application shell;
- workspace navigation;
- contract identity;
- contract authoring;
- function browser;
- execution workspace;
- plan list;
- simulation summary;
- technical inspector;
- watch list;
- execution/status area.

Avoid both extremes:

- one enormous page component;
- dozens of tiny wrapper components that add indirection without ownership.

Reuse domain hooks and contexts where they already provide a good boundary.

---

# 19. Navigation and URL State

The implementing agent should consider whether the new Explore / Execution structure benefits from URL-addressable view state.

This is optional.

Do not add a routing library solely because there are two conceptual views if simple application state is sufficient.

If routing materially improves:

- back/forward behavior;
- deep linking;
- refresh behavior;
- future extensibility;

then a lightweight routing change is acceptable.

Keep GitHub Pages deployment constraints in mind.

---

# 20. Empty States Matter

Design explicit empty states for:

- no contracts open;
- contract with no ABI functions;
- empty execution plan;
- no watches;
- simulation unavailable;
- wallet disconnected.

Empty states should teach the next useful action without becoming documentation pages.

The initial landing experience should make it obvious how to open a contract.

---

# 21. Terminology Should Become Consistent

Review product terminology during the refactor.

Prefer a small consistent vocabulary.

Likely core concepts:

```text
Contract
Explore
Execution
Plan
Call
Read
On-chain
Speculative
Watch
Simulation
Wallet
Network / Chain
```

Avoid using multiple labels for the same concept unless technically necessary.

In particular, if the product adopts "Execution" as the destination, review whether "queue", "transaction plan", and "execution plan" are being used inconsistently in user-facing copy.

Internal type names do not all need to change just because UX terminology changes.

---

# 22. Testing Strategy

The refactor may invalidate many component snapshots or structure-specific assertions.

Prefer preserving tests for user-observable behavior rather than old DOM structure.

Add or adapt tests around the new primary flows:

```text
open contract
switch contract
search function
run canonical read
run speculative read when available
pin watch
send immediately
add call to execution
open execution workspace
edit/reorder/remove plan calls
inspect simulation
review execution capability
recover from account/network mismatch
```

Continue running:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Do not reduce coverage simply to make the redesign easier.

---

# 23. Recommended Refactor Sequence

The implementing agent should inspect the code and produce a concrete plan before editing.

A sensible sequence is:

```text
define product shell and theme
        ↓
introduce Explore / Execution information architecture
        ↓
rework contract navigation and contract header
        ↓
simplify function browser / interaction surfaces
        ↓
rework add-contract experience
        ↓
move plan into first-class Execution workspace
        ↓
integrate watches and simulation there
        ↓
refine execution/status review
        ↓
responsive and accessibility pass
        ↓
copy / terminology / documentation cleanup
```

The exact sequence may change to keep tests and intermediate states manageable.

Large commits are not required. Prefer coherent incremental changes.

---

# Non-Goals

Do not use this branch to:

- introduce new VM/compiler/programming functionality;
- introduce new transaction semantics;
- rewrite the simulation engine;
- replace wallet infrastructure;
- replace ethers;
- replace MUI;
- introduce a heavy global-state framework;
- broadly upgrade dependencies;
- turn Intereth into a full IDE;
- remove raw/advanced functionality in the name of simplicity;
- add decorative redesign work disconnected from UX structure.

---

# End-State Principle

The successful result should feel like one application with a natural progression:

```text
Find a contract
      ↓
Understand it
      ↓
Prepare an action
      ↓
Run it now
   or
Build execution
      ↓
Understand expected effects
      ↓
Execute
      ↓
Inspect outcome
```

A simple task should remain simple.

A complex task should gain space and structure instead of accumulating more drawers, cards, alerts, and modes.
