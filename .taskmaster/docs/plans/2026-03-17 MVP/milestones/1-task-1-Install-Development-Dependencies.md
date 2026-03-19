# Task 1: Install Development Dependencies

## Overview

This task establishes the project's testing and AI infrastructure by installing four packages — `openai`, `vitest`, `@vitest/coverage-v8`, and `@playwright/test` — with correct dev/prod separation, then wiring their corresponding `package.json` scripts. No source code is written here; the goal is a green baseline that all subsequent tasks (2–15) can build on top of.

---

## Requirements Analysis

### Functional Requirements

- Install `openai@^6.31.0` as a production dependency (used at runtime by the server action).
- Install `vitest@^4.1.0`, `@vitest/coverage-v8@^4.1.0`, and `@playwright/test@^1.58.0` as `devDependencies` (used only during development and CI).
- Add four `package.json` scripts: `test`, `test:coverage`, `test:e2e`, and `test:e2e:ui`.
- Download Playwright browser binaries (Chromium, Firefox, WebKit) via `pnpx playwright install`.
- The project must remain fully type-checkable (`pnpm type-check`) and lint-clean after installation.

### Non-Functional Requirements

- **Security**: `OPENAI_API_KEY` must never reach the client bundle; the `openai` package is accessed only inside server-side route actions and `app/lib/ai/` modules.
- **Dependency integrity**: No peer-dependency conflicts between `vitest@^4.1.0`, `vite@^7.0.0` (already installed), and `@react-router/dev@^7.0.0`.
- **CI readiness**: Script names (`test`, `test:e2e`) must be stable enough for CI pipelines added in later milestones.
- **Minimal footprint**: Do not install `@vitest/browser-playwright` or other Vitest browser-mode packages — unit tests run in Node; Playwright handles E2E independently.

### Dependencies & Constraints

- **Internal**: No other task depends on this task completing before it can start (Tasks 4, 5, 9 have zero dependencies), but Tasks 2, 3, 7, 8 list Task 1 as a prerequisite.
- **External**:
  - Node.js ≥ 22 (already satisfied per `engines` field in `package.json`).
  - Vite `^7.0.0` is already installed; Vitest 4.x requires Vite ≥ 6.0.0 — confirmed compatible.
  - An active OpenAI account with GPT-4o-mini access and pay-as-you-go billing must be provisioned before integration testing (Task 10 onwards).
- **Technical**:
  - `pnpm` workspace lockfile (`pnpm-lock.yaml`) must be committed alongside `package.json` changes.
  - The project uses `"type": "module"` — all config files must use ESM syntax or `.mjs` extensions.

---

## Implementation Plan

### Phase 1: Install npm Packages

**Objective**: Add all four packages to `package.json` with correct dependency classification.

#### Subtask 1.1: Install `openai` as a production dependency

- **Files to create/modify**: `package.json`, `pnpm-lock.yaml`
- **Command**:
  ```bash
  pnpm add openai@^6.31.0
  ```
- **Key considerations**:
  - The `openai` package must be in `dependencies`, not `devDependencies`, because the production server (via `react-router-serve`) needs it at runtime.
  - The installed version will be `6.31.x` or higher within the `^6.31.0` range. The latest as of 2026-03-17 is `6.32.0` — the caret range will pick this up.
  - No `VITE_` prefix on any env var the package reads; this is enforced architecturally (the package is only imported in server modules).
- **Acceptance criteria**: `package.json` `dependencies` section contains `"openai": "^6.31.0"` (or the resolved version). `pnpm install` completes without errors.

#### Subtask 1.2: Install testing packages as devDependencies

- **Files to create/modify**: `package.json`, `pnpm-lock.yaml`
- **Command**:
  ```bash
  pnpm add -D vitest@^4.1.0 @vitest/coverage-v8@^4.1.0 @playwright/test@^1.58.0
  ```
