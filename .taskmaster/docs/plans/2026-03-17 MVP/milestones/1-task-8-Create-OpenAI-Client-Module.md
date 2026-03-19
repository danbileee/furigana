# Task 8: Create OpenAI Client Module

**Project**: Furigana
**Generated**: 2026-03-19
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

## Overview

Create `app/lib/ai/client.ts` — a server-only module that exports a single pre-configured `OpenAI` client instance. The module validates `OPENAI_API_KEY` at import time so that a missing key fails loudly at startup rather than silently at first request. This module is the sole entry point for all AI calls in M1 and is reused without modification by M4 (title generation).

## Requirements Analysis

### Functional Requirements

- Export a single named constant `openaiClient` of type `OpenAI` from `app/lib/ai/client.ts`.
- Read the API key from `process.env['OPENAI_API_KEY']` (bracket notation required by `noPropertyAccessFromIndexSignature`).
- Throw a descriptive `Error` at module evaluation time if the key is absent or an empty string.
- The OpenAI constructor itself also throws an `OpenAIError` when `apiKey` is `undefined` (confirmed by SDK documentation), but we add an explicit guard earlier to produce a clearer, project-specific message before the SDK has a chance to throw a generic one.
- Never expose `OPENAI_API_KEY` to the Vite client bundle — the variable has no `VITE_` prefix and is therefore inert in client code.

### Non-Functional Requirements

- **Server-only boundary**: the file must never be imported from client-side code (`entry.client.tsx`, client portions of route files, or any file in the import graph that runs in the browser).
- **TypeScript strict compliance**: `noPropertyAccessFromIndexSignature` requires `process.env['OPENAI_API_KEY']`, not `process.env.OPENAI_API_KEY`. No `any`, no `as` casts.
- **Fail-fast**: error must be synchronous and thrown during module evaluation, not lazily at first API call.
- **Zero side effects beyond validation**: the module does nothing else — no logging, no network calls.
- **Reusable in M4**: the exported `openaiClient` instance must be general-purpose so M4 can import it for title generation without modification.

### Dependencies & Constraints

- **Task 1** (Install Dependencies) must be complete: `openai@^6.32.0` must be in `node_modules`.
- **Task 4** (Create `.env.example`) is complete: `.env.example` already documents `OPENAI_API_KEY` with the correct comment.
- `app/lib/ai/` directory already exists (contains `sanitize.ts` and `sanitize.test.ts`) — no directory creation needed.
- Vitest test environment is `node` (set in `vitest.config.ts`), so `process.env` is directly available in tests without any special setup.
- The test for the missing-key scenario must delete `process.env['OPENAI_API_KEY']` before the dynamic import; restoring it afterwards is required to avoid test pollution.

## Implementation Plan

### Phase 1: Create the Client Module

**Objective**: Write `app/lib/ai/client.ts` with validation guard and a pre-configured `OpenAI` instance.

#### Subtask 1.1: Write `app/lib/ai/client.ts`

- **Files to create**: `app/lib/ai/client.ts`
- **Code pattern**: See the _Code Patterns_ section — "Fail-Fast Server Module".
- **Key considerations**:
  - Use `process.env['OPENAI_API_KEY']` (bracket notation) to satisfy `noPropertyAccessFromIndexSignature`.
  - The guard checks for falsy value (covers both `undefined` and `""`). An empty-string key would pass the SDK's own check but is still operationally invalid, so guard against it here too.
  - The SDK constructor reads `process.env['OPENAI_API_KEY']` automatically when `apiKey` is not passed, but we pass it explicitly so the validated, narrowed string is used and there is no ambiguity.
  - Do not add `dangerouslyAllowBrowser: true` — this client is server-only and the default `false` is the correct protection.
  - The module is intentionally side-effect free beyond the guard throw; no logging.
- **Acceptance criteria**:
  - `pnpm type-check` passes with no errors on this file.
  - `pnpm exec eslint app/lib/ai/client.ts` reports no errors.
  - Importing the module in a Node.js REPL with `OPENAI_API_KEY` set produces an `OpenAI` instance.
  - Importing it without the variable set throws synchronously with a message containing `"OPENAI_API_KEY"`.

### Phase 2: Write Unit Tests

