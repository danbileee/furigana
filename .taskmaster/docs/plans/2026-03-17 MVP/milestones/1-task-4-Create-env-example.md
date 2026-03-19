# Task 4: Create .env.example with OPENAI_API_KEY

## Overview

Update `.env.example` to document the `OPENAI_API_KEY` environment variable alongside
the existing `VITE_SENTRY_DSN` entry. The change is a single-file edit that serves
two purposes: developer onboarding documentation and a prerequisite gate for Tasks 8
and 10, which instantiate and invoke the OpenAI client exclusively in server-side code.

No new files need to be created. The existing `env.d.ts` does not need modification
because `OPENAI_API_KEY` is a server-only variable — it is never accessed through
`import.meta.env` and therefore has no place in the `ImportMetaEnv` interface.

---

## Requirements Analysis

### Functional Requirements

- `.env.example` must contain a placeholder entry for `OPENAI_API_KEY` with no
  actual secret value.
- The entry must use the bare `OPENAI_API_KEY` name (no `VITE_` prefix).
- Inline comments must explain why the prefix is absent and where to obtain a key.
- The existing `VITE_SENTRY_DSN=` entry must be preserved with its existing comment.
- `.env.example` must be safe to commit (placeholder values only).

### Non-Functional Requirements

- **Security**: The real `OPENAI_API_KEY` value must only ever exist in `.env`
  (gitignored). The example file contains only a recognisable placeholder
  (`sk-...`) that cannot be mistaken for a live key.
- **Onboarding speed**: A developer cloning the repo for the first time should be
  able to run `cp .env.example .env` and immediately know every required variable.
- **Clarity**: Comments must be self-contained — do not assume the reader has read
  the milestone PRD.

### Dependencies and Constraints

- **Internal**: No other task depends on this task. Tasks 8 and 10 depend on the
  _local `.env`_ file that a developer creates by following these instructions, not
  on `.env.example` itself.
- **External**: None.
- **Constraints**:
  - Vite exposes only `VITE_`-prefixed variables to the browser bundle via
    `import.meta.env`. Variables without that prefix are invisible to Vite's client
    bundle even if present in `.env`. This is the mechanism that enforces
    server-only access.
  - React Router v7 SSR route actions and loaders run in Node.js; they access
    environment variables through `process.env['OPENAI_API_KEY']`.
  - `env.d.ts` augments `ImportMetaEnv` for client-side variables only. Adding
    `OPENAI_API_KEY` there would be incorrect and misleading.

---

## Implementation Plan

### Phase 1: Update .env.example

**Objective**: Add the documented `OPENAI_API_KEY` placeholder to `.env.example`.

#### Subtask 1.1: Edit `.env.example`

- **File to modify**: `/Users/danbilee/Projects/furigana/.env.example`
- **Current content**:
  ```
  VITE_SENTRY_DSN=
  ```
- **New content**:

  ```env
  # Sentry DSN for error tracking
  VITE_SENTRY_DSN=

  # OpenAI API key for AI furigana generation (server-only — no VITE_ prefix)
  # Vite only exposes VITE_-prefixed variables to the client bundle.
  # This variable is accessed server-side via process.env['OPENAI_API_KEY'] in
  # React Router route actions and loaders — never through import.meta.env.
  # Get your API key from: https://platform.openai.com/api-keys
  OPENAI_API_KEY=sk-...
  ```

- **Key considerations**:
  - `sk-...` is a recognisable placeholder that mimics the shape of a real OpenAI
    key without containing any valid characters that could be silently accepted.
  - The comment block explains the VITE* prefix absence inline, so any developer
    who wonders "why no VITE*?" gets the answer without leaving the file.
  - A blank line separates the two variable groups for visual clarity.
- **Acceptance criteria**:
  - `cat .env.example` shows both variables with comments.
  - `grep OPENAI_API_KEY .env.example` returns the documented line.
  - `grep VITE_OPENAI .env.example` returns nothing (no accidental VITE\_ prefix).

#### Subtask 1.2: Verify `.gitignore` covers `.env`

- **File to inspect**: `/Users/danbilee/Projects/furigana/.gitignore`
- **Confirmed** (from pre-plan analysis): `.gitignore` line 5 is `.env` and line 6
  is `.env.local`. Both cover the file a developer creates by copying `.env.example`.
