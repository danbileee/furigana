# Task 15: Write E2E Tests with Playwright

**Project**: Furigana
**Generated**: 2026-03-21
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

## Overview

Task 15 is the final task in Milestone 1. Its purpose is to create a Playwright E2E test suite that validates the complete generation flow from the user's perspective — from typing in the textarea to seeing ruby-annotated text rendered on the `/furigana/:id` route.

The task description in `tasks.json` contains sample test code that targets the original architecture (single-route, tokens-in-`actionData`). The actual implementation has diverged substantially: the home action now redirects to `/furigana/:id`, tokens cross the server/client boundary through an in-memory `tokenStore`, and validation rejects non-kanji input. Every test must reflect this two-route architecture.

---

## Requirements Analysis

### Functional Requirements

- **Happy path**: Pasting valid Japanese text containing kanji and clicking "Generate Furigana" navigates to `/furigana/<uuid>` and renders `<ruby>` elements with hiragana `<rt>` readings.
- **Keyboard shortcut**: `Cmd+Enter` / `Ctrl+Enter` in the textarea triggers the same flow as clicking the submit button.
- **Empty textarea**: Submit button is disabled when textarea is empty; typing then clearing re-disables it.
- **Character limit UI**: Counter shows `n / 10,000`; counter turns destructive (danger state) at exactly 10,000 characters; button is disabled when `text.length > MAX_INPUT_LENGTH`.
- **Non-Japanese input validation**: Submitting text with no kanji returns an error alert with the exact `NON_JAPANESE_INPUT_ERROR` text and preserves the submitted text in the textarea.
- **API failure path**: When the OpenAI call fails server-side, the action returns a generic error; the error alert is shown and the textarea retains the original text.
- **Loading state**: Between submission and redirect, the button shows "Generating…" with a spinner and the textarea is disabled.

### Non-Functional Requirements

- Tests must not be flaky — use `waitForURL` instead of `waitForTimeout` for navigation assertions.
- The happy-path test calls the real OpenAI API; it requires `OPENAI_API_KEY` in the environment and should be skipped in CI if the key is absent, or assigned a sufficiently long timeout (30 s).
- Network interception for the failure simulation must route requests at the browser level (`page.route`) — the OpenAI call runs server-side during SSR, so `context.route` alone cannot block it. The correct approach for SSR failures is to test with the server returning an actual error response, not by blocking a browser-level request.
- All locators must use role-based or accessible queries (`getByRole`, `getByLabel`) in line with Playwright best practices.

### Dependencies and Constraints

- **Internal**: Depends on task 3 (Playwright config, `e2e/` directory) and task 14 (wired home route). Both are `done`.
- **External**: `@playwright/test` v1.58.2 installed. Breaking change in v1.58: `_react` / `_vue` selectors removed — not a concern since no such selectors were planned.
- **Architecture delta from task description**: The task description assumed tokens are returned in `actionData`. The codebase instead redirects to `/furigana/:id`. Tests written against the task description's assumptions will fail; this plan corrects them.
- **Validation constraint**: `validateJapaneseInput` rejects text with no kanji character. The "non-Japanese input" test path is a real server validation response, not just a client-side disabled state. The test must submit text with no kanji (e.g. pure romaji or hiragana) to trigger this path.
- **In-memory token store**: `consumeTokens` deletes the entry after a single read. Navigating to `/furigana/:id` a second time (e.g. via browser back + forward) will render an empty `<article>`. Tests should not navigate back to the reading URL after it has been consumed.

---

## Implementation Plan

### Phase 1: Establish Test File and Shared Helpers

**Objective**: Create `e2e/generation.spec.ts` with shared navigation helper and document the two-route architecture for future test authors.

#### Subtask 1.1: Create `e2e/generation.spec.ts` with imports and page object helpers

