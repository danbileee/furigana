# Task 12: Create ReadingView Component

**Project**: Furigana MVP
**Generated**: 2026-03-21
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

## Overview

Implement the reading view rendering layer as a dedicated `/furigana/:id` dynamic route rather than an in-page component. The implementation touches three areas:

1. **`app/routes/home.tsx` action** — After successful furigana generation, issue a `redirect` to `/furigana/<uuid>?storage=in-memory` and store the `FuriganaToken[]` array in a server-side in-memory token store. The home action stores the generated tokens under a UUID key, embeds only that UUID as the dynamic route segment, and appends `?storage=in-memory` to signal the loader to use in-memory lookup.

2. **`app/routes/furigana.$id.tsx` route** — New dynamic route that reads the UUID from `params.id` and applies **conditional token loading** based on the URL search parameter:
   - **`?storage=in-memory` present**: Resolves the token array from the in-memory store (`app/services/token-storage.service.ts`). This is the Task 12 scope.
   - **No search param** (e.g., `/furigana/<uuid>`): Will fetch tokens from TursoDB by ID. This is **future milestone 2 work** — not implemented here. Returns an empty array as a placeholder.

   The route renders the ruby annotation UI (semantic `<ruby>` / `<rp>` / `<rt>` elements, `lang="ja"`, Tailwind v4 styles). This absorbs all responsibilities previously assigned to `app/components/furigana/ReadingView.tsx`.

3. **`app/components/furigana/` directory** — The existing `ReadingView.tsx` scaffold is removed entirely. The `/furigana/:id` route becomes the single owner of the reading UI. No standalone component remains.

**Scope boundary**: This task implements the `?storage=in-memory` code path — the loader reads from the in-memory store when the search parameter is present. The no-param code path (direct UUID lookup from TursoDB) is **not implemented here** — it is deferred to milestone 2 when TursoDB persistence is added. See the TODO note in Subtask 2.2.

---

## Requirements Analysis

### Functional Requirements

- `home.tsx` action must redirect to `/furigana/<uuid>?storage=in-memory` on success, storing the `FuriganaToken[]` in a server-side in-memory map under the UUID key.
- `app/routes/furigana.$id.tsx` must expose a `loader` that reads `params.id` and the `storage` search parameter, then conditionally resolves tokens:
  - When `storage === "in-memory"`: look up from `app/services/token-storage.service.ts`.
  - When `storage` is absent: **future TursoDB fetch** (return empty array as placeholder for now).
- The furigana route component must render `TextToken` values as `<span>` elements and `RubyToken` values as `<ruby>kanji<rp>(</rp><rt>yomi</rt><rp>)</rp></ruby>`.
- The route must not throw or crash on an empty token array or a missing/expired UUID.
- Pure hiragana / romaji inputs produce only `TextToken` entries; the route renders them as plain `<span>` elements without any `<ruby>` wrapper.
- Each rendered element must carry a stable, unique `key`.
- `app/routes.ts` must register the new `/furigana/:id` dynamic route.
- `app/components/furigana/ReadingView.tsx` must be deleted.
- `home.tsx` must remove the `ReadingView` import and the `showReadingView` rendering branch.

### Non-Functional Requirements

- **Accessibility**: The `<article>` container must include `lang="ja"` so screen readers switch to a Japanese TTS voice (WCAG 3.1.2 Language of Parts). Each `<ruby>` must include `<rp>` fallback parentheses (WCAG H62).
- **Type safety**: No `any` types or `as` casts. `FuriganaToken` discriminated union must be narrowed with `token.type === "ruby"` (idiomatic) or the exported `isRubyToken` / `isTextToken` guards. Route loader return type must be declared explicitly.
- **Tailwind v4**: All layout and visual styling via Tailwind v4 utility classes. `ruby-position` and `font-size` for `<rt>` require a `@layer base` block in `app/app.css` (no Tailwind equivalent).
- **Performance**: The furigana route component is pure and stateless — no hooks, no side effects.
- **SSR-safe**: No browser-only APIs. The route is rendered on the server via React Router's SSR mode (`ssr: true` in `react-router.config.ts`).

### Dependencies & Constraints

- **Task 5 (done)**: `FuriganaToken`, `RubyToken`, `TextToken`, `isRubyToken`, `isTextToken` exported from `~/schema/furigana.schema`. The reading field on `RubyToken` is `yomi`.
- **Storage constraint**: `MAX_INPUT_LENGTH` is 10,000 characters. A worst-case 10,000-character input produces a serialized token array of approximately 469 KB (all ruby tokens). A realistic mixed input yields ~350 KB. Both are 80–117x larger than the 4 KB browser cookie limit, making cookie-based flash completely unsuitable for this input size.
- **Chosen data-passing strategy**: Server-side in-memory token store (a `Map<string, FuriganaToken[]>` in `app/services/token-storage.service.ts`). The action stores tokens and redirects with a UUID path segment and `?storage=in-memory`; the loader reads and immediately deletes the entry when that param is present.
- `home.test.tsx` mocks `ReadingView` — that mock must be removed once the component is deleted.
- `home.test.ts` tests the action function — the action tests must be updated to assert a redirect response with a `/furigana/<uuid>?storage=in-memory` `Location` header.
- Tests live in `app/routes/furigana.$id.test.tsx` (component) and `app/routes/furigana.$id.test.ts` (loader) following the established patterns.

---

## Codebase Observations