- **No change needed.**
- **Acceptance criteria**:
  - `git check-ignore -v .env` outputs a match on the `.env` pattern.
  - `git check-ignore -v .env.example` outputs nothing (example file is not
    ignored and will be tracked).

#### Subtask 1.3: Confirm env.d.ts does not need changes

- **File to inspect**: `/Users/danbilee/Projects/furigana/env.d.ts`
- **Current content**: Declares `VITE_API_HOST` inside `ImportMetaEnv`.
- **Decision**: Do not add `OPENAI_API_KEY` here.
  - `env.d.ts` types `import.meta.env` — the Vite client bundle surface.
  - `OPENAI_API_KEY` is never accessed via `import.meta.env`; accessing it that
    way in a component would be a security bug.
  - Server-side code uses `process.env['OPENAI_API_KEY']` which is typed as
    `string | undefined` by `@types/node` — no extra declaration is needed.
- **No change needed.**

#### Subtask 1.4: Write local `.env` for integration testing

This step is performed by the developer on their own machine and is never committed.

```bash
cp .env.example .env
# Then open .env and replace sk-... with your real key:
# OPENAI_API_KEY=sk-proj-<your-actual-key>
```

- The variable is available to the running Node.js process because React Router's
  dev server (Vite in SSR mode) loads `.env` via its built-in dotenv integration.
- **Acceptance criteria** (manual verification):
  - Start `pnpm dev`.
  - In a route action (added in Task 10), log `Boolean(process.env['OPENAI_API_KEY'])`.
  - The console prints `true`.

---

## Third-Party Integration Research

### Vite v7 — environment variable handling

- **Official docs**: https://vite.dev/guide/env-and-mode
- **Relevant behaviour**: Only variables prefixed with `VITE_` are statically
  replaced in the client bundle. All other variables in `.env` remain on the
  server process; they are never serialised into `import.meta.env`.
- **Recent changes**: Vite 5 introduced "Environment API" (experimental) in v5.1.
  Vite 6 graduated it to stable. Vite 7 (installed: `^7.0.0`) continues this API
  but the core `VITE_` prefix rule is unchanged since Vite 2.
- **Open issues / known bugs**: None relevant to basic env var handling.
- **Security advisories**: None. The prefix-based isolation is a well-established,
  intentional design; it is not a workaround.
- **Performance notes**: N/A — static replacement happens at build time.
- **Case studies**: Standard practice across all Vite-based full-stack frameworks
  (SvelteKit, Nuxt, Remix, React Router).

### React Router v7 — server env access

- **Official docs**: https://reactrouter.com/how-to/environment-variables
- **Relevant behaviour**: In SSR mode, route `action` and `loader` functions execute
  in Node.js. `process.env` is available without any additional setup. Vite's
  built-in dotenv integration loads `.env` before the server starts.
- **Recent changes**: No breaking changes to env var access in v7.
- **Open issues / known bugs**: None relevant.
- **Security advisories**: None.
- **Performance notes**: N/A.

---

## Code Patterns

### Pattern 1: Server-only env var access

```typescript
// app/lib/openai/client.ts  (Task 8)
// Correct: bracket notation required by noPropertyAccessFromIndexSignature
const apiKey = process.env["OPENAI_API_KEY"];
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}
```

**Where to apply**: Any server-side file that reads `OPENAI_API_KEY` (Task 8 client
module, Task 10 route action).

**Why this pattern**:

- `tsconfig.json` sets `noPropertyAccessFromIndexSignature: true`, which disallows
  `process.env.OPENAI_API_KEY` — bracket notation is required.
- The explicit undefined-guard converts `string | undefined` to `string` without
  using `as` or `!` non-null assertions, staying within strict type rules.
- Throwing early produces a clear startup error instead of a cryptic API 401 later.

### Pattern 2: .env.example entry structure

```env
# <Variable purpose — one line>
# <Extra context if needed — especially for non-obvious naming decisions>
# <Link to external resource if needed>
VARIABLE_NAME=<placeholder-value>
```

**Where to apply**: Every new variable added to `.env.example`.

**Why this pattern**: Keeps onboarding friction low. A new developer reads the
comment, understands the intent, and knows where to get the value — all without
leaving the file.

---

## Test Cases

### Unit Tests