- **File to create**: `e2e/generation.spec.ts`
- **Code pattern**: Inline locator helpers using `page.getByRole` / `page.getByLabel` (no Page Object class — the app is simple enough that named getter functions suffice and keep the test file self-contained).
- **Key considerations**:
  - Import `test` and `expect` from `@playwright/test`; no other runtime imports needed.
  - Import error message constants from `~/constants/furigana.const` for exact string assertions (see Subtask 1.3).
  - Define locator accessors as inline arrow functions that take `page` and return a `Locator`. This avoids class boilerplate while keeping locator definitions in one place.
  - Add a `test.describe` block named `'Furigana generation flow'`.
  - Each test calls `page.goto('/')` as its first step (no `beforeEach` navigation — some tests may need to configure route interception before navigation).
- **Acceptance criteria**: File parses with no TypeScript errors; `pnpm test:e2e --list` lists the describe block.

#### Subtask 1.2: Define locator helper functions

- **Pattern**:
  ```typescript
  function textarea(page: Page) {
    return page.getByLabel('Japanese text input');
  }
  function submitButton(page: Page) {
    return page.getByRole('button', { name: /generate furigana/i });
  }
  function charCounter(page: Page) {
    return page.locator('[data-state]');
  }
  function errorAlert(page: Page) {
    return page.getByRole('alert');
  }
  ```
- **Key considerations**:
  - The textarea is identified by `aria-label="Japanese text input"` (set on the shadcn `<Textarea>` in `home.tsx`).
  - The counter `<p>` uses `data-state="danger"` or `data-state="default"` attribute — this is the right selector hook.
  - The error alert uses `role="alert"` (explicitly set in `home.tsx`).
- **Acceptance criteria**: Each helper compiles; locators resolve correctly in headed mode.

#### Subtask 1.3: Import error message constants for exact assertions

Error message constants are defined in `app/constants/furigana.const.ts` and must be imported into the test file for use in exact-match assertions. Using exact constant values instead of partial phrase matching ensures that if the error message wording changes in the source, the test breaks immediately and visibly rather than silently passing with a stale substring.

Note: `GENERIC_SERVER_ERROR` is currently a module-local constant in `app/routes/home.tsx`. Subtask 1.4 extracts it to a shared constants file so that tests can import it directly rather than relying on a hardcoded literal string.

- **File to reference**: `app/constants/furigana.const.ts`
- **Exported constants**:
  - `NON_JAPANESE_INPUT_ERROR` = `"Please include at least one kanji character in your text (some non-Japanese words are okay)."`
  - `GENERATION_INAVAILABLE_ERROR` = `"We couldn't generate furigana right now. Please try again."`
- **Additional constant** (to be centralized in Subtask 1.4):
  - `GENERIC_SERVER_ERROR` = `"Something went wrong. Please try again."` — currently a private constant in `app/routes/home.tsx`. After Subtask 1.4 is complete, import it from `~/constants/error.const` instead of hardcoding the literal.
- **Import pattern**:
  ```typescript
  // E2E tests can import from the app source directly because Playwright
  // resolves path aliases via the tsconfig paths defined in playwright.config.ts.
  // Verify that the playwright config includes `~/` -> `app/` alias resolution
  // before using this import. If aliases are not configured, use the relative path:
  // import { NON_JAPANESE_INPUT_ERROR } from '../app/constants/furigana.const';
  import { NON_JAPANESE_INPUT_ERROR } from '~/constants/furigana.const';
  import { GENERIC_SERVER_ERROR } from '~/constants/error.const';
  ```
- **Why exact assertions over partial matching**: `toContainText('Please include at least one kanji character')` would continue to pass even if the full message were edited to remove the clarifying parenthetical or change punctuation. `toHaveText(NON_JAPANESE_INPUT_ERROR)` fails the moment the constant or its value changes, making the test a reliable contract between the UI and the validation logic.
- **Acceptance criteria**: Both imports resolve at compile time; constant values match the strings rendered in the browser.

#### Subtask 1.4: Extract error constants to a shared file

Create `app/constants/error.const.ts` to centralize generic error message constants that are currently scattered across route modules. This makes all error strings importable in both application code and E2E tests, eliminating the need to hardcode literal strings in tests.

