# AGENTS.md

## Purpose

Modernize Intereth's frontend tooling without changing the application's product behavior or architecture.

The current baseline is:

```text
Create React App
react-scripts 5
TypeScript 4.9
        ↓
small tooling migration
        ↓
Vite
modern TypeScript
clean ESM/package consumption
```

This is a tooling and build-system migration only.

Do not use this work as an opportunity for unrelated application refactors, UI redesigns, dependency churn, or feature work.

---

## Primary Goals

The completed migration should provide:

- Vite as the development and production bundler;
- a current TypeScript 5.x setup;
- standard ESM-friendly dependency consumption;
- a clean package boundary for consuming modern JavaScript / TypeScript packages;
- equivalent development, test, build, and deployment workflows;
- the same user-visible application behavior as before the migration.

Keep the change set understandable and easy to review.

---

## Preserve the Application

The application already has substantial behavior around:

- contract interaction;
- wallet sessions;
- transaction plans;
- simulation;
- ABI lookup;
- workspace state;
- persistence;
- deployment to GitHub Pages.

Do not restructure these systems as part of the tooling migration.

In particular, avoid unnecessary upgrades or rewrites of:

- React;
- MUI;
- ethers;
- Web3-Onboard;
- application state/context architecture;
- transaction or simulation logic.

Only change application code where required by the build, module, test, or runtime environment migration.

---

# Migration Roadmap

## 1. Establish the new Vite application shell

Replace the CRA / `react-scripts` build lifecycle with Vite.

The resulting scripts should provide clear equivalents for:

```text
development server
production build
tests
deployment
```

A conventional end state is expected to resemble:

```text
npm run dev
npm run build
npm test
npm run deploy
```

Exact script names may be chosen to minimize disruption, but remove obsolete CRA-only scripts such as `eject`.

Keep npm as the repository package-management workflow and remove conflicting package-manager artifacts if appropriate.

---

## 2. Migrate the HTML entry point and static assets

CRA currently owns `public/index.html` and injects the application bundle.

Vite expects the HTML entry point at the project root.

Migrate the current document metadata and root element without changing the page's behavior or branding.

Preserve:

- title;
- favicon / application mark;
- manifest if it remains useful;
- theme metadata;
- root mount element;
- static assets.

Remove CRA-specific template syntax such as:

```text
%PUBLIC_URL%
```

Use Vite-compatible asset paths and configure the deployment base path correctly.

Do not remove existing public assets merely because they are not required by Vite unless they are clearly obsolete.

---

## 3. Preserve the React entrypoint

The existing React 18 entrypoint is already suitable for a modern bundler.

Keep the current provider hierarchy and application initialization intact unless Vite requires a small mechanical change.

The migration should not alter:

- `React.StrictMode`;
- theme setup;
- wallet provider setup;
- workspace providers;
- simulation providers;
- transaction-plan providers;
- component ordering.

Rename the entry file only if there is a concrete benefit.

---

## 4. Move to modern TypeScript

Upgrade from TypeScript 4.9 to a current, stable TypeScript 5.x version that works cleanly with the selected Vite version and the existing dependencies.

Review `tsconfig.json` rather than blindly replacing it with a generated template.

The resulting configuration should remain strict and browser-focused.

Prefer modern module settings suitable for Vite and ESM package consumption.

Preserve useful existing checks such as:

- `strict`;
- consistent file casing;
- isolated modules;
- JSON module support;
- no emit from the application typecheck.

Remove CRA-specific TypeScript declarations such as:

```text
src/react-app-env.d.ts
```

and replace them with the appropriate Vite environment typing if needed.

Do not weaken type checking merely to make the migration pass.

---

## 5. Make ESM/package consumption conventional

One important outcome of this migration is that Intereth should consume ordinary modern packages without CRA-specific workarounds.

Review the final setup for compatibility with packages that expose:

- ESM JavaScript;
- package `exports`;
- generated `.d.ts` declarations;
- modern `import` syntax;
- browser-compatible dependencies.

Avoid adding custom transpilation hacks, aliases, source imports into dependency repositories, or other bundler-specific exceptions unless a concrete existing dependency requires them.

Prefer standard package entry points.

The application should not depend on Node runtime APIs in browser code.

---

## 6. Migrate the test runner cleanly

The current tests rely on the Jest environment supplied by `react-scripts`, including globals such as:

```ts
describe(...)
it(...)
expect(...)
jest.fn(...)
```

Move the test setup off CRA.

Vitest is the natural default with Vite, but the implementing agent should confirm the simplest migration based on the existing suite.

Preserve the current testing intent and coverage.

If using Vitest:

- configure the appropriate test environment;
- keep Testing Library compatibility where used;
- migrate Jest-specific mocks to their Vitest equivalents;
- prefer explicit imports or a clearly configured globals policy;
- avoid broad rewrites of otherwise valid tests.

