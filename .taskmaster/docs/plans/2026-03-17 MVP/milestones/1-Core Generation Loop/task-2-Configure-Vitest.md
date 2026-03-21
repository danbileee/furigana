# Task 2: Configure Vitest

## Overview

This task creates `vitest.config.ts` in the project root, wires Vitest's global test functions into TypeScript's type system via `tsconfig.json`, and verifies the full setup end-to-end with a smoke test. No source modules are written here; the output is a correctly configured test harness that all subsequent unit-test tasks (Tasks 5, 6, 7, 8, and 9) will depend on.

The configuration targets server-side module testing under a `node` environment, scopes coverage to `app/lib/**/*.ts`, and uses the v8 provider (already installed as `@vitest/coverage-v8@4.1.0`).

---

## Requirements Analysis

### Functional Requirements

- Create `vitest.config.ts` at the project root with the following settings:
  - `globals: true` — makes `describe`, `it`, `expect`, `beforeEach`, etc. available without explicit imports in every test file.
  - `environment: 'node'` — runs tests in a Node.js context, appropriate for server-side modules (`app/lib/ai/`, `app/lib/parser/`).
  - `include: ['app/**/*.test.ts']` — discovers all unit test files under `app/`.
  - `exclude: ['e2e/**/*']` — prevents Vitest from accidentally picking up Playwright spec files.
  - `coverage.provider: 'v8'` — uses the installed `@vitest/coverage-v8` package.
  - `coverage.reporter: ['text', 'json', 'html']` — generates terminal summary, machine-readable JSON, and browsable HTML reports.
  - `coverage.include: ['app/lib/**/*.ts']` — instruments all library source files, including uncovered ones.
  - `coverage.exclude: ['**/*.test.ts', '**/*.d.ts']` — excludes test files and ambient type declarations from coverage numbers.
- Add `"vitest/globals"` to the `types` array in `tsconfig.json`'s `compilerOptions` — this registers the global test function types so TypeScript does not report `describe`, `it`, `expect`, etc. as undeclared identifiers.
- Verify the configuration by running `pnpm test` against a temporary smoke test file.

### Non-Functional Requirements

- **Type strictness**: `vitest.config.ts` must comply with the project's strict TypeScript settings — no `any`, no `as` casts, `satisfies` operator where needed.
- **No duplication**: The Vitest config must be a standalone `vitest.config.ts` (not merged into `vite.config.ts`) to keep concerns separate and to allow independent overrides per-environment.
- **ESM compatibility**: The project uses `"type": "module"` in `package.json`. `vitest.config.ts` must use ESM `import`/`export` syntax.
- **Lint and format clean**: The new file must pass `pnpm exec eslint .` and `pnpm exec prettier --write .` without errors.
- **Performance**: Only `app/lib/**/*.ts` files are instrumented for coverage — this avoids the overhead of instrumenting React route components and UI files that belong to E2E coverage, not unit coverage.

### Dependencies & Constraints

- **Internal**:
  - Task 1 (Install Development Dependencies) must be complete — `vitest@4.1.0` and `@vitest/coverage-v8@4.1.0` must be installed.
  - Tasks 5–9 (parser, schema, AI client, action, rendering) all depend on this task.
- **External**:
  - `vitest@4.1.0` (installed) requires `vite >= 6.0.0`. The project uses `vite@7.3.1` — confirmed compatible.
  - `@vitest/coverage-v8@4.1.0` must match the installed `vitest` minor version. Both are `4.1.0` — confirmed.
- **Technical**:
  - Vitest 4.0 removed `coverage.all`. Coverage of uncovered files must be controlled via `coverage.include` exclusively.
  - Vitest 4.0 removed `poolOptions` as a top-level config key. Do not reference it.
  - Vitest 4.0 no longer injects `@types/node` automatically. The project already declares `"types": ["node"]` in `tsconfig.json` — no action needed.
  - The `vitest/config` import (not `vite`) must be used in `vitest.config.ts` to get Vitest-specific type augmentations on the `defineConfig` return value.
  - `tsconfig.json` already uses `"verbatimModuleSyntax": true` — any type-only imports in `vitest.config.ts` must use `import type`.