| Observation | Impact on plan |
|---|---|
| `home.tsx` currently returns `{ tokens }` from `action` and renders `<ReadingView>` inside the component branch `if (showReadingView)`. | Both the return value and the rendering branch must change. |
| `app/routes/api/health.ts` uses `data({ ... }, { status: ... })` from `react-router`. | This is the established pattern for returning typed responses from loaders/actions. |
| React Router v7 `redirect()` returns a `Response` with `Location` header — it cannot carry a body accessible to the destination loader without a session or URL param. | The implementation plan uses a server-side in-memory store; the UUID key is passed via the dynamic route segment and `?storage=in-memory` signals which lookup path to use. |
| `routes.ts` uses `index()` + `route()` from `@react-router/dev/routes`. Adding `/furigana/:id` follows the `route("furigana/:id", "routes/furigana.$id.tsx")` pattern. | Straightforward addition. |
| `home.test.tsx` mocks `~/components/furigana/ReadingView` explicitly. | Mock must be removed and the test for the `showReadingView` branch must be updated to reflect that the home component no longer renders inline tokens. |
| `home.test.ts` imports `action` from `./home` and asserts `result` shape as `{ tokens }`. | Action tests must be updated to check for a redirect `Response` with a `/furigana/<uuid>?storage=in-memory` `Location` header. |
| `vitest.config.ts` sets `environment: "node"` globally. Component tests opt in via `// @vitest-environment jsdom`. | New `furigana.$id.test.tsx` needs the jsdom pragma. |
| `RubyTokenSchema` uses `yomi` field. Scaffold already uses `token.yomi`. | Keep `yomi` everywhere. No rename needed. |
| `MAX_INPUT_LENGTH = 10_000` in `app/constants/input.const.ts`. | Worst-case serialized token array is ~469 KB — 117x over the 4 KB cookie limit. Cookie flash is ruled out. |

---

## Implementation Plan

### Phase 1: Update `home.tsx` Action to Redirect

**Objective**: Change the action's success path from returning `{ tokens }` to issuing a redirect to `/furigana/<uuid>?storage=in-memory`, storing the token array in a server-side in-memory store.

#### Subtask 1.1: Create the server-side in-memory token store

Create `app/services/token-storage.service.ts`. This module exports a singleton `Map` that stores `FuriganaToken[]` keyed by a random UUID. The action writes to it; the furigana loader reads and immediately deletes the entry (one-time read, equivalent to flash behavior) when the `?storage=in-memory` param is present.

```ts
// app/services/token-storage.service.ts
import type { FuriganaToken } from "~/schema/furigana.schema";

/**
 * Server-side in-memory store for transient token arrays.
 *
 * Lifecycle: written by home action, read-once and deleted by furigana loader
 * when the `?storage=in-memory` search parameter is present.
 *
 * Suitable for single-server deployments. For distributed/edge deployments,
 * replace with a shared cache (Redis, TursoDB ephemeral table, etc.).
 *
 * Note: entries are bounded by MAX_INPUT_LENGTH (10,000 chars), producing
 * at most ~470 KB per entry. The store is cleared on each server restart.
 */
const tokenStore = new Map<string, FuriganaToken[]>();

export function storeTokens(tokens: FuriganaToken[]): string {
  const id = crypto.randomUUID();
  tokenStore.set(id, tokens);
  return id;
}

export function consumeTokens(id: string): FuriganaToken[] | null {
  const tokens = tokenStore.get(id) ?? null;
  tokenStore.delete(id);
  return tokens;
}
```