- **Key considerations**:
  - `vitest@^4.1.0` requires Vite ≥ 6.0.0. The project already uses `vite@^7.0.0` — confirmed compatible per Vitest 4 release notes.
  - `@vitest/coverage-v8` must match the exact minor version of `vitest` to avoid peer-dependency warnings. Using matching `^4.1.0` ranges satisfies this.
  - Do **not** install `@vitest/browser-playwright` — that is for Vitest's Browser Mode, which is not used here. Playwright runs independently.
  - Vitest 4.x removed the `poolOptions` top-level configuration key; Task 2 (Vitest config) must not use it.
  - Vitest 4.x removed `coverage.all` — Task 2's coverage config must use `coverage.include` instead.
- **Acceptance criteria**: `package.json` `devDependencies` contains all three packages at correct version ranges. `pnpm install` produces no peer-dependency errors.

---

### Phase 2: Update package.json Scripts

**Objective**: Add test runner scripts so all subsequent tasks and CI can execute tests with short commands.

#### Subtask 2.1: Add test scripts to package.json

- **Files to create/modify**: `package.json`
- **Script additions**:
  ```json
  {
    "scripts": {
      "test": "vitest",
      "test:coverage": "vitest run --coverage",
      "test:e2e": "playwright test",
      "test:e2e:ui": "playwright test --ui"
    }
  }
  ```
- **Key considerations**:
  - `vitest` (without `run`) starts the interactive watch mode — correct for local development.
  - `vitest run --coverage` runs a single pass with coverage output — correct for CI.
  - `playwright test` invokes Playwright's CLI using the config in `playwright.config.ts` (created in Task 3).
  - The existing scripts (`dev`, `build`, `start`, `type-check`) must not be modified.
  - Scripts are ordered logically; new scripts added after `type-check`.
- **Acceptance criteria**: Running `pnpm test --version` (or `pnpm exec vitest --version`) prints the Vitest version. Running `pnpm exec playwright --version` prints the Playwright version.

---

### Phase 3: Download Playwright Browser Binaries

**Objective**: Install browser binaries so E2E tests (Task 15) can run against real browsers.

#### Subtask 3.1: Run playwright install