---

## Implementation Plan

### Phase 1: Create vitest.config.ts

**Objective**: Write a standalone Vitest configuration file with all required settings.

#### Subtask 1.1: Create `vitest.config.ts` in the project root

- **Files to create**: `/vitest.config.ts`
- **Code**:

  ```typescript
  import { defineConfig } from "vitest/config";
  import tsconfigPaths from "vite-tsconfig-paths";

  export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
      globals: true,
      environment: "node",
      include: ["app/**/*.test.ts"],
      exclude: ["e2e/**/*"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["app/lib/**/*.ts"],
        exclude: ["**/*.test.ts", "**/*.d.ts"],
      },
    },
  });
  ```

- **Key considerations**:
  - Import `defineConfig` from `'vitest/config'`, not from `'vite'`. The `'vitest/config'` entrypoint re-exports Vite's `defineConfig` with Vitest's `test` option types merged in. Using `'vite'` directly causes TypeScript to error on the `test` key.
  - Include `tsconfigPaths()` plugin so that the `~/` path alias defined in `tsconfig.json` resolves correctly in test files. Without this, any test file that imports `~/lib/...` will fail with a module-not-found error.
  - Do **not** merge this config into `vite.config.ts` via `mergeConfig`. Keeping them separate means Vitest runs with its own isolated config and does not accidentally inherit React Router's SSR build transforms.
  - `environment: 'node'` is the correct choice for all Milestone 1 modules (`parseAnnotationString`, `openaiClient`, Zod schemas). These modules are server-only and have no DOM dependency. If a future task tests a React component directly (not via Playwright), it would use `environment: 'happy-dom'` in a per-file override (`@vitest-environment happy-dom` docblock) rather than changing the global default.
  - `include: ['app/**/*.test.ts']` — note the single quotes inside the array. The pattern uses forward slashes and is relative to the config file's location (the project root). Vitest resolves these as glob patterns via `tinyglobby`.
  - `exclude: ['e2e/**/*']` — Playwright spec files will live in `e2e/`. This exclusion prevents Vitest from discovering them.
  - `coverage.include: ['app/lib/**/*.ts']` is essential in Vitest 4.x. Without it, coverage only reports on files that were actually imported during the test run. Setting `include` explicitly forces Vitest to instrument all matching files even if no test imported them, giving accurate "zero coverage" numbers for untested code.
  - `coverage.exclude` defaults already cover many patterns, but explicitly listing `**/*.test.ts` and `**/*.d.ts` makes intent clear and guards against any default-change regressions in future Vitest minor versions.
- **Acceptance criteria**: The file exists at `/Users/danbilee/Projects/furigana/vitest.config.ts`. Running `pnpm exec tsc --noEmit` produces no new TypeScript errors. Running `pnpm exec eslint vitest.config.ts` produces no lint errors.

---

### Phase 2: Update tsconfig.json

**Objective**: Register Vitest's global type declarations so TypeScript recognises `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi`, etc. in test files without explicit imports.

#### Subtask 2.1: Add `"vitest/globals"` to `tsconfig.json` types

- **Files to modify**: `tsconfig.json`
- **Change**: In `compilerOptions.types`, add `"vitest/globals"` alongside the existing `"node"` and `"vite/client"` entries.

  Before:

  ```json
  "types": ["node", "vite/client"]
  ```

  After:

  ```json
  "types": ["node", "vite/client", "vitest/globals"]
  ```

- **Key considerations**:
  - The `"vitest/globals"` type package is bundled with `vitest` itself — no separate `@types/vitest` installation is needed.
  - This entry is needed only when `globals: true` is set in the Vitest config. With `globals: true`, Vitest injects the test functions into the global scope at runtime, but TypeScript still needs the type declarations to know those globals exist.
  - Adding to `types` (an explicit allowlist) rather than relying on automatic `typeRoots` scanning is consistent with the project's existing pattern and avoids accidental type pollution.
  - The existing entries `"node"` and `"vite/client"` must be preserved exactly.
  - `verbatimModuleSyntax: true` in `tsconfig.json` is unaffected — `"types"` entries are compiler directives, not imports.