- **File to create**: `app/constants/error.const.ts`
- **Exported constants**:
  ```typescript
  // Generic server-side error shown when an unexpected failure occurs
  // (e.g. OpenAI API unavailable, unhandled exception in action).
  export const GENERIC_SERVER_ERROR =
    'Something went wrong. Please try again.';
  ```
- **Files to modify**:
  - `app/routes/home.tsx` — remove the module-local `GENERIC_SERVER_ERROR` declaration and add `import { GENERIC_SERVER_ERROR } from '~/constants/error.const';` at the top of the file.
  - `e2e/generation.spec.ts` — add `import { GENERIC_SERVER_ERROR } from '~/constants/error.const';` so the Test 7 stub (and its eventual full implementation) can reference the constant directly instead of a literal string.
- **Search before creating**: Run a codebase search for `GENERIC_SERVER_ERROR` to confirm it exists only in `app/routes/home.tsx` before extraction. If other route files define the same or a similar constant, consolidate them all into `error.const.ts` at the same time.
- **Key considerations**:
  - Keep `error.const.ts` separate from `furigana.const.ts` because its constants are domain-agnostic (applicable to any server action), whereas `furigana.const.ts` holds feature-specific validation messages.
  - After the import in `home.tsx` is updated, run `pnpm type-check` and `pnpm exec eslint app/routes/home.tsx` to confirm no regressions.
  - The E2E test's `test.fixme` stub comment referencing `"Something went wrong. Please try again."` as a literal should be updated to reference `GENERIC_SERVER_ERROR` from the import so the stub remains in sync if the constant value changes.
- **Acceptance criteria**: `app/constants/error.const.ts` exists and exports `GENERIC_SERVER_ERROR`; `home.tsx` imports the constant rather than declaring it locally; `pnpm type-check` passes with no new errors; `GENERIC_SERVER_ERROR` is importable in `e2e/generation.spec.ts` via the `~/constants/error.const` alias.

---

### Phase 2: Write Core Test Cases

**Objective**: Cover the primary user flow, keyboard shortcut, and empty-state validation.

#### Subtask 2.1: Happy path — generates furigana and navigates to reading route

```typescript
test('generates furigana for valid Japanese input', async ({ page }) => {
  await page.goto('/');
  await textarea(page).fill('日本語を勉強しています');
  await submitButton(page).click();

  // Action redirects to /furigana/<uuid>; wait for navigation
  await page.waitForURL(/\/furigana\/.+/, { timeout: 30_000 });

  // ReadingView renders <ruby> elements with <rt> readings
  const rubyLocator = page.locator('ruby');
  await expect(rubyLocator.first()).toBeVisible();

  const rtLocator = page.locator('ruby rt');
  const firstRt = await rtLocator.first().textContent();
  expect(firstRt).toMatch(/[\u3041-\u3096]+/); // hiragana range
});
```

- **Key considerations**:
  - Use `page.waitForURL` with a regex pattern — this is idiomatic for redirect assertions in Playwright and avoids race conditions.
  - The timeout is 30 s to accommodate real OpenAI API latency.
  - The hiragana check uses a Unicode range regex; this is more reliable than `/[ぁ-ん]+/` which can miss edge-case codepoints.
  - This test requires `OPENAI_API_KEY`. Add `test.skip(!process.env['OPENAI_API_KEY'], 'Requires OPENAI_API_KEY')` at the top of the describe block, or configure it as a tagged `@slow` test.
- **Acceptance criteria**: Test passes end-to-end with a valid API key; navigates to `/furigana/<uuid>` and finds at least one `<ruby>` element.

#### Subtask 2.2: Keyboard shortcut — `Meta+Enter` submits the form

```typescript
test('Cmd+Enter submits the form', async ({ page }) => {
  await page.goto('/');
  await textarea(page).fill('東京に行きました');
  await textarea(page).press('Meta+Enter');

  await page.waitForURL(/\/furigana\/.+/, { timeout: 30_000 });
  await expect(page.locator('ruby').first()).toBeVisible();
});
```

