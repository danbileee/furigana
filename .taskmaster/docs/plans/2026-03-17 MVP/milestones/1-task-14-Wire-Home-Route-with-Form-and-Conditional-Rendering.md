# Task 14: Wire Home Route with Form and Conditional Rendering

**Project**: Furigana MVP — AI Japanese Reading Assistant
**Generated**: 2026-03-21 (revised 2026-03-21)
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`
**Task Dependencies**: Task 10 (route action), Task 11 (InputArea), Task 12 (ReadingView)

---

## Overview

Task 14 closes the final gap in Milestone 1's end-to-end loop. The route architecture is already settled: rather than conditionally swapping components inside a single home route, the action redirects to a dedicated `/furigana/:id` reading route on success. This keeps `home.tsx` a pure form screen and the reading view a distinct, bookmarkable URL.

The remaining scope falls into two areas:

1. **Fix the one failing action test** — the test expects the redirect URL to include `?storage=in-memory`; that search param pattern is no longer part of the architecture. The test must be updated to match the plain `/furigana/${id}` redirect that the action already produces.

2. **Document and verify the correct RR v7 patterns** already in use — loading state detection via `useNavigation()`, error display via `useActionData()`, and the two-route conditional rendering strategy — so the implementation is well-understood and its test coverage is confirmed complete.

---

## Codebase State at Task Start

### What Is Already Done and Passing

| Component                   | File                                    | Status                                                                                              |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Home route action           | `app/routes/home.tsx`                   | Implemented — validates, generates, sets tokens, redirects to `/furigana/${id}`                     |
| Home route component        | `app/routes/home.tsx`                   | Implemented — form, loading state via `useNavigation`, error display via `useActionData`, Cmd+Enter |
| Furigana reading route      | `app/routes/furigana.$id.tsx`           | Implemented — loader calls `consumeTokens(params.id)`, ruby rendering for all token types           |
| Route config                | `app/routes.ts`                         | `index("routes/home.tsx")` at `/` and `route("furigana/:id", ...)` at `/furigana/:id`               |
| Token storage service       | `app/services/token-storage.service.ts` | Done                                                                                                |
| Furigana generation service | `app/services/furigana.service.ts`      | Done                                                                                                |
| Annotation string parser    | `app/lib/furigana/parse.ts`             | Done                                                                                                |
| Input validation            | `app/lib/furigana/validate.ts`          | Done                                                                                                |
| Input sanitization          | `app/lib/furigana/sanitize.ts`          | Done                                                                                                |
| Schema + type guards        | `app/schema/furigana.schema.ts`         | Done                                                                                                |
| Home component tests        | `app/routes/home.test.tsx`              | 8 tests — all passing                                                                               |
| Home action tests           | `app/routes/home.test.ts`              | 10 tests — 9 passing, 1 failing                                                                     |
| Furigana loader tests       | `app/routes/furigana.$id.test.ts`       | 3 tests — all passing                                                                               |
| Furigana component tests    | `app/routes/furigana.$id.test.tsx`      | 8 tests — all passing                                                                               |

### The Single Failing Test

```
FAIL app/routes/home.test.ts > home action >
  redirects to /furigana/<uuid>?storage=in-memory on successful generation