- **Files to create**: `app/services/token-storage.service.ts`
- **Key considerations**:
  - The file lives in `app/services/` alongside other service modules. The `.ts` extension (not `.server.ts`) is sufficient because this module is only imported from server-side code paths (the action and the loader). If you want the Vite server-only guard for additional safety, renaming to `.server.ts` is valid but not strictly required given the import chain.
  - `crypto.randomUUID()` is available in Node.js ≥ 19 natively. Node 22 (the project's minimum) supports it natively.
  - `consumeTokens` returns `null` when the entry is absent (not an empty array), allowing the loader to distinguish "never existed or already consumed" from "existed but was empty". `consumeTokens` deletes the entry on read, preventing memory leaks and ensuring stale tokens are not returned on back-navigation or repeated requests.
  - For a single-server Node.js deployment (Vite SSR), the `Map` survives between requests within the same process. This is the correct behaviour: the action request and the subsequent loader request are served by the same process.
  - This approach does not scale to distributed/edge deployments. A future migration to TursoDB or a Redis cache would replace `tokenStore` without changing the action/loader API.
- **Acceptance criteria**: Module exports `storeTokens` and `consumeTokens`. `pnpm type-check` passes with no errors on this file.

#### Subtask 1.2: Update `home.tsx` action success branch

Replace `return { tokens }` with a call to `storeTokens`, then `return redirect("/furigana/<uuid>?storage=in-memory")`.

```ts
// app/routes/home.tsx — action success branch (replaces `return { tokens }`)
import { redirect } from "react-router";
import { storeTokens } from "~/services/token-storage.service";

// Inside action():
const id = storeTokens(tokens);
return redirect(`/furigana/${id}?storage=in-memory`);
```

- **File to modify**: `app/routes/home.tsx`
- **Key considerations**:
  - `return redirect(...)` is idiomatic React Router v7 for actions. The UUID is embedded as a path segment and `?storage=in-memory` is appended as a search parameter. The search parameter tells the loader which code path to execute.
  - No `Set-Cookie` header is needed. The UUID is in the URL path and the storage mode is in the search parameter.
- **Acceptance criteria**: Submitting a valid Japanese paragraph from `/` triggers a redirect to `/furigana/<uuid>?storage=in-memory` with HTTP 302. `pnpm type-check` passes.

#### Subtask 1.3: Remove `ReadingView` from `home.tsx`

- **File to modify**: `app/routes/home.tsx`
- **Changes**:
  - Delete `import { ReadingView } from "~/components/furigana/ReadingView"`.
  - Delete the `ActionSuccess` type (tokens are no longer returned from the action).
  - Update `ActionData` to only `ActionError` (the action now either redirects or returns an error).
  - Remove `showReadingView` constant and the `if (showReadingView)` render branch.
  - Remove `actionData.tokens` reference.
- **Acceptance criteria**: `home.tsx` has no reference to `ReadingView`, `tokens`, or `ActionSuccess`. `pnpm type-check` passes.

#### Subtask 1.4: Delete `app/components/furigana/ReadingView.tsx`

- **File to delete**: `app/components/furigana/ReadingView.tsx`
- **Note**: If this leaves `app/components/furigana/` empty, remove the directory too.
- **Acceptance criteria**: The file no longer exists. No other files import from `~/components/furigana/ReadingView`.

---

### Phase 2: Create `/furigana/:id` Dynamic Route

**Objective**: Add the `furigana/:id` dynamic route to the app with a loader that conditionally reads tokens based on the `?storage` search parameter, and a component that renders the ruby annotation UI.

#### Subtask 2.1: Register the route in `app/routes.ts`

- **File to modify**: `app/routes.ts`
- **Change**:

  ```ts
  import { type RouteConfig, index, route } from "@react-router/dev/routes";

  export default [
    index("routes/home.tsx"),
    route("furigana/:id", "routes/furigana.$id.tsx"),
    route("api/health", "routes/api/health.ts"),
  ] satisfies RouteConfig;
  ```

- **Key considerations**:
  - React Router v7 uses `:id` in the route path string but `.` as the separator in the file name convention (`furigana.$id.tsx`). Both forms are correct and required: the path controls URL matching, the filename controls typegen output.
- **Acceptance criteria**: React Router typegen generates `app/routes/+types/furigana.$id.ts` with `Route.LoaderArgs` (including `params.id: string`) and `Route.ComponentProps` types after `pnpm type-check`.

#### Subtask 2.2: Create `app/routes/furigana.$id.tsx`

- **File to create**: `app/routes/furigana.$id.tsx`
- **Code pattern**: See Code Patterns section (Pattern 1).
- **Conditional token loading** (based on the `storage` search parameter):
  1. **`?storage=in-memory` (Task 12 — implemented)**: Look up `params.id` in the in-memory token store via `consumeTokens` from `app/services/token-storage.service.ts`. If found, return tokens to the component. If not found (store miss), return an empty array.
  2. **No search param, e.g., `/furigana/<uuid>` (future milestone 2 — TODO)**: Fetch tokens from TursoDB by `params.id`. This path enables permanent deeplinks and back-navigation after server restarts. **Not implemented in Task 12**. Return an empty array as a placeholder.

  The conditional logic in the loader makes this explicit:

  ```ts
  const storage = new URL(request.url).searchParams.get("storage");

  if (storage === "in-memory") {
    // Task 12 scope: resolve from in-memory store
    const tokens = consumeTokens(params.id);
    return data({ tokens: tokens ?? [] });
  }

  // TODO(milestone-2): storage param absent — fetch tokens from TursoDB by params.id.
  // This enables deeplinks and back-navigation after server restarts.
  return data({ tokens: [] });
  ```

- **Key considerations**:
  - `params.id` is typed as `string` by React Router typegen for a `:id` segment. No URL parsing needed.
  - `request.url` is always present in `LoaderArgs` — safe to pass to `new URL(...)` without a try/catch on the server.
  - `lang="ja"` is on `<article>`, not `<html>` — the root language is set at the `<html>` level in `root.tsx` if needed; `lang="ja"` on the article correctly scopes the language switch.
  - `<rp>` elements carry no Tailwind classes — they are unstyled and only appear in non-ruby-aware environments.
  - When `consumeTokens` returns `null` (expired UUID or direct navigation with `?storage=in-memory`), the component renders an empty article. No redirect back to home, no crash. This is intentional: the route is stable at its URL so the user can share or bookmark it once TursoDB integration is complete.
- **Acceptance criteria**: Navigating to `/furigana/<uuid>?storage=in-memory` after a successful generation renders the annotated text. Direct navigation to `/furigana/some-nonexistent-id` (no search param) renders an empty article without error. Direct navigation to `/furigana/some-nonexistent-id?storage=in-memory` also renders an empty article without error.

#### Subtask 2.3: Add ruby typography styles to `app/app.css`

- **File to modify**: `app/app.css`
- **Change**: Add `rt` sizing and positioning inside the existing `@layer base` block.

  ```css
  @layer base {
    rt {
      font-size: 0.5em;
      ruby-position: over;
    }
  }
  ```

- **Key consideration**: `font-size: 0.5em` makes furigana proportional to kanji at `text-xl` (1.25rem). `ruby-position: over` is the CSS3 default but must be explicit for cross-browser consistency. Do not set `ruby-align` — browser defaults are correct for Japanese.
- **Acceptance criteria**: Visual check shows furigana above kanji at approximately half the base text size.

---

### Phase 3: Update Tests

**Objective**: Align all tests with the new dynamic-route architecture and the conditional search-parameter loading pattern.

#### Subtask 3.1: Update `home.test.ts` (action tests)

- **File to modify**: `app/routes/home.test.ts`
- **Changes**:
  - The `action` function now returns a `Response` (redirect) on success, not `{ tokens }`. Update the mock setup to account for the token store.
  - Mock `~/services/token-storage.service` to capture what tokens were stored and what UUID was returned.
  - The success test should assert that `result` is a `Response` instance with `status: 302` and `Location` header equal to `/furigana/test-uuid-1234?storage=in-memory`.
  - Error path tests remain structurally the same (action still returns `ActionError` directly on validation/generation failure).
- **Code pattern**: See Code Patterns section (Pattern 3).

#### Subtask 3.2: Update `home.test.tsx` (component tests)

- **File to modify**: `app/routes/home.test.tsx`
- **Changes**:
  - Remove `vi.mock("~/components/furigana/ReadingView", ...)` — the component no longer exists.
  - Remove the test `"renders ReadingView when action succeeds"` — this path no longer exists in `home.tsx`.
  - The action success case now redirects; the home component no longer needs to handle a tokens branch. All existing component tests that test error states, loading states, and form interactions remain valid.
  - Update the `ActionData` type at the top of the test file to only `ActionError` (no `ActionSuccess` variant).
- **Acceptance criteria**: All remaining tests pass. No references to `ReadingView` in `home.test.tsx`.

#### Subtask 3.3: Create `app/routes/furigana.$id.test.tsx` (component tests)

- **File to create**: `app/routes/furigana.$id.test.tsx`
- **Pattern**: `// @vitest-environment jsdom`, same structure as `home.test.tsx`.
- **What to mock**: The `loader` is not called in component tests — mock `useLoaderData` from `react-router` to return controlled token arrays.
- **Coverage areas**: ruby token rendering, text token rendering, mixed token arrays, empty array, `lang="ja"` attribute, `<rp>` elements, unique keys (no React warnings on repeated kanji).
- See Test Cases section below for the full list.

#### Subtask 3.4: Create `app/routes/furigana.$id.test.ts` (loader tests)

- **File to create**: `app/routes/furigana.$id.test.ts`
- **Pattern**: Node environment (no pragma needed), same structure as `home.test.ts`.
- **What to test**: The `loader` function — mock `~/services/token-storage.service` and assert the returned `data` shape. Test all conditional branches:
  - `?storage=in-memory` with a valid UUID (store hit — tokens returned).
  - `?storage=in-memory` with an absent UUID (store miss — empty array returned).
  - No search param (future TursoDB path — empty array placeholder returned).
- See Test Cases section below for the full list.

---

### Phase 4: Verification

**Objective**: Confirm end-to-end rendering works in the browser and all checks pass.

#### Subtask 4.1: Visual smoke test

- **Action**: `pnpm dev`, submit a Japanese paragraph, verify redirect to `/furigana/<uuid>?storage=in-memory` and furigana rendering.
- **Checklist**:
  - [ ] Browser navigates from `/` to `/furigana/<uuid>?storage=in-memory` after form submit.
  - [ ] Furigana (yomi) renders above kanji characters.
  - [ ] Pure-hiragana text renders as plain spans without ruby elements.
  - [ ] `<article lang="ja">` visible in DevTools Elements panel.
  - [ ] `<rp>` elements present but visually invisible.
  - [ ] No console errors.
  - [ ] Direct navigation to `/furigana/nonexistent-id` (no param) renders empty article, no crash.
  - [ ] Direct navigation to `/furigana/nonexistent-id?storage=in-memory` renders empty article, no crash.

#### Subtask 4.2: Run the full test suite

- **Command**: `pnpm test`
- **Acceptance criteria**: All tests pass. No regressions in `home.test.ts` or `home.test.tsx`.

#### Subtask 4.3: Type-check and lint

- **Commands**: `pnpm type-check && pnpm exec eslint .`
- **Acceptance criteria**: Zero errors, zero warnings.

---

## Third-Party Integration Research

### React Router v7 — Dynamic Routes and Data-Passing Strategies

- **Official docs**: [reactrouter.com](https://reactrouter.com) (v7 framework mode)
- **Dynamic route params**: React Router v7 exposes route parameters via `params` in `LoaderArgs`. For a route registered as `"furigana/:id"`, the typegen produces `params.id: string`. The file name convention uses `.` as segment separator (`furigana.$id.tsx`).
- **Search params in loaders**: The `request` object in `LoaderArgs` is a standard Fetch API `Request`. `new URL(request.url).searchParams.get("storage")` is the idiomatic way to read search parameters server-side — no special React Router API is needed.
- **Redirect + data passing**: React Router v7 does not carry a response body through `redirect()`. The standard patterns for passing transient data across a redirect are: (1) cookie session flash, (2) URL params, or (3) a server-side in-memory/persistent store with a key passed via the URL.
- **`createCookieSessionStorage`**: Available in the installed version. Cookie-based flash is the most common pattern in examples but is bounded by the 4 KB browser cookie limit.
- **`createMemorySessionStorage`**: Also confirmed available in the installed version. Stores session data in a server-side `Map`. No inherent size limit. Development-only per Remix/React Router docs because the store is lost on server restart and does not scale across multiple server instances. It is equivalent to the custom `Map`-based approach described in this plan.
- **Security advisories**: None found.
- **Performance notes**: In-memory store lookups are O(1). For single-server Node.js deployments (this project's target), the store is always in the same process. No network round-trip. Search parameter parsing via `new URL(...)` is synchronous and negligible cost.

> No blocking issues found for the in-memory store approach on a single-server deployment.

---

### Browser Cookie Storage — Size Limits

- **RFC 6265 requirement**: Browsers must support at least 4,096 bytes per cookie (name + value + attributes combined).
- **Browser behaviour on overflow**: The browser silently drops or truncates cookies that exceed its limit. There is no error thrown to the server.
- **Project-specific analysis**:
  - `MAX_INPUT_LENGTH = 10_000` characters (confirmed in `app/constants/input.const.ts`).
  - Worst case: 10,000 single-kanji ruby tokens serialize to approximately **469 KB**.
  - Realistic mixed input (30% kanji): approximately **350 KB**.
  - Both are **80–117x larger than the 4 KB cookie limit**.

> ⚠️ **Needs Review**: Cookie session flash is incompatible with this project's `MAX_INPUT_LENGTH`. A 10,000-character input produces a token array of 350–469 KB serialized, which is 80–117x the 4 KB cookie limit. Browsers will silently truncate or drop the cookie, causing the furigana loader to receive an empty token array even on a successful generation. **Cookie-based flash must not be used for this task.** The plan uses a server-side in-memory store instead.

---

### Web Storage API — localStorage

- **Official docs**: [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- **Storage limit**: 5 MB per origin (all major browsers enforce this limit). Data persists across sessions until explicitly cleared.
- **SSR incompatibility**: React Router v7 uses `ssr: true`. The furigana loader runs on the server, where `localStorage` is undefined. Accessing it in a loader would throw a ReferenceError. It could only be used in a `clientLoader` — but this forces client-only rendering of the furigana route, losing SSR benefits.
- **Verdict**: Unsuitable as the primary data-passing mechanism. The server-side in-memory store is a cleaner solution.

---

### IndexedDB

- **Official docs**: [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- **SSR incompatibility**: Same fundamental issue as localStorage — IndexedDB is a browser API and is not available in Node.js SSR loaders. It can only be used client-side.
- **Verdict**: Unsuitable for the same reason as localStorage. The server-side in-memory store is simpler, faster, and SSR-compatible.

---

### HTML `<ruby>` / `<rt>` / `<rp>` (Living Standard)

- **Official docs**: [MDN `<ruby>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ruby), [MDN `<rp>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/rp), [WCAG H62](https://www.w3.org/TR/WCAG20-TECHS/H62.html)
- **Browser support**: Baseline since 2015. All modern browsers support `<ruby>` + `<rt>`. `<rp>` is visually suppressed in browsers that render ruby layout.
- **Screen reader behaviour**: NVDA reads both base text and `<rt>` content. VoiceOver on macOS reads the base and may or may not announce `<rt>` depending on version. `<rp>` parentheses are not read aloud in supporting browsers.
- **Security advisories**: None.
- **Performance notes**: None.

> No blocking issues found.

---

### Tailwind CSS v4

- **Official docs**: [tailwindcss.com/docs](https://tailwindcss.com/docs) (v4 branch)
- **Ruby-specific gap**: Tailwind v4 does not expose `ruby-position` or `ruby-align` as utility classes. The workaround is a `@layer base` block in `app.css`, which is the established pattern in this codebase.
- **Security advisories**: None.
- **Performance notes**: None.

> No blocking issues found.

---

### @testing-library/react v16 + Vitest v4

- **Official docs**: [testing-library.com/docs/react-testing-library/intro](https://testing-library.com/docs/react-testing-library/intro/)
- **JSDOM environment**: The `// @vitest-environment jsdom` file-level pragma is required because the vitest config sets `environment: "node"` globally. Already used in `home.test.tsx`.
- **Mocking `useLoaderData`**: Mock `react-router` in `furigana.$id.test.tsx` to return controlled data from `useLoaderData`, the same way `home.test.tsx` mocks `useActionData`.
- **Security advisories**: None.
- **Performance notes**: None.

> No blocking issues found.

---

## Code Patterns

### Pattern 1: `furigana.$id.tsx` dynamic route with conditional loader and ruby rendering

```tsx
// app/routes/furigana.$id.tsx
import { data } from "react-router";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/furigana.$id";
import type { FuriganaToken } from "~/schema/furigana.schema";
import { consumeTokens } from "~/services/token-storage.service";

type LoaderData = {
  tokens: FuriganaToken[];
};

export async function loader({ params, request }: Route.LoaderArgs): Promise<LoaderData> {
  const storage = new URL(request.url).searchParams.get("storage");

  if (storage === "in-memory") {
    // Task 12 scope: look up tokens in the in-memory store by the UUID from the URL.
    // consumeTokens reads and deletes the entry — one-time read, like flash data.
    const tokens = consumeTokens(params.id);
    return data({ tokens: tokens ?? [] });
  }

  // TODO(milestone-2): storage param absent — fetch tokens from TursoDB by params.id.
  // This enables permanent deeplinks and back-navigation after server restarts.
  // Until that milestone is implemented, return an empty array.
  return data({ tokens: [] });
}

export default function Furigana() {
  const { tokens } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-8">
      <article
        lang="ja"
        className="border-border bg-card w-full rounded-lg border p-6 text-xl leading-relaxed"
      >
        {tokens.map((token, index) =>
          token.type === "ruby" ? (
            <ruby key={`${token.kanji}-${token.yomi}-${index}`}>
              {token.kanji}
              <rp>(</rp>
              <rt>{token.yomi}</rt>
              <rp>)</rp>
            </ruby>
          ) : (
            <span key={`${token.value}-${index}`}>{token.value}</span>
          ),
        )}
      </article>
    </main>
  );
}
```

**Where to apply**: `app/routes/furigana.$id.tsx` (new file).
**Why this pattern**: The `storage` search param drives a clean conditional branch — no fallback ambiguity, no silent empty-array returns that could mask missing tokens in the `?storage=in-memory` path. `consumeTokens` reads and deletes the entry in one operation, preventing stale tokens from appearing on back-navigation. Key collision is prevented by the index suffix on composite keys. The `TODO` comment marks the exact insertion point for milestone 2 TursoDB work.

---

### Pattern 2: Updated `home.tsx` action success branch

```ts
// app/routes/home.tsx — action success branch (replaces `return { tokens }`)
import { redirect } from "react-router";
import { storeTokens } from "~/services/token-storage.service";

// Inside action():
const id = storeTokens(tokens);
return redirect(`/furigana/${id}?storage=in-memory`);
```

**Where to apply**: The `try` block inside `action` in `app/routes/home.tsx`, replacing `return { tokens }`.
**Why this pattern**: React Router v7 actions return (or throw) a `Response` to trigger redirects. `storeTokens` returns a UUID that is safe to include in a URL path segment. The `?storage=in-memory` search parameter explicitly signals to the loader which lookup path to execute, separating the in-memory path from the future TursoDB path without ambiguity.

---

### Pattern 3: Mocking token store in `home.test.ts`

```ts
// app/routes/home.test.ts — add at the top with other vi.mock calls
const { mockStoreTokens } = vi.hoisted(() => ({
  mockStoreTokens: vi.fn<(tokens: FuriganaToken[]) => string>(),
}));

vi.mock("~/services/token-storage.service", () => ({
  storeTokens: mockStoreTokens,
}));

// In the success test:
it("redirects to /furigana/<uuid>?storage=in-memory on successful generation", async () => {
  const tokens: FuriganaToken[] = [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }];
  mockGenerateFurigana.mockResolvedValueOnce(tokens);
  mockStoreTokens.mockReturnValueOnce("test-uuid-1234");

  const result = await action(createActionArgs(createFormRequest("日本語")));

  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(302);
  expect((result as Response).headers.get("Location")).toBe("/furigana/test-uuid-1234?storage=in-memory");
  expect(mockStoreTokens).toHaveBeenCalledWith(tokens);
});
```

**Where to apply**: `app/routes/home.test.ts` — update the existing success test.
**Why this pattern**: Mocks `storeTokens` to avoid touching the real in-memory store in tests. The `Location` assertion uses `toBe` (exact match) rather than `toContain` to ensure both the path segment and the `?storage=in-memory` search param are present. Mock path matches the new file location `~/services/token-storage.service`.

---

### Pattern 4: `furigana.$id.test.tsx` with mocked `useLoaderData`

```tsx
// app/routes/furigana.$id.test.tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { FuriganaToken } from "~/schema/furigana.schema";

const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn<() => { tokens: FuriganaToken[] }>(),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mockUseLoaderData(),
}));

import Furigana from "./furigana.$id";

describe("furigana route component", () => {
  it("renders ruby tokens as <ruby> elements", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }],
    });
    const { container } = render(<Furigana />);
    const ruby = container.querySelector("ruby");
    expect(ruby).not.toBeNull();
    expect(ruby?.textContent).toContain("日本語");
  });
});
```

**Where to apply**: `app/routes/furigana.$id.test.tsx` (new file).
**Why this pattern**: Mirrors the `useActionData` mock pattern in `home.test.tsx`. The `vi.hoisted()` call ensures the mock factory runs before module evaluation so it is available when `vi.mock` runs.

---

### Pattern 5: Ruby typography in global CSS

```css
/* app/app.css — add inside the existing @layer base block */
@layer base {
  rt {
    font-size: 0.5em;
    ruby-position: over;
  }
}
```

**Where to apply**: Inside the existing `@layer base` block in `app/app.css`.
**Why this pattern**: Tailwind v4 has no `ruby-position` utility. Scoping to `@layer base` keeps the rule at the same specificity level as Tailwind's base reset.

---

## Test Cases

### Unit Tests — `furigana` Route Component (`furigana.$id.test.tsx`)

#### Test Suite: `furigana route component`

**Test 1**: Renders a single ruby token as a `<ruby>` element

- **Given**: `useLoaderData` returns `{ tokens: [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }] }`
- **When**: `render(<Furigana />)`
- **Then**: The DOM contains one `<ruby>` element. Its text content includes `"日本語"`. The `<rt>` inside it contains `"にほんご"`. Two `<rp>` elements are present with content `"("` and `")"`.
- **Coverage**: Detects regressions where ruby elements are replaced with plain spans or where `yomi` is dropped.

**Test 2**: Renders a single text token as a `<span>` without ruby

- **Given**: `useLoaderData` returns `{ tokens: [{ type: "text", value: "こんにちは" }] }`
- **When**: `render(<Furigana />)`
- **Then**: `screen.getByText("こんにちは")` returns a `<span>`. The DOM contains zero `<ruby>` elements.
- **Coverage**: Detects regressions where TextTokens are accidentally wrapped in ruby markup.

**Test 3**: Renders a mixed array in document order

- **Given**:
  ```ts
  { tokens: [
    { type: "text", value: "私は" },
    { type: "ruby", kanji: "東京", yomi: "とうきょう" },
    { type: "text", value: "に住んでいます。" },
  ] }
  ```
- **When**: `render(<Furigana />)`
- **Then**: The article contains two `<span>` elements and one `<ruby>` element in document order.
- **Coverage**: Detects ordering bugs or token-type mis-dispatch in the map callback.

**Test 4**: Renders an empty token array without crashing

- **Given**: `useLoaderData` returns `{ tokens: [] }`
- **When**: `render(<Furigana />)`
- **Then**: The `<article>` element is present. No `<ruby>` or `<span>` children exist inside it.
- **Coverage**: Detects crashes on empty input and guards against regressions when the route is accessed directly with an expired or nonexistent ID, or when the no-search-param (future TursoDB) path returns its empty placeholder.

**Test 5**: Pure hiragana renders no ruby elements

- **Given**: `{ tokens: [{ type: "text", value: "きょうはいいてんきです。" }] }`
- **When**: `render(<Furigana />)`
- **Then**: Zero `<ruby>` elements. One `<span>` with the full hiragana string.
- **Coverage**: Confirms the component does not add furigana where none was annotated.

**Test 6**: Repeated kanji with different yomi produce no React key warnings

- **Given**:
  ```ts
  { tokens: [
    { type: "ruby", kanji: "山", yomi: "やま" },
    { type: "ruby", kanji: "山", yomi: "さん" },
  ] }
  ```
- **When**: `render(<Furigana />)` with `console.error` spy active.
- **Then**: No React duplicate-key warnings emitted. Both `<ruby>` elements present.
- **Coverage**: Detects key collision that would cause React to silently drop or mis-render repeated tokens.

**Test 7**: Article element carries `lang="ja"` attribute

- **Given**: `{ tokens: [{ type: "text", value: "テスト" }] }`
- **When**: `render(<Furigana />)`
- **Then**: `container.querySelector("article")?.getAttribute("lang")` equals `"ja"`.
- **Coverage**: Guards against accidental removal of the accessibility attribute.

**Test 8**: `<rp>` fallback parentheses are present inside each `<ruby>`

- **Given**: `{ tokens: [{ type: "ruby", kanji: "漢字", yomi: "かんじ" }] }`
- **When**: `render(<Furigana />)`
- **Then**: `container.querySelectorAll("rp")` has length 2. First `<rp>` contains `"("`, second contains `")"`.
- **Coverage**: Ensures accessibility fallback is never silently removed.

---

### Unit Tests — `furigana` Route Loader (`furigana.$id.test.ts`)

#### Test Suite: `furigana loader`

**Test 1**: Returns tokens from the in-memory store when `?storage=in-memory` and a valid `id` are present

- **Given**: `mockConsumeTokens` returns `[{ type: "ruby", kanji: "日本語", yomi: "にほんご" }]` for `"test-uuid"`. Loader called with `params: { id: "test-uuid" }` and `request` URL `http://localhost/furigana/test-uuid?storage=in-memory`.
- **When**: `loader({ params: { id: "test-uuid" }, request: new Request("http://localhost/furigana/test-uuid?storage=in-memory") })`
- **Then**: `result.tokens` equals the token array. `mockConsumeTokens` was called with `"test-uuid"`.
- **Coverage**: Confirms the in-memory branch is entered when `?storage=in-memory` is present and tokens are returned from the store.

**Test 2**: Returns empty array when `?storage=in-memory` is present but the store entry is absent (null)

- **Given**: `mockConsumeTokens` returns `null` for `"expired-uuid"`. Loader called with URL `http://localhost/furigana/expired-uuid?storage=in-memory`.
- **When**: `loader({ params: { id: "expired-uuid" }, request: new Request("http://localhost/furigana/expired-uuid?storage=in-memory") })`
- **Then**: `result.tokens` equals `[]`. No error thrown.
- **Coverage**: Guards against crashes when the `?storage=in-memory` path is used but the store entry has already been consumed (e.g., back-navigation or reloading the furigana page).

**Test 3**: Returns empty array when no search param is present (future TursoDB path placeholder)

- **Given**: `mockConsumeTokens` is not called. Loader called with URL `http://localhost/furigana/test-uuid` (no search param).
- **When**: `loader({ params: { id: "test-uuid" }, request: new Request("http://localhost/furigana/test-uuid") })`
- **Then**: `result.tokens` equals `[]`. `mockConsumeTokens` was NOT called.
- **Coverage**: Confirms the no-search-param code path does not erroneously call the in-memory store and returns the empty placeholder for the future TursoDB milestone.

---

### Unit Tests — `home` Action (updated `home.test.ts`)

The existing action tests cover error paths and remain valid. Only the success path test changes:

**Test (updated)**: Redirects to `/furigana/<uuid>?storage=in-memory` on successful generation

- **Given**: `mockGenerateFurigana` resolves with a `FuriganaToken[]`. `mockStoreTokens` returns `"test-uuid-1234"`.
- **When**: `action(createActionArgs(createFormRequest("日本語")))` called.
- **Then**: The return value is a `Response` with `status: 302` and `Location` header equal to `"/furigana/test-uuid-1234?storage=in-memory"`. `mockStoreTokens` was called with the generated token array.
- **Coverage**: Ensures successful generation no longer returns inline tokens and the redirect URL includes both the UUID path segment and the `?storage=in-memory` search parameter needed for the loader's conditional branch.

---

### Integration Tests

**Test 1**: Home form submission flows through to furigana dynamic route via `?storage=in-memory` (redirect chain)

- **Given**: Both `home.tsx` and `furigana.$id.tsx` routes are rendered in a test environment with React Router's `createMemoryRouter`. The token store is the real module (not mocked) — it is an in-process `Map`. The router is configured with routes `"/"` and `"/furigana/:id"`.
- **When**: User submits valid Japanese text in the home form.
- **Then**: The router navigates to `/furigana/<uuid>?storage=in-memory`. The furigana route component renders `<ruby>` elements matching the generated tokens.
- **Coverage**: Detects breakage in the data-passing handoff between home action and furigana loader. This test catches UUID mismatch errors, route registration bugs, and search-param routing bugs that unit tests cannot.

**Test 2**: Home route renders error state when generation fails (no redirect)

- **Given**: `generateFurigana` throws. The home action returns an `ActionError`.
- **When**: Home form submitted with valid Japanese text.
- **Then**: The URL stays at `/`. An error message is displayed. No redirect occurs.
- **Coverage**: Confirms that the error path does not attempt a redirect (which would lose the error message).

---

### E2E Tests (Playwright — optional for this task, noted for completeness)

**Test 1**: End-to-end furigana generation and reading view

- **Given**: User navigates to `/` and the app is running.
- **When**: User pastes `"日本語を勉強しています。"` into the textarea and clicks "Generate Furigana".
- **Then**: Browser URL changes to `/furigana/<uuid>?storage=in-memory`. At least one `<ruby>` element is visible in the DOM. The `<article>` has `lang="ja"`.
- **Coverage**: Full pipeline smoke test — form submission, action, token store, furigana loader with `?storage=in-memory` branch, ruby rendering.

---

## Implementation Checklist

- [ ] Phase 1.1: Create `app/services/token-storage.service.ts` with `storeTokens` and `consumeTokens`
- [ ] Phase 1.2: Update `home.tsx` action success branch to call `storeTokens` and `redirect("/furigana/<uuid>?storage=in-memory")`
- [ ] Phase 1.3: Remove `ReadingView` import, `ActionSuccess` type, `showReadingView` branch from `home.tsx`
- [ ] Phase 1.4: Delete `app/components/furigana/ReadingView.tsx` (and directory if empty)
- [ ] Phase 2.1: Add `route("furigana/:id", "routes/furigana.$id.tsx")` to `app/routes.ts`
- [ ] Phase 2.2: Create `app/routes/furigana.$id.tsx` with conditional loader (in-memory branch when `?storage=in-memory`, empty array placeholder for no-param branch with TODO for TursoDB) and ruby render component
- [ ] Phase 2.3: Add `rt` rules to `@layer base` in `app/app.css`
- [ ] Phase 3.1: Update `home.test.ts` success test to assert redirect response to `/furigana/<uuid>?storage=in-memory` and mock `~/services/token-storage.service`
- [ ] Phase 3.2: Remove `ReadingView` mock and `showReadingView` test from `home.test.tsx`
- [ ] Phase 3.2: Update `ActionData` type in `home.test.tsx` to error-only
- [ ] Phase 3.3: Create `app/routes/furigana.$id.test.tsx` with all 8 component tests
- [ ] Phase 3.4: Create `app/routes/furigana.$id.test.ts` with 3 loader tests (in-memory hit, in-memory miss, no-param placeholder)
- [ ] Phase 4.1: Visual smoke test in browser (`pnpm dev`)
- [ ] Phase 4.2: `pnpm test` — all tests pass, no regressions
- [ ] Phase 4.3: `pnpm type-check` passes
- [ ] Phase 4.4: `pnpm exec eslint .` passes

---

## Notes & Considerations

### Why the route is `/furigana/:id` with `?storage=in-memory` search parameter

The UUID is embedded as a dynamic route segment (`/furigana/<uuid>`) and the storage mode is passed as a search parameter (`?storage=in-memory`). This separation has a clear motivation:

- **Dynamic segment for resource identity**: The UUID identifies a specific furigana reading session. In React Router v7, dynamic segments are the canonical pattern for resource identification. The UUID will remain the same whether tokens are retrieved from in-memory storage or TursoDB.
- **Search parameter for retrieval strategy**: The `?storage=in-memory` param is not part of the resource identity — it is an instruction to the loader about where to look for the tokens. When milestone 2 adds TursoDB persistence, the home action will stop appending `?storage=in-memory` and the loader will use the no-param branch to fetch from the database. The URL structure (`/furigana/<uuid>`) will become the permanent deeplink. No URL migration is needed.

### Conditional token loading and the TursoDB future milestone

The loader in `furigana.$id.tsx` follows a clean conditional dispatch:

1. **`?storage=in-memory` present (Task 12 — implemented)**: Call `consumeTokens(params.id)`. If found, return tokens and delete the entry. If not found, return empty array.
2. **No search param (milestone 2 — not implemented)**: Fetch from TursoDB by `params.id`. The `TODO` comment in the loader marks the exact insertion point. The loader return type (`LoaderData`) will not change when this branch is implemented.

This pattern avoids any fallback ambiguity: in Task 12, an empty array from `consumeTokens(null)` in the `?storage=in-memory` branch clearly means "store miss" not "TursoDB not yet implemented." The two cases are separated by the conditional, not by the token value.

### Why cookie session flash was ruled out

`MAX_INPUT_LENGTH = 10_000` characters. A worst-case 10,000-character input (all single-kanji ruby tokens) produces a serialized token array of approximately **469 KB**. A realistic mixed-content input yields approximately **350 KB**. The RFC 6265 browser cookie limit is 4,096 bytes minimum. The worst-case token array is **117x larger than the cookie limit**.

Browsers silently truncate cookies that exceed their per-cookie size limit. The server receives no error. The furigana loader would receive a truncated or empty session, making it appear as though no tokens were generated even after a successful API response.

The in-memory store approach has no such size limit. It is the correct solution for this input scale.

### Why localStorage and IndexedDB were ruled out

Both localStorage and IndexedDB are browser APIs — they do not exist in Node.js. React Router v7 runs loaders server-side (`ssr: true`). A `loader` that references `localStorage` would throw `ReferenceError: localStorage is not defined` on the server.

They could be used in a `clientLoader` (client-only execution), but this would:
1. Disable SSR for the furigana route, losing the first-render performance and SEO benefits.
2. Require a loading state while the client hydrates and reads from storage.
3. Introduce a race condition if the user refreshes before the `clientLoader` completes.

The server-side in-memory store avoids all of these issues.

### In-memory store and distributed deployments

The `Map`-based token store works correctly for single-server Node.js deployments (the target for this MVP). It does not work for:
- Deployments with multiple server instances behind a load balancer (a request from the action and the subsequent request from the loader could hit different instances).
- Edge/serverless deployments where each request may be a cold start with no shared memory.

For the MVP scope (single server, local development), this is not a concern. When the app scales, the store should be replaced with a Redis cache or TursoDB ephemeral table. The `storeTokens` / `consumeTokens` interface is intentionally narrow to make this substitution straightforward.

### Why `createMemorySessionStorage` from react-router was not used

`createMemorySessionStorage` (confirmed available in the installed react-router version) is essentially the same pattern — a server-side `Map` wrapped in session cookie plumbing. However, it still uses a session cookie to pass the session ID to the client and back, which adds unnecessary cookie overhead for a pattern that only needs a UUID in the URL path. The custom `Map` in `app/services/token-storage.service.ts` is simpler, has fewer moving parts, and avoids any cookie size concerns entirely.