- **Key considerations**:
  - `page.keyboard.press('Meta+Enter')` fires only on the focused element. Use `locator.press()` on the textarea to guarantee focus.
  - Playwright maps `Meta+Enter` correctly for both Mac and Linux. On CI (Linux), `Control+Enter` is the equivalent shortcut. Test both by running this test twice with different modifier keys, or accept that `Meta+Enter` is the canonical test (the `home.tsx` component handles both `metaKey` and `ctrlKey`).
- **Acceptance criteria**: Form submits via keyboard; navigation to `/furigana/:id` occurs.

#### Subtask 2.3: Empty textarea — submit button is disabled on load

```typescript
test('disables submit button when textarea is empty', async ({ page }) => {
  await page.goto('/');
  await expect(submitButton(page)).toBeDisabled();

  await textarea(page).fill('日本語');
  await expect(submitButton(page)).toBeEnabled();

  await textarea(page).clear();
  await expect(submitButton(page)).toBeDisabled();
});
```

- **Key considerations**: No API call is needed; this test is purely client-side state validation.
- **Acceptance criteria**: Button disabled state matches textarea emptiness at each step.

#### Subtask 2.4: Character limit — counter turns danger at max length

```typescript
test('shows danger counter at 10,000 characters', async ({ page }) => {
  await page.goto('/');
  await textarea(page).fill('あ'.repeat(10_000));

  const counter = charCounter(page);
  await expect(counter).toHaveAttribute('data-state', 'danger');
  await expect(counter).toContainText('10,000 / 10,000');

  // Button is still enabled at exactly the limit (isAtOrOverLimit does not disable)
  await expect(submitButton(page)).toBeEnabled();
});
```

- **Key considerations**:
  - Reading `home.tsx` carefully: `isAtOrOverLimit = charCount >= MAX_INPUT_LENGTH` is used only for the counter danger state. `isOverLimit = charCount > MAX_INPUT_LENGTH` is used in `isSubmitDisabled`. At exactly 10,000, the button is **enabled**. The task description says "disables submit button when textarea exceeds 10000 characters" — this test must reflect the actual implementation, not the task description.
  - `maxLength={MAX_INPUT_LENGTH}` on the textarea prevents typing beyond 10,000 characters in the browser, so it is impossible to reach 10,001 via `fill` unless the `maxLength` attribute is bypassed. The server-side validation still enforces it.
- **Acceptance criteria**: Counter data-state is `"danger"` at 10,000 characters; button remains enabled.

---

### Phase 3: Write Error Path Test Cases

**Objective**: Cover the non-Japanese validation error and the generic server error.

#### Subtask 3.1: Non-Japanese input — validation error shown, text preserved

```typescript
import { NON_JAPANESE_INPUT_ERROR } from '~/constants/furigana.const';

test('shows validation error for non-Japanese input and preserves text', async ({ page }) => {
  await page.goto('/');
  const inputText = 'Hello, this is English only.';
  await textarea(page).fill(inputText);
  await submitButton(page).click();

  // Server validates and returns error without redirecting
  await expect(errorAlert(page)).toBeVisible({ timeout: 10_000 });

  // Use the exact constant value — partial matching would silently pass if the
  // message wording changes. Exact assertion makes this test a contract.
  await expect(errorAlert(page)).toHaveText(NON_JAPANESE_INPUT_ERROR);

  // Textarea still contains the original text
  await expect(textarea(page)).toHaveValue(inputText);
  // URL did not change
  expect(page.url()).toMatch(/\/$/);
});
```

- **Key considerations**:
  - `NON_JAPANESE_INPUT_ERROR` is exported from `app/constants/furigana.const.ts` with the full value: `"Please include at least one kanji character in your text (some non-Japanese words are okay)."`. Using `toHaveText` with the imported constant (rather than `.toContainText` with a substring) makes the test a strict contract against the validation message.
  - This test does NOT call the OpenAI API (validation short-circuits before `generateFurigana`). No API key needed.
  - The action returns `{ error, originalText }` and the component restores `originalText` into the textarea via `useEffect`.