Expected: "/furigana/123e4567-e89b-12d3-a456-426614174000?storage=in-memory"
Received: "/furigana/123e4567-e89b-12d3-a456-426614174000"
```

The test was written anticipating a storage dispatch pattern that was subsequently dropped from the architecture. The action redirect is already correct. The fix is in the test, not the production code.

---

## Requirements Analysis

### Functional Requirements

- **FR1**: The failing action test must be updated to expect the redirect URL `/furigana/<uuid>` (without any search param). The action code itself is correct and must not change.
- **FR2**: The `home.tsx` component detects loading state via `navigation.state === "submitting" && navigation.formMethod === "POST"` from `useNavigation()` — this pattern must remain and be documented.
- **FR3**: The `home.tsx` component displays action errors via `useActionData<ActionData>()` — this pattern must remain and be documented.
- **FR4**: The conditional rendering strategy (form on `/`, reading view on `/furigana/:id`) is implemented via two separate flat routes in `app/routes.ts`, not via runtime conditional logic. This must be documented as the authoritative architectural decision.
- **FR5**: All tests must pass (107 existing, with the 1 failing test fixed by updating the test assertion).

### Non-Functional Requirements

- **NFR1**: No `any` or `as` casts. All code must satisfy `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noPropertyAccessFromIndexSignature`.
- **NFR2**: Type imports must use the `import type {}` inline style as enforced by ESLint's `consistent-type-imports` rule.
- **NFR3**: The `useEffect` in `home.tsx` that syncs `actionOriginalText` into `text` state is intentional and correct — it handles the case where the component does not remount between submissions. No changes are needed to this pattern.

### Dependencies and Constraints

- The `consumeTokens` function deletes the entry from the store after the first read. A refresh of `/furigana/<uuid>` will yield an empty reading view. This is the intended and acceptable M1 behavior.
- The `FuriganaToken` type uses the field name `yomi` (not `reading`) for the ruby reading value — confirmed in `furigana.schema.ts`. No changes to the schema are in scope.
- M1 contracts that must remain intact: `FuriganaToken[]` as the canonical parsed type; `consumeTokens` as the M1 retrieval function; `openaiClient` in `app/lib/ai/client.ts`.

---

## Implementation Plan

### Phase 1: Fix the Failing Action Test

**Objective**: Update the one failing test assertion to match the redirect URL the action already produces. No production code changes.

#### Subtask 1.1: Update redirect assertion in `home.test.ts`

- **File to modify**: `app/routes/home.test.ts`
- **Location**: The test "redirects to /furigana/\<uuid\>?storage=in-memory on successful generation"
- **Changes**:
  1. Rename the test description to "redirects to /furigana/\<uuid\> on successful generation".
  2. Change the `expect` on `result.headers.get("Location")` to assert `/furigana/${testUuid}` (no query param).

**Before**:

```typescript
it("redirects to /furigana/<uuid>?storage=in-memory on successful generation", async () => {
  // ...
  expect(result.headers.get("Location")).toBe(`/furigana/${testUuid}?storage=in-memory`);
  // ...
});
```

**After**:

```typescript
it("redirects to /furigana/<uuid> on successful generation", async () => {
  // ...
  expect(result.headers.get("Location")).toBe(`/furigana/${testUuid}`);
  // ...
});
```

- **Key consideration**: The production code in `home.tsx` already returns `redirect(`/furigana/${id}`)`. This is a test-to-code alignment fix, not a code change.
- **Acceptance criteria**: The previously failing test now passes. All other 9 action tests continue to pass.

---

### Phase 2: Verify Full Test Suite and Static Analysis

**Objective**: Confirm all 107 tests pass and static analysis reports no errors.

#### Subtask 2.1: Run unit tests

```bash
pnpm test --run
```

Expected output: 0 failed, 107 passed.

#### Subtask 2.2: Run type check

```bash
pnpm type-check
```

Expected output: zero TypeScript errors.

#### Subtask 2.3: Run lint

```bash
pnpm exec eslint .
```

Expected output: zero errors or warnings in modified files.

---

## Third-Party Integration Research

### React Router v7 — `useNavigation()` for Loading States

- **Official docs**: https://reactrouter.com/api/hooks/useNavigation
- **Key properties used in this task**:

| Property                | Type                                  | When set                                        |
| ----------------------- | ------------------------------------- | ----------------------------------------------- |
| `navigation.state`      | `"idle" \| "loading" \| "submitting"` | Always present                                  |
| `navigation.formMethod` | `string \| undefined`                 | Set during form submissions                     |
| `navigation.location`   | `Location \| undefined`               | Set during pending navigation (loaders running) |

- **State semantics for this route**:
  - `"submitting"` — the `<Form method="post">` has been sent and the action is running server-side.
  - `"loading"` — the action has returned a redirect and the destination route's loaders are now running before the page transitions.
  - `"idle"` — nothing in flight.
- **Pattern in use** (`home.tsx`): `navigation.state === "submitting" && navigation.formMethod === "POST"` narrowed to `isSubmitting`. This correctly covers only the action phase. The `"loading"` phase after the redirect is not shown as a spinner on the home route because the home route unmounts when the redirect completes — no additional handling needed.
- **SSR note**: On SSR initial render, `useNavigation()` always returns `{ state: "idle" }`. No server/client mismatch can occur.
- **Security advisories**: None found.
- **Recent changes**: No breaking changes to `useNavigation` in React Router v7.x as of 2026-03.

### React Router v7 — `useActionData()` for Error Display

- **Official docs**: https://reactrouter.com/api/hooks/useActionData
- **Return value semantics**:
  - Returns `undefined` on initial page load (no POST yet) and after a successful redirect (because the action returned a `Response`, not data).
  - Returns the typed action data object when the action returned a plain object (i.e., a validation error).
- **Pattern in use** (`home.tsx`): `useActionData<ActionData>()` returns `ActionData | undefined`. The component guards with `actionData !== undefined && "error" in actionData` before rendering the error message. This is type-safe and handles the `undefined` initial state without an `as` cast.
- **Why the successful redirect clears action data**: When the action returns `redirect(...)`, React Router navigates to the new route. The home route is no longer the active route, so `useActionData()` in its next render (after a user navigates back) returns `undefined`. This is the correct and expected behavior.
- **Return type**: `SerializeFrom<T> | undefined`. For server actions, all returned values are JSON-serialized. The `ActionData` type in this project (`{ error: string; originalText: string }`) is fully serialization-safe.
- **Security advisories**: None found.

### React Router v7 — Index Route vs Named Route (Conditional Rendering via Routing)

- **Official docs**: https://reactrouter.com/start/framework/routing
- **Pattern in use** (`app/routes.ts`):

```typescript
index("routes/home.tsx"); // renders at /
route("furigana/:id", "routes/furigana.$id.tsx"); // renders at /furigana/:id
```

- **Why this is conditional rendering**: The "condition" — whether to show the form or the reading view — is resolved by the router at the URL level, not by runtime `if/else` inside a single component. When the action redirects to `/furigana/<uuid>`, the router unmounts `home.tsx` and mounts `furigana.$id.tsx`. This is the canonical React Router approach for distinct UI states that have their own URLs.
- **Index route behavior**: An index route renders at exactly its parent's URL. Here `home.tsx` is an index of `root.tsx` at `/`. It has no children and cannot nest other routes.
- **SSR note**: Both routes are SSR-rendered on first load. The index route runs no loader (none defined). The furigana route runs `loader()` server-side and hydrates on the client.
- **Security advisories**: None found.

---

## Code Patterns

### Pattern 1: Loading State Detection in a Form Route

```typescript
// app/routes/home.tsx
const navigation = useNavigation();
const isSubmitting = navigation.state === "submitting" && navigation.formMethod === "POST";
```

**Where to apply**: Any route component that wraps a `<Form method="post">` and needs to show pending UI during the action.

**Why this pattern**: Checking both `state === "submitting"` AND `formMethod === "POST"` prevents false positives. `navigation.state` can be `"submitting"` for GET-method form searches too. Narrowing to `"POST"` ensures the spinner appears only for mutation actions.

**Loading vs submitting distinction**: `"submitting"` covers the action phase. `"loading"` covers the redirect-and-loader phase. For a redirect-on-success pattern (this route), only `"submitting"` is relevant for the home form — the route unmounts before `"loading"` becomes significant.

### Pattern 2: Action Error Display via `useActionData`

```typescript
// app/routes/home.tsx
type ActionError = {
  error: string;
  originalText: string;
};