No unit tests are warranted for a documentation file. The correctness of `.env.example`
is verified through the integration and manual checks below.

### Integration Tests

**Test 1**: OpenAI client rejects undefined key at module initialisation

- **Given**: `process.env['OPENAI_API_KEY']` is `undefined` (not set in the
  test environment).
- **When**: The OpenAI client module (Task 8) is imported.
- **Then**: An `Error` with message `'OPENAI_API_KEY is not set'` is thrown.
- **Coverage**: Detects regressions where the guard is removed or bypassed.
- **Note**: This test belongs to Task 8's test suite but depends on the env var
  naming established in this task.

**Test 2**: `VITE_SENTRY_DSN` remains unchanged

- **Given**: `.env.example` has been modified.
- **When**: `cat .env.example` is run (or the file is parsed in CI).
- **Then**: `VITE_SENTRY_DSN=` is still present and unmodified.
- **Coverage**: Guards against accidental deletion of the Sentry variable.

### E2E Tests

**Test 1**: Local `.env` is loaded by the dev server

- **Given**: `.env` exists locally with a valid `OPENAI_API_KEY` value.
- **When**: `pnpm dev` is started and the furigana generation route is exercised
  (Task 10 E2E test).
- **Then**: The OpenAI call succeeds (HTTP 200 from the action, no `401 Unauthorized`
  from the OpenAI API).
- **Coverage**: Confirms Vite's dotenv integration loads the key into `process.env`
  correctly in SSR mode.

---

## Implementation Checklist

- [ ] Edit `.env.example`: add section header comment for `VITE_SENTRY_DSN`,
      blank line, then `OPENAI_API_KEY` block with comments and placeholder.
- [ ] Verify `git check-ignore -v .env` outputs a match (`.gitignore` confirmed).
- [ ] Verify `git check-ignore -v .env.example` outputs nothing (file is tracked).
- [ ] Confirm `env.d.ts` is left unchanged (no `OPENAI_API_KEY` in `ImportMetaEnv`).
- [ ] Copy `.env.example` to local `.env` and fill in a real API key.
- [ ] Start `pnpm dev` and confirm `process.env['OPENAI_API_KEY']` is accessible
      in a test server action (manual smoke test).
- [ ] Run `pnpm type-check` — no errors introduced.
- [ ] Run `pnpm exec eslint .` — no errors introduced (`.env.example` is not linted,
      but confirming no side-effects on other files).

---

## Notes and Considerations

**Why `sk-...` as the placeholder value**

OpenAI API keys follow the format `sk-proj-<random>` (new format) or `sk-<random>`
(legacy format). Using `sk-...` communicates the expected shape while being
obviously not a real key. Avoid using an empty value (`OPENAI_API_KEY=`) because
some tools treat an empty string as "variable set" and suppress the missing-key
error; the `sk-...` placeholder produces a clean 401 from the API, making
misconfiguration immediately visible rather than silently failing.

**`env.d.ts` and the `VITE_API_HOST` discrepancy**

The existing `env.d.ts` declares `VITE_API_HOST`, but `.env.example` currently
only documents `VITE_SENTRY_DSN`. This discrepancy pre-exists Task 4 and is out
of scope. A follow-up clean-up task should reconcile `env.d.ts` with `.env.example`
to ensure all documented variables are typed and all typed variables are documented.

**Vite's dotenv loading in SSR mode**

Vite automatically loads `.env` and `.env.local` before the dev server starts.
In production (`pnpm build` + `pnpm start`), the Node.js server process must have
`OPENAI_API_KEY` injected via the host environment (e.g., a PaaS secrets panel,
a Docker `--env-file`, or a CI/CD secret). The production entry point does not
load `.env` automatically — document this in the deployment runbook when it is
written.

**Never access `OPENAI_API_KEY` via `import.meta.env`**

If a future code change accidentally writes `import.meta.env.OPENAI_API_KEY`,
the value will be `undefined` in production (Vite strips non-`VITE_` variables
from the bundle). TypeScript will not catch this because `import.meta.env` is
typed as `ImportMetaEnv & Record<string, string>` by `vite/client`. The correct
access path is always `process.env['OPENAI_API_KEY']` in server-only modules.
ESLint rules that ban `import.meta.env` access in `.server.ts` files (if added
in a future task) would make this constraint machine-enforceable.