- **Acceptance criteria**: After the change, running `pnpm type-check` produces no errors. Opening a `.test.ts` file in an editor should not show "Cannot find name 'describe'" or similar errors.

---

### Phase 3: Smoke Test Verification

**Objective**: Confirm that Vitest starts, discovers test files, and executes them without errors.

#### Subtask 3.1: Create a temporary smoke test file

- **Files to create**: `app/lib/__test__.ts` (temporary — deleted after verification)
- **Content**:

  ```typescript
  it("works", () => {
    expect(true).toBe(true);
  });
  ```

- **Key considerations**:
  - The file is named `__test__.ts`, which matches the `include` pattern `app/**/*.test.ts` — wait, `__test__.ts` does **not** match `*.test.ts`. The correct name to match the configured pattern is `app/lib/smoke.test.ts` (any name ending in `.test.ts`).
  - Use a name that is clearly temporary, e.g., `app/lib/smoke.test.ts`.
  - The test body uses bare `it` and `expect` — no import statement — because `globals: true` is configured. If they are not resolved, that itself is a diagnostic signal.
  - After a successful run, delete this file. Do not commit it.
- **Acceptance criteria**: `pnpm test` exits with code `0`, prints `1 passed`, and the word `smoke` appears in the output. No "Cannot find name 'it'" TypeScript errors appear.

#### Subtask 3.2: Run coverage to verify the v8 provider

- **Files to create/modify**: None
- **Command**: `pnpm test:coverage`
- **Key considerations**:
  - Running coverage requires the `@vitest/coverage-v8` package to be resolvable. If the package is missing or version-mismatched, Vitest throws `Error: Unknown coverage provider 'v8'` or `Cannot find package '@vitest/coverage-v8'`.
  - The coverage output directory defaults to `./coverage/`. This directory should be added to `.gitignore` if not already present.
  - With only the smoke test file in place and `coverage.include: ['app/lib/**/*.ts']`, coverage will show 0% for any files that exist in `app/lib/` beyond the smoke file. This is expected and confirms the `include` glob is working.
- **Acceptance criteria**: `pnpm test:coverage` exits with code `0`. A `coverage/` directory is created containing `lcov-report/index.html` (HTML reporter output) and `coverage-final.json` (JSON reporter output). No `Error: Unknown coverage provider` is thrown.

#### Subtask 3.3: Delete the smoke test file

- **Command**:
  ```bash
  rm app/lib/smoke.test.ts
  ```
- **Acceptance criteria**: The file no longer exists. `pnpm test` exits with a "no test files found" message or zero-test run, not an error. (In watch mode, Vitest will wait for files — run with `pnpm exec vitest run` to get a single-pass exit code.)

---

### Phase 4: Lint and Type-Check Verification

**Objective**: Confirm the new `vitest.config.ts` and modified `tsconfig.json` do not introduce any lint or type errors.

#### Subtask 4.1: Type-check the full project

- **Command**: `pnpm type-check`
- **Key considerations**:
  - `pnpm type-check` runs `react-router typegen && tsc --noEmit`. The `tsc` step validates `vitest.config.ts` because it is included by `"include": ["**/*"]` in `tsconfig.json`.
  - The `tsconfigPaths` import in `vitest.config.ts` must resolve correctly — it is a `devDependency` already installed.
  - If `"vitest/globals"` is not found, TypeScript will throw `error TS2688: Cannot find type definition file for 'vitest/globals'`. Confirm `vitest` is installed before running.
- **Acceptance criteria**: Zero TypeScript errors.

#### Subtask 4.2: Lint the new file