type ActionData = ActionError;

export async function action({ request }: Route.ActionArgs): Promise<ActionData | Response> {
  // ...validation failure:
  return { error, originalText: sanitized };

  // ...success:
  return redirect(`/furigana/${id}`);
}

export default function Home() {
  const actionData = useActionData<ActionData>();

  const errorMessage =
    actionData !== undefined && "error" in actionData
      ? actionData.error
      : undefined;
  // ...
  {errorMessage !== undefined && (
    <p role="alert" className="text-destructive text-sm">
      {errorMessage}
    </p>
  )}
}
```

**Where to apply**: Any route with an action that returns either an error object or a redirect response.

**Why this pattern**:

- The action return type is `ActionData | Response`. When the action redirects, React Router navigates away and the home component never sees the redirect as data. When validation fails, the action returns a plain object and the component stays mounted.
- `useActionData<ActionData>()` returns `undefined` before any submission — so the `!== undefined` guard prevents the error UI from rendering on initial load.
- The `"error" in actionData` discriminator is defensive: if a future action success path returns a non-Response value, this guard prevents a type-unsafe access.
- No `as` cast is needed because `"error" in actionData` narrows `ActionData` to `ActionError` at the TypeScript level.

### Pattern 3: Preserving Form Text After a Server Error

```typescript
// app/routes/home.tsx
const actionOriginalText =
  actionData !== undefined && "originalText" in actionData ? actionData.originalText : "";

const [text, setText] = useState<string>(actionOriginalText);