The goal is test-runner portability, not test redesign.

Tests involving browser APIs, `fetch`, `AbortController`, local storage, wallets, or DOM behavior should continue to run under an environment that matches their needs.

---

## 7. Preserve GitHub Pages deployment

The current production deployment is hosted under a repository subpath rather than at the domain root.

Configure Vite's production base path so generated asset URLs work correctly when deployed there.

Preserve the existing deployment workflow conceptually:

```text
build
→ static output directory
→ gh-pages
```

Vite normally outputs to `dist/`; update deployment scripts and README documentation accordingly.

Do not keep CRA's `homepage` mechanism merely for compatibility if Vite has a clearer native configuration.

Verify that direct page loading and static asset loading work from the deployed subpath.

---

## 8. Update development documentation

Update the README after the migration so it accurately documents:

- required Node version if one is introduced;
- package installation;
- development command;
- test command;
- typecheck command if separate;
- production build;
- build output directory;
- deployment command;
- expected GitHub Pages base path.

Remove CRA-specific instructions and terminology.

Keep the documentation short and operational.

---

# Dependency Policy

This migration should update dependencies that are directly part of the tooling transition.

Expected candidates include:

- removing `react-scripts`;
- upgrading `typescript`;
- adding `vite`;
- adding the React Vite plugin;
- adding or migrating the test runner and test environment;
- updating associated type/tooling packages when required.

Do not perform a general dependency refresh.

Specifically, do not upgrade major application dependencies simply because newer versions exist.

If an existing application dependency is incompatible with the new tooling and must be changed, keep the change narrowly scoped and document the reason.

---

# Package Manager Cleanup

The repository should finish with one clear package-manager source of truth.

Prefer npm, consistent with the existing development documentation and `package-lock.json`.

If a stale alternative lockfile is present, remove it as part of the migration rather than maintaining two dependency graphs.

Do not switch package managers as part of this task.

---

# Verification Expectations

Before considering the migration complete, verify at minimum:

- clean `npm install` succeeds;
- TypeScript typechecking succeeds;
- the full test suite succeeds;
- the Vite development server starts without runtime errors;
- the production build succeeds;
- the production bundle loads under the configured repository base path;
- public assets resolve correctly;
- wallet / provider initialization still builds correctly;
- no browser bundle depends on Node built-ins;
- no CRA-specific references remain unless intentionally retained;
- README commands match the actual scripts.

Also perform a basic application smoke check covering the main workspace render and representative existing flows.

Do not accept a migration that only builds while silently disabling tests or weakening TypeScript checks.

---

# Likely CRA-Specific Cleanup

Inspect the repository for and handle relevant CRA conventions, including:

- `react-scripts`;
- `src/react-app-env.d.ts`;
- `public/index.html`;
- `%PUBLIC_URL%`;
- CRA-generated HTML comments;
- Jest configuration implicitly supplied by CRA;
- CRA-only ESLint configuration;
- `homepage`-driven asset behavior;
- assumptions that production output lives in `build/`.

Search the actual repository before changing these; do not assume every standard CRA artifact is still in use.

---

# ESLint and Formatting

Do not let lint configuration become a second modernization project.

CRA currently supplies lint behavior indirectly.

When removing CRA:

- preserve a reasonable lint path if practical;
- use a small explicit configuration if needed;
- do not introduce an elaborate style/toolchain migration;
- avoid mass formatting unrelated files.

Lint cleanup should remain subordinate to the Vite/TypeScript migration.

---

# Non-Goals

Do not use this branch to:

- add product features;
- redesign UI components;
- reorganize application domains;
- change wallet behavior;
- change transaction semantics;
- change simulation behavior;
- replace React;
- upgrade React solely for freshness;
- replace MUI;
- replace ethers;
- replace Web3-Onboard;
- introduce a new state-management framework;
- rewrite tests for style;
- adopt a different package manager;
- introduce SSR;
- introduce a framework on top of Vite;
- optimize production bundle size beyond fixing obvious migration regressions.

The desired result is a modernized foundation, not a rewritten application.

---

# Implementation Style

Before editing:

1. inspect the existing package scripts, TypeScript configuration, entrypoint, tests, public assets, and deployment assumptions;
2. form a concrete migration plan based on the actual repository;
3. make the smallest coherent set of changes;
4. keep the application behavior stable;
5. run tests and build checks throughout the migration;
6. update documentation only after the final commands and paths are known.

Prefer ordinary Vite conventions over custom compatibility layers.

When multiple valid approaches exist, choose the one that leaves the repository easiest for another TypeScript developer to understand.

---

## Target End State

The repository should end in a state conceptually like:

```text
React 18 application
        ↓
modern TypeScript
        ↓
standard ESM imports / package exports
        ↓
Vite dev + production build
        ↓
portable test runner
        ↓
static GitHub Pages deployment
```

The application above that tooling layer should remain recognizably the same.