- **Command**: `pnpm exec eslint vitest.config.ts`
- **Key considerations**:
  - `eslint.config.mjs` applies the TypeScript parser to all `*.{ts,tsx,mts,cts}` files, so `vitest.config.ts` is linted with full TypeScript rules.
  - The `parserOptions.projectService` with `allowDefaultProject` is configured for specific paths (`packages/interface/tsup.config.ts`, `apps/api/test/*.ts`). The root-level `vitest.config.ts` is covered by the default project service resolution (it will use the root `tsconfig.json`). No change to ESLint config is needed.
  - The `@typescript-eslint/consistent-type-imports` rule requires `import type` for type-only imports. In `vitest.config.ts` all imports are value imports (`defineConfig` is a function, `tsconfigPaths` is a function) — no `import type` needed.
- **Acceptance criteria**: Zero ESLint errors or warnings.

---

## Third-Party Integration Research

### vitest v4.1.0 (latest: v4.1.0, matches installed)

- **Official docs**: [https://vitest.dev/config/](https://vitest.dev/config/) — full configuration reference. Coverage guide: [https://vitest.dev/guide/coverage](https://vitest.dev/guide/coverage).
- **Recent changes (v4.0 breaking, relevant to this task)**:
  - `coverage.all` option **removed**. Replaced by explicit `coverage.include`. Action required: use `coverage.include: ['app/lib/**/*.ts']`.
  - `coverage.extensions` removed. Action required: do not add this option.
  - `coverage.ignoreEmptyLines` removed. Empty lines are now excluded automatically.
  - `coverage.experimentalAstAwareRemapping` removed; AST-based remapping is now the default and cannot be disabled.
  - Pool configuration (`maxThreads`, `singleThread`, `poolOptions`) overhauled. Not relevant to this task (no custom pool config needed).
  - `@types/node` is no longer auto-injected. The project already declares `"node"` in `tsconfig.json` types — no action needed.
  - `vite-node` replaced with Vite's native Module Runner. The `tsconfigPaths()` plugin must be included in the Vitest config plugins array for path aliases to resolve.
- **Recent changes (v4.1, additive)**:
  - `coverage.changed`: new option to limit coverage to modified files only. Not used here.
  - `detectAsyncLeaks`: new option for tracking leaked timers. Not used here.
  - Vite 8 beta compatibility added. Irrelevant — project uses Vite 7.
  - `aroundEach` / `aroundAll` hooks added. Not used in this task.
  - One undocumented breaking change: `beforeAll`/`afterAll`/`aroundAll` hooks now receive fixture context instead of a `Suite` object. Not relevant — no `beforeAll`/`afterAll` hooks are written in this task.
- **Open issues / known bugs**: No issues blocking the `node` environment + v8 coverage + globals configuration used here.
- **Security advisories**: None found.
- **Performance notes**: The `node` environment is the lightest Vitest environment — no DOM emulation overhead. V8 coverage adds approximately 10–20% overhead compared to running without coverage; acceptable for a library test suite.
- **Case studies**: V8 coverage accuracy was promoted to match Istanbul's level in v3.2.0 and is the recommended default for Node.js projects. The `app/lib/**/*.ts` scope ensures only logic-bearing modules are instrumented.

> ⚠️ **Needs Review**: `coverage.include` is the replacement for the removed `coverage.all` option in Vitest 4.x. If `coverage.include` is omitted, Vitest will only report coverage for files that were actually `import`ed during test execution. Files with zero test coverage will be silently absent from the report, producing a falsely optimistic coverage percentage. The configuration in this task must include `coverage.include: ['app/lib/**/*.ts']` explicitly.

### vite-tsconfig-paths v5.x (installed: matches `^5.0.0`)

- **Official docs**: [https://github.com/aleclarson/vite-tsconfig-paths](https://github.com/aleclarson/vite-tsconfig-paths)
- **Usage in this task**: The plugin must be added to `vitest.config.ts`'s `plugins` array so that the `~/` → `app/` path alias resolves in test files. Without it, any test that uses `import { ... } from '~/lib/...'` will throw a module-not-found error at runtime.
- **Recent changes**: No breaking changes in the v5 series relevant to Vitest 4 usage.
- **Open issues / known bugs**: None affecting this usage.
- **Security advisories**: None found.

---

## Code Patterns

### Pattern 1: Standalone Vitest Config (separate from vite.config.ts)

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["app/**/*.test.ts"],
    exclude: ["e2e/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
    },
  },
});
```

**Where to apply**: `vitest.config.ts` at the project root.

**Why this pattern**: Importing `defineConfig` from `'vitest/config'` (not `'vite'`) gives the `test` option proper TypeScript types without requiring additional type assertions. Keeping the file standalone avoids polluting the production Vite build with test-only configuration.

### Pattern 2: tsconfig.json types array extension

```json
{
  "compilerOptions": {
    "types": ["node", "vite/client", "vitest/globals"]
  }
}
```

**Where to apply**: `tsconfig.json` `compilerOptions.types`.

**Why this pattern**: When `globals: true` is set in Vitest's config, the test functions (`it`, `describe`, `expect`, `vi`, etc.) are injected into the global scope at runtime but TypeScript does not know about them unless `vitest/globals` is declared as a types entry. This is preferable to importing from `vitest` in every test file, which would be inconsistent with the `globals: true` setting.

### Pattern 3: Per-file environment override (for future React component tests)

```typescript
// @vitest-environment happy-dom
import { render } from "@testing-library/react";
```

**Where to apply**: At the top of any future test file that tests a React component and needs DOM APIs. Do not use this in Milestone 1 — all M1 tests are server-side logic.

**Why this pattern**: The global `environment: 'node'` default is optimal for server-side modules. Component tests that need DOM APIs override the environment per-file rather than changing the global default, which would slow down all tests with DOM initialisation overhead.

---

## Test Cases

### Unit Tests

#### Test Suite: Vitest Configuration Bootstrap

**Test 1**: Globals are available without explicit imports

- **Given**: `vitest.config.ts` exists with `globals: true` and `"vitest/globals"` is in `tsconfig.json` types
- **When**: A test file at `app/lib/smoke.test.ts` uses `it`, `expect` with no import statement
- **Then**: `pnpm exec vitest run` exits with code `0` and reports `1 passed`
- **Coverage**: Detects a misconfigured `globals` option or missing `"vitest/globals"` type entry

**Test 2**: `~/` path alias resolves in test files

- **Given**: `vitest.config.ts` includes `tsconfigPaths()` in plugins
- **When**: A test file contains `import { cn } from '~/lib/utils'` and calls `cn('foo')`
- **Then**: The import resolves without a module-not-found error and the function executes correctly
- **Coverage**: Detects a missing `tsconfigPaths()` plugin, which would break all test files that use the `~/` alias

**Test 3**: `environment: 'node'` is active

- **Given**: `vitest.config.ts` sets `environment: 'node'`
- **When**: A test file references `process.env.NODE_ENV`
- **Then**: The value is defined (e.g., `'test'`) without a "process is not defined" ReferenceError
- **Coverage**: Confirms Node.js globals are available, which is required for server-side module tests in Milestone 1

**Test 4**: v8 coverage provider is functional

- **Given**: `vitest.config.ts` sets `coverage.provider: 'v8'` and `@vitest/coverage-v8@4.1.0` is installed
- **When**: `pnpm test:coverage` is run
- **Then**: A `coverage/` directory is created containing `coverage-final.json` and `lcov-report/index.html`; no `Error: Unknown coverage provider 'v8'` appears
- **Coverage**: Detects a missing or version-mismatched `@vitest/coverage-v8` package

**Test 5**: `coverage.include` instruments un-imported files

- **Given**: `coverage.include: ['app/lib/**/*.ts']` and at least one `.ts` file exists in `app/lib/` that is not imported by any test
- **When**: `pnpm test:coverage` is run
- **Then**: The coverage report lists the un-imported file with `0%` statement coverage (not absent from the report)
- **Coverage**: Detects the accidental omission of `coverage.include`, which would produce a falsely complete coverage report

**Test 6**: Playwright E2E files are excluded

- **Given**: `exclude: ['e2e/**/*']` is configured and a file `e2e/home.spec.ts` exists (created in Task 3)
- **When**: `pnpm exec vitest run` is executed
- **Then**: Vitest does not attempt to execute `e2e/home.spec.ts`; no Playwright-specific import errors appear in Vitest output
- **Coverage**: Detects a misconfigured `exclude` pattern that would cause Vitest to pick up Playwright specs

### Integration Tests

Not applicable for a configuration-only task. The smoke test in Phase 3 serves as the integration verification.

### E2E Tests

Not applicable for this task.

---

## Implementation Checklist

- [ ] Create `vitest.config.ts` in the project root with all required settings
- [ ] Verify `defineConfig` is imported from `'vitest/config'` (not `'vite'`)
- [ ] Verify `tsconfigPaths()` is included in the `plugins` array
- [ ] Add `"vitest/globals"` to `tsconfig.json` `compilerOptions.types`
- [ ] Create temporary smoke test at `app/lib/smoke.test.ts`
- [ ] Run `pnpm exec vitest run` — verify `1 passed`, exit code `0`
- [ ] Run `pnpm test:coverage` — verify `coverage/` directory created, no provider errors
- [ ] Delete `app/lib/smoke.test.ts`
- [ ] Run `pnpm type-check` — zero TypeScript errors
- [ ] Run `pnpm exec eslint vitest.config.ts` — zero ESLint errors
- [ ] Verify `coverage/` is listed in `.gitignore` (add it if not present)
- [ ] Commit `vitest.config.ts`, `tsconfig.json`, and `.gitignore` changes

---

## Notes & Considerations

**Why `vitest.config.ts` and not a `test` block inside `vite.config.ts`**

Vitest supports embedding test config inside `vite.config.ts` using a `test` key. This is explicitly avoided here because:

1. React Router's `vite.config.ts` uses `reactRouter()`, which adds SSR build transforms. These transforms must not apply during test runs.
2. Keeping configs separate makes it trivially obvious what is build config vs. test config during code review.
3. When Vitest detects a standalone `vitest.config.ts`, it automatically ignores `vite.config.ts` unless `mergeConfig` is used explicitly. No interference.

**`include` glob path notes**

Vitest resolves `include` patterns relative to the config file location (the project root). The pattern `'app/**/*.test.ts'` matches files like `app/lib/parser.test.ts` but not `app/lib/parser.spec.ts`. All test files in this project must use the `.test.ts` suffix to be discovered.

**`coverage/` directory**

The `pnpm test:coverage` command writes reports to `./coverage/` by default (`coverage.reportsDirectory` defaults to `'coverage'`). This directory must be added to `.gitignore`. Check whether `.gitignore` already contains a `coverage/` line; if not, add it.

**TypeScript strict mode and `vitest.config.ts`**

The project's `tsconfig.json` enables `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. The `defineConfig` types shipped with `vitest/config` are written to be compatible with these strict settings — no `satisfies` workarounds are needed for the options listed in this plan.

**`verbatimModuleSyntax` compatibility**

`tsconfig.json` sets `"verbatimModuleSyntax": true`, which requires that `import type` be used for type-only imports. In `vitest.config.ts`, both `defineConfig` (function) and `tsconfigPaths` (function) are value imports — no `import type` is required. If a future iteration adds a type import (e.g., `import type { UserConfig } from 'vitest/config'`), the `import type` syntax is mandatory.

**Downstream contract for Tasks 5–9**

Every unit test file created in Tasks 5 through 9 must:

- Be placed under `app/` with a `.test.ts` extension.
- Not import `it`, `describe`, or `expect` from `vitest` — globals are available without imports.
- Use `import type` for any type-only imports (ESLint `consistent-type-imports` rule enforces this).
- Not use `@vitest-environment` docblock overrides unless the module under test requires DOM APIs (none in Milestone 1 do).