useEffect(() => {
  setText(actionOriginalText);
}, [actionOriginalText]);
```

**Where to apply**: Any form where the server returns the user's input alongside an error so the textarea can be repopulated.

**Why `useEffect` is appropriate here**: `useState` initializer runs only once (on mount). Without the effect, `text` would stay at `""` across re-renders triggered by a second failed submission. The effect dependency on `actionOriginalText` updates `text` each time the action returns a new error with the submitted text. This is one of the legitimate `useEffect` use cases acknowledged by the React team — syncing a component-internal state value from a prop/hook value that changes in response to a network event.

### Pattern 4: Conditional Rendering via Route Architecture

```typescript
// app/routes.ts
export default [
  index("routes/home.tsx"), // / — form input
  route("furigana/:id", "routes/furigana.$id.tsx"), // /furigana/:id — reading view
] satisfies RouteConfig;
```

**Where to apply**: When two UI states are distinct enough to deserve separate URLs.

**Why this pattern over `useActionData` success-branch rendering**:

- The URL is the application state. The reading view URL is shareable and bookmarkable.
- The home route stays stateless — it never needs to know about the reading view's data.
- `home.tsx` exports only one code path: the form. No success/error branching in the component body.
- React Router handles the transition: on redirect, the home route unmounts and the reading route mounts. The router is the "conditional" — no runtime `if/else` required.

---

## Test Cases

### Unit Tests

#### Test Suite: `home.test.ts` (action)

**Test 1 — Redirect URL** (currently failing, fixed by Subtask 1.1)

- **Given**: Valid Japanese text submitted via POST, `generateFurigana` resolves with tokens, `crypto.randomUUID()` returns a known UUID
- **When**: The action processes the request
- **Then**: Response status is `302`, `Location` header is `/furigana/<test-uuid>` (no query param), `mockSetTokens` was called with the UUID and tokens
- **Coverage**: Detects any regression where the redirect URL is malformed or gains unexpected query params

**Tests 2–10** (existing, passing): Empty text, over-limit text, non-Japanese input, service throws, missing text field, non-string file field, sanitization, whitespace trimming, and validation error on service failure — all continue to pass unchanged.

#### Test Suite: `furigana.$id.test.ts` (loader)

**Test 1 — Returns tokens from store** (existing, passing)

- **Given**: `mockConsumeTokens` returns a non-null token array
- **When**: Loader is called with a valid id
- **Then**: `result.data` equals `{ tokens: <returned array> }`; `mockConsumeTokens` called with the id
- **Coverage**: Confirms the happy path — token retrieval and data shape

**Test 2 — Empty tokens on store miss** (existing, passing)

- **Given**: `mockConsumeTokens` returns `null`
- **When**: Loader is called
- **Then**: `result.data` equals `{ tokens: [] }`; `mockConsumeTokens` still called (store miss does not crash)
- **Coverage**: Confirms the `?? []` null coalescion works and the loader handles a single-use token correctly

**Test 3 — Always uses params.id** (existing, passing)

- **Given**: `mockConsumeTokens` returns `null`
- **When**: Loader is called with any id
- **Then**: `mockConsumeTokens` was called exactly once with that id
- **Coverage**: Confirms the loader does not skip `consumeTokens` — e.g., no short-circuit on a missing storage param or other condition

#### Test Suite: `home.test.tsx` (component)

**Test: shows loading label and spinner while submitting** (existing, passing)

- **Given**: `mockUseNavigation` returns `{ state: "submitting", formMethod: "POST" }`
- **When**: Component renders
- **Then**: Submit button text contains "Generating…"; `role="status"` element is present
- **Coverage**: Confirms `isSubmitting` logic gates the spinner correctly based on both `state` and `formMethod`

**Test: renders error alert and restores text** (existing, passing)

- **Given**: `mockUseActionData` returns `{ error: "Something went wrong", originalText: "日本語" }`
- **When**: Component renders
- **Then**: `role="alert"` element contains the error message; textarea value is "日本語"
- **Coverage**: Confirms `useActionData` error display and `originalText` restoration via `useEffect`

**Test: disables submit button when action data contains over-limit text** (existing, passing)

- **Given**: `mockUseActionData` returns `{ error: "Text exceeds limit.", originalText: "あ".repeat(MAX_INPUT_LENGTH + 1) }`
- **When**: Component renders
- **Then**: Submit button is disabled
- **Coverage**: Confirms that restored over-limit text triggers the `isOverLimit` guard, preventing re-submission of invalid input

**Tests 1–8** (all existing, all passing): All 8 component tests pass unchanged.

#### Test Suite: `furigana.$id.test.tsx` (component)

All 8 existing tests pass unchanged. The reading view component has no dependency on loading state or action data — it only consumes `useLoaderData()`. No new component tests are required.

### Integration Tests

React Router v7 SSR does not provide an out-of-the-box integration test harness for the action → redirect → loader chain in framework mode. The action and loader are tested independently at the unit level. The full end-to-end round-trip (form submission → redirect → reading view render) is covered by Playwright E2E tests in Task 15.

### E2E Tests (Task 15 scope)

These scenarios are defined here for completeness; implementation belongs to Task 15.

**Scenario 1 — Happy path**

- **Given**: User opens the app at `/`
- **When**: User pastes "東京に行きました" into the textarea and clicks "Generate Furigana"
- **Then**: URL transitions to `/furigana/<uuid>`; reading view renders `<ruby>` elements with furigana above kanji; form and textarea are no longer visible

**Scenario 2 — Loading state visible during generation**

- **Given**: Network response from the OpenAI API is deliberately delayed
- **When**: User submits valid Japanese text
- **Then**: Submit button shows "Generating…" with a spinner; textarea is disabled; button is disabled
- **Coverage**: Confirms `navigation.state === "submitting"` triggers pending UI

**Scenario 3 — Error path**

- **Given**: Network request to the OpenAI API is intercepted and rejected
- **When**: User submits valid Japanese text
- **Then**: Loading state clears; error message appears below the textarea with `role="alert"`; textarea content is preserved and re-enabled; URL stays at `/`

**Scenario 4 — Character limit**

- **Given**: User pastes 10,001 characters into the textarea
- **When**: Page updates
- **Then**: Counter shows danger styling; submit button is disabled; Cmd+Enter has no effect

**Scenario 5 — Non-Japanese input validation**

- **Given**: User types "Hello world" (no kanji or hiragana)
- **When**: User submits the form
- **Then**: Server returns the non-Japanese validation error; error is displayed with `role="alert"`; input is preserved; URL stays at `/`

---

## Implementation Checklist

- [ ] 1.1 — Update failing test in `home.test.ts`: rename description and change `Location` assertion to `/furigana/${testUuid}` (no query param)
- [ ] 2.1 — `pnpm test --run` passes: 0 failed, 107 passed
- [ ] 2.2 — `pnpm type-check` passes: zero errors
- [ ] 2.3 — `pnpm exec eslint .` passes: zero errors

---

## Notes and Considerations

### Why a Dedicated Reading Route Instead of Conditional Rendering on Home

The PRD originally described conditional rendering within `home.tsx` — swapping `InputArea` for `ReadingView` based on `useActionData()`. The codebase made a different and superior architectural call: on success, redirect the user to `/furigana/:id`. This has several advantages:

1. The URL is the UI state. A distinct URL for the reading view is consistent with React Router's route-per-screen model.
2. The home route stays clean — it is always and only a form. No `useActionData` success-branch branching needed.
3. The reading view is a distinct, bookmarkable UI state.
4. M2 makes the reading URL durable simply by changing the storage backend — the routing, component, and URL structure do not change.

This plan treats the separate route as the authoritative architectural decision.

### `useNavigation` State Timeline for This Route

Understanding which navigation state appears when is important for knowing why the pending UI is scoped correctly:

```
User submits form
  → navigation.state = "submitting"    (action is running, home.tsx is still mounted)
  → action returns redirect(...)
  → navigation.state = "loading"       (furigana.$id loader is running, home.tsx is still mounted)
  → loader completes
  → navigation.state = "idle"          (home.tsx unmounts, furigana.$id.tsx mounts and renders)
```

The `isSubmitting` check in `home.tsx` gates the spinner on `state === "submitting"`. The `"loading"` phase is brief and the home route is transitioning away — it is acceptable (and simpler) not to extend the spinner into the loading phase, but the current implementation would show the spinner through `"loading"` if `isSubmitting` were changed to `navigation.state !== "idle"`. The current narrower check is the correct one.

### Single-Use Token and Empty Reading View on Refresh

The `consumeTokens` function deletes the token from the store on first read. A page refresh on `/furigana/<uuid>` triggers the loader again, `consumeTokens` returns `null`, and the reading view renders an empty `<article>`. This is intentional and acceptable for M1. The empty view does not crash and satisfies the "must not crash" requirement from the PRD's edge case table. M2 will resolve this by persisting tokens in TursoDB.

### The `useEffect` Pattern in `home.tsx`

The `useEffect` that syncs `actionOriginalText` into `text` state is intentional and correct. It handles the case where the component does not remount between form submissions — `useState` initializer runs only once, so the effect is required to update the textarea after a server error returns a new `originalText`. This pattern is benign given that `actionOriginalText` only changes after a server round-trip. This is one of the documented legitimate uses of `useEffect`: syncing local state from a value that changes in response to a network event rather than a user interaction or timer.
