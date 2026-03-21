# Task 3: Configure Playwright

## Overview

Create the Playwright E2E test configuration file (`playwright.config.ts`) at the project root and initialize the `e2e/` test directory. The configuration targets Chromium only for MVP, auto-starts the Vite dev server before tests run, and applies CI-specific overrides (single worker, 2 retries, forbid `.only`). Package scripts `test:e2e` and `test:e2e:ui` are already defined in `package.json` — no script changes are required.

---

## Requirements Analysis

### Functional Requirements

- `playwright.config.ts` exists at the project root and is recognized by the `playwright test` CLI
- `testDir` points to `./e2e`
- `fullyParallel: true` enables file-level parallelism by default
- `forbidOnly` is `true` in CI to prevent accidentally committed `test.only` calls blocking the pipeline
- `retries` is `2` on CI, `0` locally
- `workers` is `1` on CI, `undefined` (Playwright default: half CPU cores) locally
- `reporter` is `'html'` for both environments
- `baseURL` is `http://localhost:5173` matching the Vite dev server
- `trace: 'on-first-retry'` collects traces only when a test first fails and retries
- A single `projects` entry configures Chromium (Chrome for Testing in Playwright 1.57+)
- `webServer` block auto-starts `pnpm dev` and waits for the dev server; `reuseExistingServer` skips the start if a server is already running locally
- `e2e/` directory exists and is tracked in git via a `.gitkeep` placeholder
- Playwright HTML report artifacts and traces are excluded from git

### Non-Functional Requirements

- `playwright.config.ts` must pass `tsc --noEmit` under the project's strict TypeScript settings (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- No `any` types or `as` casts in the config file
- Config must be linted by ESLint without warnings (the file will be picked up by `**/*.{ts,tsx,mts,cts}` glob in `eslint.config.mjs`)
- Browser download step (`playwright install --with-deps chromium`) must be run once after initial dependency install — document this in the CI setup notes

### Dependencies & Constraints

- **Task 1 (done)**: `@playwright/test: ^1.58.2` is already installed
- `package.json` already defines `"test:e2e": "playwright test"` and `"test:e2e:ui": "playwright test --ui"` — no changes needed
- The project uses `"type": "module"` in `package.json`, so `playwright.config.ts` must use ESM `import` syntax, not `require()`
- `tsconfig.json` uses `verbatimModuleSyntax: true` — all type-only imports must use `import type {}`
- `moduleResolution: "Bundler"` is set in `tsconfig.json`; Playwright's own type declarations are compatible with this setting via `@playwright/test`
- The dev server starts on port `5173` (standard Vite default, confirmed in `vite.config.ts`)
- The project has no pre-existing `playwright.config.ts` or `e2e/` directory

---

## Implementation Plan

### Phase 1: Create the Playwright Configuration File

**Objective**: Write a fully typed, lint-clean `playwright.config.ts` at the project root that covers all required options.

#### Subtask 1.1: Write `playwright.config.ts`

- **Files to create**: `/playwright.config.ts`
- **Code pattern**: Use `defineConfig` from `@playwright/test` — this is the canonical typed entry point. Import `devices` from the same package for the Chromium project preset. Use `satisfies` where applicable if additional narrowing is needed (it is not required here since `defineConfig` already infers all types).
- **Key considerations**:
  - Read `process.env['CI']` using bracket notation to satisfy `noPropertyAccessFromIndexSignature`
  - The `workers` field accepts `number | string | undefined`; setting `undefined` for local env leaves Playwright to choose its default (half the available CPU cores)
  - `reuseExistingServer: !process.env['CI']` evaluates to `true` locally (falsy env var becomes `false`, negated to `true`) and `false` in CI — this is the correct semantic
  - Playwright 1.57+ uses Chrome for Testing builds: `devices['Desktop Chrome']` maps to this automatically; no manual `channel` override is needed
  - `reporter: 'html'` generates an interactive HTML report in `playwright-report/`; this directory must be added to `.gitignore`
  - `trace: 'on-first-retry'` is only meaningful when `retries` is non-zero; on local (retries: 0) traces are never collected, which is correct
  - Do not set `outputDir` explicitly — the default (`test-results/`) is fine and should also be added to `.gitignore`
- **Acceptance criteria**:
  - `pnpm exec tsc --noEmit` passes with no new errors
  - `pnpm exec eslint playwright.config.ts` reports zero errors or warnings
  - Running `pnpm test:e2e --list` (no tests yet) exits without error, confirming the config is syntactically valid and the `e2e/` directory is found

#### Subtask 1.2: Update `.gitignore` for Playwright artifacts

- **Files to modify**: `/.gitignore`
- **Key considerations**: Playwright generates two artifact directories that must not be committed:
  - `playwright-report/` — HTML report output
  - `test-results/` — screenshots, traces, and video artifacts from failed tests
  - The `e2e/` directory itself must be tracked (it contains `.gitkeep` and future test files); only the artifact directories above should be ignored