**Objective**: Verify the module throws when the key is missing and exports a correctly typed instance when the key is present.

#### Subtask 2.1: Write `app/lib/ai/client.test.ts`

- **Files to create**: `app/lib/ai/client.test.ts`
- **Code pattern**: See the _Code Patterns_ section — "Dynamic Import Test for Module-Level Throw".
- **Key considerations**:
  - The module must be re-evaluated for each scenario because module evaluation is the throw site. Use `vi.resetModules()` before each dynamic `import()` call to bypass Vitest's module cache.
  - Save and restore `process.env['OPENAI_API_KEY']` in `beforeEach`/`afterEach` to avoid test pollution.
  - The "present" test only needs to assert the exported value is an instance of `OpenAI` and that it has the expected type shape (`.chat`, `.models`). Do not make a live network call.
  - The "missing" test covers both `undefined` (key deleted) and `""` (key set to empty string).
  - Tests live in `app/lib/ai/client.test.ts` and are auto-discovered by Vitest via the `include: ["app/**/*.test.ts"]` glob in `vitest.config.ts`.
- **Acceptance criteria**:
  - `pnpm test` runs the new test file with all tests passing.
  - Coverage for `app/lib/ai/client.ts` shows 100% line and branch coverage.

### Phase 3: Verify Server/Client Boundary

**Objective**: Confirm the module cannot accidentally enter the client bundle.

#### Subtask 3.1: Manual boundary audit

- **Files to review**: `app/entry.client.tsx`, `app/routes/*.tsx` (any existing client-side exports).
- **Key considerations**:
  - Search for any static `import` of `~/lib/ai/client` in client-side files. There should be none.
  - Confirm that `app/lib/ai/client.ts` does not import `import.meta.env` — it must use only `process.env`.
  - Run `pnpm build` and verify the build succeeds without bundling errors.
- **Acceptance criteria**:
  - No import of `~/lib/ai/client` exists in `entry.client.tsx` or in any route's client-side export.
  - `pnpm build` succeeds.
  - `pnpm type-check` passes across the whole project.

## Third-Party Integration Research

### openai (npm) v6.32.0 (installed: `^6.32.0`)