- **Acceptance criteria**: Alert is visible; alert text exactly matches `NON_JAPANESE_INPUT_ERROR`; textarea retains input; URL stays at `/`.

#### Subtask 3.2: Generic server error path (intercepted via `page.route`)

The OpenAI call happens server-side. To simulate an API failure without a real key, the test must intercept the server's outbound HTTP request to `api.openai.com`. Playwright's `page.route` intercepts requests the browser makes, but SSR requests are made by the Node.js server process — they are invisible to Playwright's route interception.

The correct approach is to set up the test environment so the server action throws. The viable options are:

1. **Use `page.route` to intercept the form POST and return a mocked server response** — this bypasses the actual action entirely, which tests the UI but not the flow.
2. **Run the test without a valid API key set, so the client module throws at import** — too blunt and breaks other tests.
3. **Use `OPENAI_API_KEY=invalid` in a dedicated test environment** — makes the real API call fail with a 401; the action catches it and returns the generic error. This is the most realistic approach.

**Recommended approach**: Set the test to use an invalid key by running it in a separate playwright project that sets `OPENAI_API_KEY=invalid`. This is pragmatic for a solo developer project. As an alternative, the test can be marked `@api` and conditionally skipped based on environment.

For the MVP scope, implement this test with `test.fixme()` stub documenting the intent, with a note explaining the SSR interception constraint, and implement the simpler mocked-POST variant in a follow-up:

```typescript
import { GENERIC_SERVER_ERROR } from '~/constants/error.const';

test.fixme(
  'shows generic error when OpenAI API is unavailable',
  async ({ page }) => {
    // NOTE: OpenAI calls are server-side (SSR). Playwright route interception
    // targets browser-level requests only and cannot intercept Node.js outbound
    // calls. To test this path, run with OPENAI_API_KEY set to an invalid value
    // in a dedicated playwright project, or mock the furigana.service module
    // at the process level.
    //
    // Expected error message: GENERIC_SERVER_ERROR from ~/constants/error.const
    // (value: "Something went wrong. Please try again.")
    //
    // Implementation plan:
    // 1. Add a playwright project 'api-failure' in playwright.config.ts that sets
    //    process.env.OPENAI_API_KEY = 'invalid-key' via a globalSetup fixture.
    // 2. This test targets that project exclusively.
    // 3. Submit valid kanji text; expect errorAlert to have text matching
    //    GENERIC_SERVER_ERROR and textarea to retain original text.
  },
);
```

- **Acceptance criteria**: Stub is committed with a clear comment explaining why the test is deferred and what the correct implementation strategy is.

---

### Phase 4: Environment and CI Configuration

**Objective**: Ensure the E2E suite runs cleanly in CI with graceful API-key handling.

#### Subtask 4.1: Guard API-dependent tests with environment check

Add a `test.describe.configure` or per-test `test.skip` for tests that call the real OpenAI API:

```typescript
test.describe('Furigana generation flow', () => {
  const hasApiKey = !!process.env['OPENAI_API_KEY'];

  test('generates furigana for valid Japanese input', async ({ page }) => {
    test.skip(!hasApiKey, 'Skipped: OPENAI_API_KEY not set in environment');
    // ...
  });
```

- **Key considerations**: `test.skip` with a condition and message is idiomatic Playwright. It avoids failing CI when the key is absent while still running the test locally.
- **Acceptance criteria**: `pnpm test:e2e` in a CI environment without `OPENAI_API_KEY` completes without failing; skipped tests are reported as skipped.

#### Subtask 4.2: Verify `webServer` config works for the test suite

The existing `playwright.config.ts` already defines:

```typescript
webServer: {
  command: 'pnpm dev',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env['CI'],
},
```

No changes needed. Confirm the dev server starts correctly and the `OPENAI_API_KEY` env var is forwarded to the server process by `.env` file loading.