- **Acceptance criteria**: After adding entries, `git status` shows no untracked `playwright-report/` or `test-results/` directories after a test run

---

### Phase 2: Initialize the E2E Test Directory

**Objective**: Create the `e2e/` directory with a `.gitkeep` placeholder so the empty directory is tracked in git and the config's `testDir` resolves without error.

#### Subtask 2.1: Create `e2e/.gitkeep`

- **Files to create**: `/e2e/.gitkeep`
- **Key considerations**:
  - An empty `.gitkeep` file is the conventional way to track an otherwise-empty directory in git
  - Do not place any test files here yet; they are created in later tasks (Task 15: `e2e/home.spec.ts`)
  - The file has no content and no extension-specific tooling implications
- **Acceptance criteria**: `git status` shows `e2e/.gitkeep` as a new tracked file; `e2e/` directory is present on the filesystem

---

### Phase 3: Verification with a Smoke Test

**Objective**: Confirm the full Playwright pipeline (config load → server start → browser launch → test run) works end to end. The smoke test file is temporary and must be deleted after verification.

#### Subtask 3.1: Create and run a temporary smoke test

- **Files to create (temporary)**: `/e2e/smoke.spec.ts`
- **Key considerations**:
  - The smoke test only needs to navigate to `/` and assert the page title or a visible element exists — it is not a real feature test
  - Use `test` and `expect` imported from `@playwright/test`
  - Run with `pnpm test:e2e:ui` first to see the browser open interactively, then `pnpm test:e2e` for headless confirmation
  - If `webServer` is already running (e.g., you ran `pnpm dev` separately), `reuseExistingServer: true` (local env) will skip starting a new one — this is expected behavior
  - **Delete `e2e/smoke.spec.ts` after successful verification** — it must not be committed
- **Acceptance criteria**:
  - `pnpm test:e2e` runs, the dev server starts (or is reused), Chromium launches, the test passes, and the HTML report is generated in `playwright-report/`
  - `pnpm test:e2e:ui` opens the Playwright UI and shows the smoke test in the test tree

---

## Third-Party Integration Research

### `@playwright/test` v1.58.2 (installed: ^1.58.2, latest: 1.58.x)

- **Official docs**: https://playwright.dev/docs/test-configuration — covers all `defineConfig` options
- **Recent changes (v1.57)**:
  - Playwright now runs on **Chrome for Testing** builds instead of open-source Chromium builds. Headed mode uses `chrome`; headless mode uses `chrome-headless-shell`. This is transparent when using `devices['Desktop Chrome']` — no config change required.
  - `webServer.wait` field added: accepts a regex string to match against server stdout before proceeding. Not required for this task (URL polling is sufficient).
- **Recent changes (v1.58)**:
  - Removed `_react` and `_vue` selectors (not relevant to this task)
  - Removed `devtools` option from `browserType.launch()` — use `args: ['--auto-open-devtools-for-tabs']` instead. Not relevant since we are not launching browsers directly.
  - Dropped macOS 13 support for WebKit — not relevant (Chromium-only MVP)
- **Open issues / known bugs**: None found that affect basic config setup or Chromium-only usage
- **Security advisories**: None found
- **Performance notes**: Setting `workers: 1` in CI is the Playwright team's explicit recommendation for stability. `fullyParallel: true` combined with `workers: undefined` locally allows each test file to run in its own worker process, which is fine for a small E2E suite.
- **Case studies**: The standard `defineConfig` + `devices['Desktop Chrome']` + `webServer` pattern is the canonical Playwright setup used across the community. No deviations needed.

> No `Needs Review` items. The installed version (1.58.2) is the latest stable release, and all configuration options used in this task are stable and documented.

---

## Code Patterns

### Pattern 1: `playwright.config.ts` with CI-aware settings

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env["CI"],
  },
});
```

**Where to apply**: `playwright.config.ts` at the project root

**Why this pattern**:

- `defineConfig` provides full TypeScript inference for all options — no `satisfies` or manual type annotations needed
- `process.env['CI']` uses bracket notation to satisfy `noPropertyAccessFromIndexSignature`
- `!!process.env['CI']` coerces the string `"true"` (or any truthy value) to a boolean for `forbidOnly`, which expects `boolean`
- `devices['Desktop Chrome']` is spread into `use` so that any additional per-project `use` options can be merged cleanly
- `reuseExistingServer: !process.env['CI']` follows the official Playwright recommendation: always start fresh in CI, reuse existing server locally

### Pattern 2: Temporary smoke test

```typescript
import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});
```

**Where to apply**: `e2e/smoke.spec.ts` (temporary, delete after verification)

**Why this pattern**: The title assertion `/.+/` matches any non-empty title, making it a true smoke test that only checks the page responds — not specific content that will change in future tasks.

---

## Test Cases

### E2E Tests

**Test 1 (smoke — temporary)**: Home page loads over Chromium

- **Given**: The dev server is not running; `CI` environment variable is unset (local run)
- **When**: `pnpm test:e2e` is executed
- **Then**: `webServer` starts `pnpm dev`, the browser navigates to `http://localhost:5173/`, the page title is non-empty, and the test passes with exit code 0
- **Coverage**: Validates the full config → server bootstrap → browser launch → navigation pipeline