- **Files to create/modify**: None (binaries stored in Playwright's cache directory, not in the repo).
- **Command**:
  ```bash
  pnpx playwright install
  ```
- **Key considerations**:
  - This downloads Chromium, Firefox, and WebKit. Total download size is approximately 300–500 MB.
  - In CI environments, this command must be run before `pnpm test:e2e`. A CI step `pnpx playwright install --with-deps` installs OS-level browser dependencies as well (Linux only).
  - The binaries are stored in `~/.cache/ms-playwright/` (macOS/Linux) and are not committed to the repository.
  - If only Chromium is needed for local development, `pnpx playwright install chromium` reduces download size.
- **Acceptance criteria**: `pnpm exec playwright --version` prints `Version 1.58.x`. Running `pnpx playwright install --dry-run` shows browsers as installed.

---

## Third-Party Integration Research

### openai v6.31.0 (latest: v6.32.0)

- **Official docs**: [https://github.com/openai/openai-node](https://github.com/openai/openai-node) — TypeScript-first SDK; all request and response types are auto-generated from the OpenAI OpenAPI spec.
- **Recent changes**: v6.32.0 released 2026-03-17 (same day as this milestone). Changes are additive (new model slugs, filter type enhancements). No breaking changes in the `^6.31.0` range.
- **v6.0 breaking changes**: The `ResponseFunctionToolCallOutputItem.output` field changed from `string` to `string | Array<...>`. This only affects code using the Responses API — not `chat.completions.create()`, which this task uses. Not relevant.
- **Open issues / known bugs**: Dependabot vulnerability updates were applied in recent releases; no unpatched CVEs affecting `chat.completions.create()` are known.
- **Security advisories**: None found affecting the `chat.completions` surface used in this project.
- **Performance notes**: The SDK uses `node-fetch` under the hood on Node.js. For high-throughput use, streaming completions reduce time-to-first-byte; not needed for MVP.
- **Case studies**: The SDK is the official OpenAI-maintained TypeScript client and is widely adopted. No unusual adoption concerns.

### vitest v4.1.0 (latest: v4.1.x)

- **Official docs**: [https://vitest.dev/guide/](https://vitest.dev/guide/) — configuration, migration guide at [https://vitest.dev/guide/migration.html](https://vitest.dev/guide/migration.html).
- **Recent changes**:
  - v4.0 removed `poolOptions` as a top-level configuration namespace — all former nested options are now top-level (e.g., `maxWorkers` replaces `maxThreads`/`maxForks`).
  - `coverage.all` and `coverage.extensions` options removed. Must use `coverage.include` to specify which files to instrument.
  - `coverage.ignoreEmptyLines` removed; empty lines are now excluded automatically.
  - `coverage.experimentalAstAwareRemapping` removed; AST-based remapping is now the default.
  - Vitest 4 no longer pulls in `@types/node` automatically — projects must declare `"types": ["node"]` in `tsconfig.json` explicitly (the project already does this).
  - v4.1 adds Vite 8 beta compatibility and type fixes.
- **Open issues / known bugs**: None blocking for this project's use case (Node environment, V8 coverage).
- **Security advisories**: None found.
- **Performance notes**: Vitest 4 rewrote the worker pool without `tinypool`, which reduces memory overhead. The `node` test environment (used for server-side module tests) is fast and lightweight.
- **Case studies**: Vitest 4 was released with stable Browser Mode and Visual Regression testing; neither is used in this milestone.

> ⚠️ **Needs Review**: Vitest 4's `coverage.all` option was removed. Task 2 (Configure Vitest) must use `coverage.include: ['app/lib/**/*.ts']` instead of `coverage.all: true`. Omitting `coverage.include` causes Vitest to instrument only files that were actually executed during tests, which could silently reduce coverage numbers for untested code paths. Ensure `coverage.include` is explicit in `vitest.config.ts`.

### @playwright/test v1.58.0 (latest: v1.58.x)

- **Official docs**: [https://playwright.dev/docs/intro](https://playwright.dev/docs/intro) — config reference at [https://playwright.dev/docs/test-configuration](https://playwright.dev/docs/test-configuration).
- **Recent changes**:
  - v1.58 removes `_react` and `_vue` selector engines — not used in this project.
  - v1.58 removes `:light` selector suffix — not used.
  - v1.58 removes `devtools` launch option — not used.
  - macOS 13 WebKit support dropped — developers on macOS 13 must upgrade or skip WebKit tests.
  - Browser versions: Chromium 145.0.7632.6, Firefox 146.0.1, WebKit 26.0.
- **Open issues / known bugs**: No blocking issues found for the `webServer` + `goto` + `locator` usage pattern in this milestone.
- **Security advisories**: None found.
- **Performance notes**: `fullyParallel: true` is recommended for suites with multiple spec files; CI should set `workers: 1` to avoid resource contention on shared runners.
- **Case studies**: Widely adopted; no unusual adoption concerns for a React SSR app.

---

## Code Patterns

### Pattern 1: Package Script Naming Convention

```json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "type-check": "react-router typegen && tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Where to apply**: `package.json` root `scripts` block.

**Why this pattern**: Using namespaced scripts (`test:coverage`, `test:e2e`) keeps the `test` command as the fast watch-mode entry point while giving CI distinct commands for each test type. Consistent with the project's existing `type-check` naming.

---

## Test Cases

### Unit Tests

This task produces no source modules to unit test. Verification is performed via CLI commands.

### Integration Tests

Not applicable for a dependency installation task.

### E2E Tests

Not applicable for this task.

### Verification Tests (Manual CLI)

**Test 1**: Verify openai package installation

- **Given**: Task 1 subtask 1.1 completed
- **When**: `pnpm exec node -e "import('openai').then(m => console.log(m.default.name))"`
- **Then**: Prints `OpenAI` with no errors
- **Coverage**: Confirms the package resolves correctly under ESM

**Test 2**: Verify vitest installation

- **Given**: Task 1 subtask 1.2 completed
- **When**: `pnpm exec vitest --version`
- **Then**: Prints `4.1.x` (or higher within caret range)
- **Coverage**: Confirms vitest CLI is available

**Test 3**: Verify @vitest/coverage-v8 installation

- **Given**: Task 1 subtask 1.2 completed
- **When**: Create a trivial test file with `it('sanity', () => expect(1).toBe(1))`, run `pnpm test:coverage`, then delete the file
- **Then**: Coverage report is generated without `Error: Unknown coverage provider 'v8'`
- **Coverage**: Confirms v8 provider is linked correctly to the installed vitest version

**Test 4**: Verify playwright installation

- **Given**: Task 1 subtask 3.1 completed
- **When**: `pnpm exec playwright --version`
- **Then**: Prints `Version 1.58.x`
- **Coverage**: Confirms Playwright CLI and binaries are installed

**Test 5**: Verify no TypeScript regressions

- **Given**: All packages installed
- **When**: `pnpm type-check`
- **Then**: Zero TypeScript errors (the `openai` package ships its own `.d.ts` files; no `@types/openai` needed)
- **Coverage**: Guards against type pollution from newly installed packages

**Test 6**: Verify no ESLint regressions

- **Given**: All packages installed
- **When**: `pnpm exec eslint .`
- **Then**: Zero ESLint errors on existing source files
- **Coverage**: Guards against lint config conflicts introduced by new packages

---

## Implementation Checklist

- [ ] Run `pnpm add openai@^6.31.0` and verify `package.json` `dependencies` updated
- [ ] Run `pnpm add -D vitest@^4.1.0 @vitest/coverage-v8@^4.1.0 @playwright/test@^1.58.0` and verify `devDependencies` updated
- [ ] Add `test`, `test:coverage`, `test:e2e`, `test:e2e:ui` scripts to `package.json`
- [ ] Run `pnpx playwright install` to download browser binaries
- [ ] Verify `pnpm exec vitest --version` prints `4.1.x`
- [ ] Verify `pnpm exec playwright --version` prints `1.58.x`
- [ ] Run `pnpm type-check` — zero errors
- [ ] Run `pnpm exec eslint .` — zero errors
- [ ] Commit `package.json` and `pnpm-lock.yaml` together

---

## Notes & Considerations

**Downstream contract for Task 2 (Configure Vitest)**:
Vitest 4 removed `poolOptions` as a configuration namespace and `coverage.all`. Task 2's `vitest.config.ts` must:

- Use `coverage.include: ['app/lib/**/*.ts']` (not `coverage.all: true`)
- Not reference `poolOptions` at the top level
- Reference the `mergeConfig` import from `'vitest/config'` (not `'vite'`)

**Downstream contract for Task 3 (Configure Playwright)**:
Playwright 1.58 removed `_react`/`_vue` selectors and the `devtools` launch option. Task 3's `playwright.config.ts` must not use these removed APIs.

**Version pinning note**:
The `^6.31.0` range for `openai` will resolve to `6.32.0` at time of installation. This is safe — the v6.x series only had a breaking change at `6.0.0` (affecting the Responses API, not chat completions). All subsequent 6.x releases are additive.

**ESM compatibility**:
The project uses `"type": "module"`. The `openai` package ships both CJS and ESM builds and is fully compatible. Vitest 4 works natively with Vite's ESM pipeline. No `transform` overrides are needed.

**Playwright browser cache**:
The `~/.cache/ms-playwright` directory is gitignored by default. In CI, cache this directory between runs (keyed on the Playwright version) to avoid re-downloading browsers on every pipeline run.