- **Official docs**: [openai/openai-node on GitHub](https://github.com/openai/openai-node) — README covers initialization, environment variable handling, and browser safeguards.
- **Recent changes (v6.31.0 → v6.32.0)**:
  - v6.32.0 (2026-03-17): Added 5.4 nano and mini model slugs. No initialization changes.
  - v6.31.0 (2026-03-16): Added `in`/`nin` filter types to `ComparisonFilter`. No initialization changes.
  - No breaking changes in either release.
- **Initialization behavior (confirmed by SDK documentation)**:
  - The `OpenAI` constructor throws an `OpenAIError` with the message `"Missing credentials"` at instantiation time when `apiKey` is `undefined`. This means module-level initialization fails fast by default.
  - The SDK reads `process.env['OPENAI_API_KEY']` automatically when `apiKey` is omitted from the constructor options; passing it explicitly is also valid and makes the key's source explicit.
  - `dangerouslyAllowBrowser` defaults to `false`; the constructor throws an `OpenAIError` if it detects a browser-like environment and this flag is absent. This is the desired behaviour for a server-only module.
- **Open issues / known bugs**: None found relevant to initialization or TypeScript strict mode compatibility.
- **Security advisories**: None found for v6.31.0–v6.32.0.
- **Performance notes**: The `OpenAI` constructor is synchronous and lightweight. Creating one shared singleton at module evaluation is the recommended pattern to avoid per-request constructor overhead.
- **TypeScript notes**: The SDK requires TypeScript >= 4.9. No issues were found with `exactOptionalPropertyTypes` or `noPropertyAccessFromIndexSignature` in the initialization path, because the SDK's own option types use optional properties (`apiKey?: string`) rather than index signatures.
- **Case studies**: The singleton pattern (module-level `const client = new OpenAI(...)`) is the canonical usage shown in the official quickstart and cookbook examples.

## Code Patterns

### Pattern 1: Fail-Fast Server Module

```typescript
// app/lib/ai/client.ts

import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];

if (!apiKey) {
  throw new Error(
    "OPENAI_API_KEY environment variable is not set. " +
      "Add it to your .env file (see .env.example). " +
      "This variable must never have a VITE_ prefix — it is server-only.",
  );
}

export const openaiClient: OpenAI = new OpenAI({ apiKey });
```

**Where to apply**: `app/lib/ai/client.ts` only.

**Why this pattern**:
- The guard runs before the `OpenAI` constructor so the error message is project-specific and actionable, pointing the developer to `.env.example`.
- `process.env["OPENAI_API_KEY"]` (bracket notation) satisfies `noPropertyAccessFromIndexSignature`. Using dot notation (`process.env.OPENAI_API_KEY`) would be a TypeScript compile error under the project's strict config.
- Passing `apiKey` explicitly to `new OpenAI({ apiKey })` makes the runtime source of the key unambiguous, even though the SDK would read the env var automatically if omitted.
- The explicit `: OpenAI` type annotation on the export is a redundant but deliberate documentation signal that this is a typed, concrete instance — not `any`.
- No `as` cast needed: `apiKey` is narrowed to `string` (non-falsy) by the guard, so passing it to `{ apiKey }` is fully type-safe.

### Pattern 2: Dynamic Import Test for Module-Level Throw

```typescript
// app/lib/ai/client.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import OpenAI from "openai";

describe("openaiClient", () => {
  const ORIGINAL_API_KEY = process.env["OPENAI_API_KEY"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_API_KEY !== undefined) {
      process.env["OPENAI_API_KEY"] = ORIGINAL_API_KEY;
    } else {
      delete process.env["OPENAI_API_KEY"];
    }
  });

  describe("when OPENAI_API_KEY is set", () => {
    it("exports an OpenAI instance", async () => {
      process.env["OPENAI_API_KEY"] = "sk-test-key";

      const { openaiClient } = await import("~/lib/ai/client");

      expect(openaiClient).toBeInstanceOf(OpenAI);
    });

    it("exports an instance with the chat and models namespaces", async () => {
      process.env["OPENAI_API_KEY"] = "sk-test-key";

      const { openaiClient } = await import("~/lib/ai/client");

      expect(openaiClient.chat).toBeDefined();
      expect(openaiClient.models).toBeDefined();
    });
  });

  describe("when OPENAI_API_KEY is not set", () => {
    it("throws at import time when the variable is undefined", async () => {
      delete process.env["OPENAI_API_KEY"];

      await expect(import("~/lib/ai/client")).rejects.toThrow("OPENAI_API_KEY");
    });

    it("throws at import time when the variable is an empty string", async () => {
      process.env["OPENAI_API_KEY"] = "";

      await expect(import("~/lib/ai/client")).rejects.toThrow("OPENAI_API_KEY");
    });
  });
});
```

**Where to apply**: `app/lib/ai/client.test.ts` only.

**Why this pattern**:
- `vi.resetModules()` in `beforeEach` ensures each test gets a fresh module evaluation, making the throw-at-import-time behavior observable.
- `afterEach` restores the env var to its pre-test state using the value captured before the `describe` block runs, preventing cross-test pollution.
- `await expect(import(...)).rejects.toThrow(...)` is the idiomatic Vitest pattern for asserting that a dynamic import throws synchronously during module evaluation.
- No mocking of the `OpenAI` constructor is needed for the unit tests because we are testing only the guard and the shape of the export — not making live API calls.
- The `"sk-test-key"` value is a non-empty string that passes the guard; the SDK will not make a network request just from constructing the instance.

## Test Cases

### Unit Tests

#### Test Suite: `openaiClient` (app/lib/ai/client.test.ts)

**Test 1**: Exports an `OpenAI` instance when the key is present

- **Given**: `process.env['OPENAI_API_KEY']` is set to `"sk-test-key"` and the module cache is reset.
- **When**: `app/lib/ai/client` is dynamically imported.
- **Then**: The resolved module's `openaiClient` export is an instance of `OpenAI`.
- **Coverage**: Detects regressions where the export is renamed, omitted, or typed incorrectly.

**Test 2**: Exported instance has `chat` and `models` namespaces

- **Given**: `process.env['OPENAI_API_KEY']` is set and module cache is reset.
- **When**: The module is imported and `openaiClient.chat` and `openaiClient.models` are accessed.
- **Then**: Both are defined (not `undefined`).
- **Coverage**: Detects accidental misconfiguration of the `OpenAI` constructor that would produce a non-functional client.

**Test 3**: Throws when `OPENAI_API_KEY` is `undefined`

- **Given**: `process.env['OPENAI_API_KEY']` is deleted and module cache is reset.
- **When**: `app/lib/ai/client` is dynamically imported.
- **Then**: The import promise rejects with an `Error` whose message includes `"OPENAI_API_KEY"`.
- **Coverage**: The primary safety guarantee — missing key at startup produces a clear failure rather than a cryptic runtime error during the first API call.

**Test 4**: Throws when `OPENAI_API_KEY` is an empty string

- **Given**: `process.env['OPENAI_API_KEY']` is `""` and module cache is reset.
- **When**: `app/lib/ai/client` is dynamically imported.
- **Then**: The import promise rejects with an `Error` whose message includes `"OPENAI_API_KEY"`.
- **Coverage**: Guards against the edge case where the key is present in `.env` but left blank (common developer mistake).

### Integration Tests

**Test 1**: Route action that uses `openaiClient` does not throw when key is present

- **Given**: `OPENAI_API_KEY` is set in the test environment and the route action module is loaded.
- **When**: The action is called (with the OpenAI chat call mocked at the module boundary).
- **Then**: The action completes without a module initialization error.
- **Coverage**: Confirms the client module integrates with the server action without import errors.

> Note: Full route action integration tests belong to the task that implements the generation action (Task 9 or equivalent). This test is listed here as a contract the client module must not break.

### E2E Tests

Not applicable for this task. The client module is server-only and has no UI surface. E2E coverage is provided by the generation flow tests in subsequent tasks.

## Implementation Checklist

- [ ] `app/lib/ai/client.ts` created with validation guard and `openaiClient` export
- [ ] `pnpm type-check` passes with no errors
- [ ] `pnpm exec eslint app/lib/ai/client.ts` reports no errors
- [ ] `app/lib/ai/client.test.ts` created with all four unit tests
- [ ] `pnpm test` runs the new test file with all tests green
- [ ] Coverage for `app/lib/ai/client.ts` shows 100% line and branch coverage
- [ ] No import of `~/lib/ai/client` exists in `entry.client.tsx` or any client-side route export
- [ ] `pnpm build` succeeds
- [ ] Task 8 marked as complete in task-master

## Notes & Considerations

**Why throw before the SDK constructor rather than relying on the SDK's own `OpenAIError`**

The SDK throws `"Missing credentials"` when `apiKey` is `undefined`. This message does not tell the developer which environment variable to set or where to find the example. Our guard throws first with a message that names `OPENAI_API_KEY`, references `.env.example`, and explains why the `VITE_` prefix must not be used. This is strictly a developer-experience improvement; both errors occur at module evaluation time.

**Empty string edge case**

`process.env['OPENAI_API_KEY'] = ""` is falsy in JavaScript, so `if (!apiKey)` catches it. The SDK's own constructor would not throw for an empty string (it checks `=== undefined`), so the explicit guard adds coverage the SDK does not provide.

**`noPropertyAccessFromIndexSignature` compliance**

`process.env` is typed as `NodeJS.ProcessEnv`, which uses an index signature (`[key: string]: string | undefined`). Under `noPropertyAccessFromIndexSignature`, dot-notation access (`process.env.OPENAI_API_KEY`) is a compile error. Bracket notation (`process.env['OPENAI_API_KEY']`) is required and is already the convention used in `.env.example`'s comments and the axios instance.

**Module singleton**

The `openaiClient` constant is evaluated once per Node.js process start. React Router SSR runs in a single long-lived server process, so the singleton is created once on startup, which is the recommended pattern and avoids per-request constructor overhead.

**Future reuse by M4**

M4 (AI Title Generation) will `import { openaiClient } from "~/lib/ai/client"` and call `openaiClient.chat.completions.create(...)` with a different system prompt. No changes to `client.ts` are required at that point — this design satisfies the M1 contract that `openaiClient` is reused without modification.