**Test 2 (smoke — temporary)**: Playwright UI opens correctly

- **Given**: `pnpm dev` is already running on port 5173
- **When**: `pnpm test:e2e:ui` is executed
- **Then**: The Playwright UI window opens, the smoke test appears in the test tree, and clicking "Run" executes it successfully (server is reused, not restarted)
- **Coverage**: Validates `reuseExistingServer: true` and `--ui` mode compatibility

**Test 3 (config validation)**: `forbidOnly` blocks committed `.only` calls in CI

- **Given**: `e2e/smoke.spec.ts` contains `test.only(...)` and `CI=true` is set
- **When**: `playwright test` is invoked
- **Then**: The process exits with a non-zero code and an error message referencing `forbidOnly`
- **Coverage**: Confirms the `forbidOnly` setting is active and correctly read from the environment

**Test 4 (config validation)**: TypeScript compilation passes

- **Given**: `playwright.config.ts` is written as specified
- **When**: `pnpm type-check` is executed
- **Then**: `tsc --noEmit` exits with code 0 and no diagnostic errors
- **Coverage**: Detects any type-strict violation in the config (e.g., wrong type for `workers`, missing bracket notation for `process.env`)

**Test 5 (config validation)**: ESLint passes on the config file

- **Given**: `playwright.config.ts` is written as specified
- **When**: `pnpm exec eslint playwright.config.ts` is executed
- **Then**: Zero errors or warnings are reported
- **Coverage**: Detects any `consistent-type-imports` violation or other ESLint rule violations introduced by the config file

---

## Implementation Checklist

- [ ] Write `playwright.config.ts` at project root
- [ ] Verify `pnpm exec tsc --noEmit` passes with no new errors
- [ ] Verify `pnpm exec eslint playwright.config.ts` reports zero issues
- [ ] Add `playwright-report/` and `test-results/` to `.gitignore`
- [ ] Create `e2e/.gitkeep` (empty file)
- [ ] Create temporary `e2e/smoke.spec.ts` for verification
- [ ] Run `pnpm test:e2e:ui` and confirm Playwright UI opens and the smoke test appears
- [ ] Run `pnpm test:e2e` headlessly and confirm the test passes
- [ ] Delete `e2e/smoke.spec.ts`
- [ ] Confirm `git status` shows `playwright-report/` and `test-results/` are ignored
- [ ] Confirm `git status` shows `e2e/.gitkeep` as tracked

---

## Notes & Considerations

### Browser download step

`@playwright/test` does not automatically download browsers on `pnpm install`. The Chromium (Chrome for Testing) binary must be downloaded separately by running:

```bash
pnpm exec playwright install --with-deps chromium
```

This must be run once after cloning or after upgrading `@playwright/test`. In CI pipelines, add this step between `pnpm install` and `pnpm test:e2e`. The `--with-deps` flag also installs OS-level system dependencies required by the browser — important on Linux CI agents.

### `tsconfig.json` scope and `playwright.config.ts`

The current `tsconfig.json` uses `"include": ["**/*", ...]`, so `playwright.config.ts` at the root is already included in the TypeScript compilation. No separate `tsconfig` for the `e2e/` directory is needed for the MVP phase. If the E2E suite grows to need different settings (e.g., relaxed strictness for test utilities), a dedicated `e2e/tsconfig.json` extending the root can be added later.

### ESLint scope and `e2e/` test files

The ESLint flat config in `eslint.config.mjs` targets `**/*.{ts,tsx,mts,cts}`, which includes `e2e/**/*.ts`. Future E2E test files will be linted by the same TypeScript ESLint rules as the app code. This is intentional — test files should maintain the same type-strict standards.

### `webServer` and HMR startup time

Vite's dev server (`pnpm dev`) starts within 1–3 seconds on modern hardware. Playwright's `webServer` polls the `url` until it responds before launching the browser. No `timeout` override is needed for the `webServer` block — the default (60 seconds) is more than sufficient for this Vite setup.

### Port conflicts in CI

If port 5173 is occupied by another process in CI, `pnpm dev` will fail to start and Playwright will time out waiting for the URL. To guard against this, ensure CI pipelines clean up processes between jobs. The `reuseExistingServer: false` setting in CI already prevents silent reuse of a zombie process.

### Chromium-only rationale for MVP

Firefox and WebKit add ~500 MB of additional browser downloads and meaningfully increase CI time. For the MVP furigana generation loop, cross-browser coverage provides minimal risk signal — the app uses standard HTML (`<ruby>`, `<rt>`) with no browser-specific APIs. Adding Firefox/WebKit projects is deferred to a post-MVP milestone.