- **Key considerations**: React Router's `pnpm dev` command runs with `NODE_OPTIONS='--import ./instrument.server.mjs'`. Playwright spawns this command as a subprocess; `.env` file must be present at the project root with the key set.
- **Acceptance criteria**: `pnpm test:e2e` with `OPENAI_API_KEY` set runs the full suite; dev server starts once and is reused across tests.

---

## Third-Party Integration Research

### `@playwright/test` v1.58.2 (installed: 1.58.2, latest: 1.58.x)

- **Official docs**: [playwright.dev/docs](https://playwright.dev/docs)
- **Recent changes relevant to this task**:
  - v1.58: Removed `_react` and `_vue` selector engines. Not used in this task.
  - v1.57: Added `wait` field to `testConfig.webServer` for regex-based server readiness detection. Potentially useful if the dev server start time is inconsistent.
  - v1.57: Transitioned from Chromium to Chrome for Testing builds in headed mode. No impact on test logic.
- **Open issues / known bugs**: No known issues affecting locator resolution or route interception in the version range 1.57–1.58.
- **Security advisories**: None found.
- **Performance notes**: `fullyParallel: true` is already configured. The happy-path test calls the real OpenAI API and will be slow; assign `test.slow()` or increase `timeout` per-test rather than globally.
- **SSR interception constraint**: Playwright's `page.route` and `context.route` intercept requests made by the browser process. Requests made server-side by Node.js (the React Router SSR server) are invisible to these interceptors. This is a fundamental architectural constraint, not a bug.

> **Needs Review**: The task description's failure-path test uses `context.route('**/api.openai.com/**', route => route.abort())`. Because OpenAI calls happen in the Node.js server process (not in the browser), this interception will never fire and the test will hang waiting for a response that never comes. The `test.fixme` stub in Phase 3, Subtask 3.2 documents this constraint and proposes a correct implementation path.

---

## Code Patterns

### Pattern 1: Inline locator helpers

```typescript
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { NON_JAPANESE_INPUT_ERROR } from '~/constants/furigana.const';

function textarea(page: Page) {
  return page.getByLabel('Japanese text input');
}
function submitButton(page: Page) {
  return page.getByRole('button', { name: /generate furigana/i });
}
function charCounter(page: Page) {
  return page.locator('[data-state]');
}
function errorAlert(page: Page) {
  return page.getByRole('alert');
}
```

**Where to apply**: At the top of `e2e/generation.spec.ts`, before the `test.describe` block.

**Why this pattern**: Keeps locators co-located with the tests, avoids Page Object class overhead, and makes the aria contract between component and test explicit without abstraction.

### Pattern 2: waitForURL for redirect assertions

```typescript
await page.waitForURL(/\/furigana\/.+/, { timeout: 30_000 });
```

**Where to apply**: All tests that invoke the generation action and expect a redirect.

**Why this pattern**: Prefer `waitForURL` over `waitForNavigation` (deprecated in newer Playwright) or `waitForTimeout` (flaky). The regex pattern is more resilient than a string match since the UUID is dynamic.

### Pattern 3: Conditional test skip for API key

```typescript
test('generates furigana for valid Japanese input', async ({ page }) => {
  test.skip(!process.env['OPENAI_API_KEY'], 'Skipped: OPENAI_API_KEY not set in environment');
  // test body
});
```

**Where to apply**: All tests that require a live OpenAI API call.

**Why this pattern**: `test.skip` with a condition and reason string is the idiomatic Playwright way to mark environment-dependent tests. It produces a clear skip message in the HTML report.

### Pattern 4: Exact error message assertions using imported constants

```typescript
// Import constants so assertions are strict contracts, not substring guesses.
import { NON_JAPANESE_INPUT_ERROR } from '~/constants/furigana.const';
import { GENERIC_SERVER_ERROR } from '~/constants/error.const';

await expect(errorAlert(page)).toHaveText(NON_JAPANESE_INPUT_ERROR);

// After Subtask 1.4, the server error assertion uses the imported constant:
await expect(errorAlert(page)).toHaveText(GENERIC_SERVER_ERROR);
```

**Where to apply**: All tests that assert on server-side validation or error messages.

**Why this pattern**: `toContainText('partial phrase')` passes silently when the surrounding message changes. `toHaveText(CONSTANT)` fails the moment the constant's value is updated, turning the test into a living contract between the UI and the validation layer. All error message constants — including `GENERIC_SERVER_ERROR` — are now exported from dedicated constants files, so no test should use a hardcoded literal string for an error message.

---

## Test Cases

### E2E Tests (`e2e/generation.spec.ts`)

**Test 1**: Generates furigana for valid Japanese input (happy path)

- **Given**: Dev server running, `OPENAI_API_KEY` set in environment, browser at `/`
- **When**: User types `'日本語を勉強しています'` into the textarea and clicks "Generate Furigana"
- **Then**: Browser navigates to `/furigana/<uuid>`; at least one `<ruby>` element is visible; the first `<rt>` element contains hiragana characters
- **Coverage**: Full generation loop — form submission, server action, OpenAI call, parser, redirect, loader, ReadingView render

**Test 2**: Cmd+Enter keyboard shortcut submits the form

- **Given**: Dev server running, `OPENAI_API_KEY` set, browser at `/`, textarea has valid Japanese text
- **When**: User presses `Meta+Enter` inside the textarea
- **Then**: Same outcome as Test 1 — navigation to `/furigana/<uuid>` with ruby elements
- **Coverage**: `onKeyDown` handler in `home.tsx`; `formRef.current?.requestSubmit()` path

**Test 3**: Submit button disabled on initial load (empty textarea)

- **Given**: Browser at `/`
- **When**: Page loads (textarea is empty)
- **Then**: Submit button has `disabled` attribute
- **Coverage**: `isSubmitDisabled = charCount === 0 || isOverLimit || isSubmitting` initial state

**Test 4**: Submit button re-disabled after clearing textarea

- **Given**: Browser at `/`, user has typed text
- **When**: User clears the textarea
- **Then**: Submit button becomes disabled again
- **Coverage**: Reactive `isSubmitDisabled` state update on textarea clear

**Test 5**: Character counter shows danger state at 10,000 characters

- **Given**: Browser at `/`
- **When**: User fills textarea with 10,000 characters
- **Then**: Counter `<p>` has `data-state="danger"` and displays `10,000 / 10,000`; submit button remains enabled
- **Coverage**: `isAtOrOverLimit = charCount >= MAX_INPUT_LENGTH` triggers danger; `isOverLimit = charCount > MAX_INPUT_LENGTH` is false at exactly 10,000

**Test 6**: Non-Japanese input shows validation error and preserves text

- **Given**: Browser at `/`
- **When**: User enters `'Hello, this is English only.'` and clicks submit
- **Then**: Error alert visible with the exact text from `NON_JAPANESE_INPUT_ERROR` (`"Please include at least one kanji character in your text (some non-Japanese words are okay)."`); textarea retains the submitted text; URL remains `/`
- **Coverage**: `validateJapaneseInput` rejection; `actionData.originalText` restored via `useEffect` in `home.tsx`; exact message contract enforced by imported constant

**Test 7** (stub): Generic server error when API is unavailable

- **Given**: Server configured to fail on OpenAI calls (see Phase 3, Subtask 3.2)
- **When**: User submits valid Japanese text
- **Then**: Error alert visible with text matching `GENERIC_SERVER_ERROR` imported from `~/constants/error.const` (value: `"Something went wrong. Please try again."`); textarea retains original text; no navigation occurs
- **Coverage**: `catch` block in `home.tsx` action; `GENERIC_SERVER_ERROR` exported from `app/constants/error.const.ts` (extracted in Subtask 1.4)

---

## Implementation Checklist

- [ ] Create `app/constants/error.const.ts` and export `GENERIC_SERVER_ERROR = 'Something went wrong. Please try again.'`
- [ ] Remove the module-local `GENERIC_SERVER_ERROR` declaration from `app/routes/home.tsx`
- [ ] Add `import { GENERIC_SERVER_ERROR } from '~/constants/error.const'` to `app/routes/home.tsx`
- [ ] Run `pnpm type-check` and `pnpm exec eslint app/routes/home.tsx` after updating the import to confirm no regressions
- [ ] Create `e2e/generation.spec.ts` with `import { test, expect } from '@playwright/test'`
- [ ] Import `NON_JAPANESE_INPUT_ERROR` from `~/constants/furigana.const` (or relative path if alias not configured in Playwright)
- [ ] Import `GENERIC_SERVER_ERROR` from `~/constants/error.const` in `e2e/generation.spec.ts`
- [ ] Add locator helper functions (`textarea`, `submitButton`, `charCounter`, `errorAlert`)
- [ ] Write Test 1: happy path generation with `waitForURL` and ruby element assertion
- [ ] Write Test 2: `Meta+Enter` keyboard shortcut
- [ ] Write Test 3: submit button disabled on initial load
- [ ] Write Test 4: button re-disabled after textarea clear
- [ ] Write Test 5: danger counter at 10,000 characters with correct button state
- [ ] Write Test 6: non-Japanese validation error with `toHaveText(NON_JAPANESE_INPUT_ERROR)` and text preservation
- [ ] Write Test 7: `test.fixme` stub for server error path referencing `GENERIC_SERVER_ERROR` constant (not a literal string)
- [ ] Add `test.skip(!process.env['OPENAI_API_KEY'], ...)` guard to Tests 1 and 2
- [ ] Run `pnpm test:e2e --headed` locally to visually verify all passing tests
- [ ] Run `pnpm type-check` to confirm no TypeScript errors in `e2e/generation.spec.ts`
- [ ] Run `pnpm exec eslint e2e/generation.spec.ts` to confirm no lint errors
- [ ] Verify `pnpm test:e2e` completes without failures in a clean terminal (no dev server running, `reuseExistingServer: true` picks it up or starts it)

---

## Notes and Considerations

**Route architecture delta**: The task description was written against a single-route architecture where tokens came back in `useActionData`. The implementation uses redirect-to-route via `tokenStore`. Every test targeting the success path must assert on `/furigana/:id` navigation and `<ruby>` elements — never on `useActionData` results from the home route.

**Token store is ephemeral**: The `consumeTokens` function deletes the token entry after one read. In E2E tests, never navigate to the reading URL more than once per test or the second load will show an empty `<article>`. Tests that need to assert on the reading view must complete their assertions before navigating away.

**Non-Japanese validation vs. client disable**: The client disables the button only for empty/over-limit text. Non-kanji text is not blocked client-side — it reaches the server, which validates and returns an error. Tests for the non-Japanese path submit the form normally (button is enabled) and wait for the server response.

**Error message constants**: `NON_JAPANESE_INPUT_ERROR` and `GENERATION_INAVAILABLE_ERROR` are exported from `app/constants/furigana.const.ts`. `GENERIC_SERVER_ERROR` is extracted from `app/routes/home.tsx` and exported from `app/constants/error.const.ts` as part of Subtask 1.4. After that subtask is complete, import `GENERIC_SERVER_ERROR` directly from `~/constants/error.const` in both `home.tsx` and `e2e/generation.spec.ts`. No test should use a hardcoded literal string for an error message — always import the constant.

**`test.fixme` is a deliberate choice**: The server error path test is stubbed rather than omitted. This keeps the intent visible in the test file and prevents the same investigation from being repeated. The comment in the stub explains the SSR interception constraint clearly so the next developer (or the developer's future self) can implement it without re-discovering the issue.

**Playwright v1.58 breaking change — not applicable**: The removal of `_react` / `_vue` selectors does not affect this test suite since all locators use role-based and attribute-based queries.
