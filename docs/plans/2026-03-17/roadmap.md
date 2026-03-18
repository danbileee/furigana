# Implementation Roadmap: Furigana MVP

**Generated**: 2026-03-18
**PRD Version**: 2026-03-17

---

## Executive Summary

Furigana MVP is a React Router v7 (SSR) single-page application that allows Japanese learners to paste arbitrary text, receive AI-generated furigana annotations via GPT-4o-mini, and browse a persistent reading history. The core architectural loop — textarea input → server-side `action` → GPT-4o-mini API → annotation string → ruby HTML rendering → Sanity write — runs through a single route and establishes the foundation every other feature builds on. All subsequent features (history sidebar, view mode toggle, AI title generation, soft-delete, inline editing) are additive layers on top of this loop rather than parallel tracks.

The milestone sequencing strategy follows the review's recommended implementation sequence closely: the core generation loop ships first to validate the primary value proposition, then Sanity storage is layered in to enable persistence, followed by progressive feature additions in order of user-facing impact. Two parallelizable workstreams (relative timestamps, session persistence) can proceed concurrently in later milestones. Mobile-specific behaviors are deferred to a dedicated final milestone. The estimated total timeline for a single engineer is approximately 3–4 weeks of focused work.

---

## Architectural Decisions Requiring Input

### Decision 1: Mobile "On Hover" Tap Implementation

**Impact**: Medium — determines how `<ruby>` elements respond to touch interactions across iOS Safari, Chrome for Android, and other mobile browsers. Affects how many components carry JS event listeners at runtime.

- **Option A: Pure CSS with `@media (pointer: fine)` gate**
  Apply the `:hover` rule only under `@media (pointer: fine)` so that touch devices never receive the hover-based visibility logic. On touch devices, the `<rt>` elements remain visible at all times when in "On Hover" mode — effectively degrading the mode to "Always" on mobile rather than providing a tap-reveal interaction. Implementation is CSS-only with zero JS overhead. Trade-off: the "On Hover" self-test experience is not available on mobile; mobile users are limited to "Always" mode behavior regardless of toggle setting.

- **Option B: CSS class + minimal JS touch handler per `<ruby>` element**
  Apply the same `@media (pointer: fine)` gate for mouse hover, and add a `click`/`touchstart` handler on each `<ruby>` element that toggles an `.active` class; CSS reveals `<rt>` for `.active ruby`. This is deterministic, testable, and eliminates cross-browser sticky-hover inconsistency. A tap on one word shows its reading; a second tap on the same word (or a tap elsewhere with `touchstart` delegation from the container) hides it. No full React re-render — only a class toggle on a DOM node. Trade-off: each reading view mounts and tears down event listeners; for a 10,000-character article this could be hundreds of listeners. Delegation from a single container element (one `touchstart` listener that walks up to the nearest `<ruby>` ancestor) mitigates this entirely.

  **Recommended approach**: Option B with event delegation from the reading container. This is implemented in Milestone 8 as part of the dedicated mobile support milestone.

### Decision 2: Sidebar Desktop/Mobile Rendering Strategy

**Impact**: Low-Medium — affects how many React component trees are maintained in memory simultaneously and whether a `useMediaQuery` hook (or equivalent) is required.

- **Option A: Single sidebar component, CSS-controlled visibility**
  One `<Sidebar>` component is always in the DOM. Tailwind responsive utilities (`hidden md:flex`, etc.) show it as a fixed column on desktop and hide it on mobile. A `<Sheet>` from shadcn/ui wraps it for the mobile drawer overlay, or the same component is shown/hidden via CSS within a sheet. Simpler React tree; sidebar state (scroll position, active item) is never lost on resize. Trade-off: the component is always mounted even when visually hidden; the `Sheet` wrapper may need extra effort to correctly scope focus trapping to mobile-only.

- **Option B: Conditional rendering — fixed column on desktop, Sheet on mobile**
  At the desktop breakpoint, render `<Sidebar>` directly. Below the breakpoint, render `<Sheet><Sidebar /></Sheet>`. Requires a `useMediaQuery` hook (or `window.matchMedia`) to branch the render path. Cleaner focus trapping and scroll isolation. Trade-off: sidebar state resets on breakpoint crossing; requires client-side breakpoint detection (unavailable during SSR, so initial render always uses one branch until hydration).

  **Recommended approach**: Option A with a single sidebar component and CSS-controlled visibility. The SSR compatibility and simpler state model outweigh the minor focus-trapping complexity, which can be handled by conditionally enabling `trapFocus` on the `Sheet` wrapper based on viewport. Mobile drawer implementation is deferred to Milestone 8.

### Decision 3: Sanity Read Strategy for Sidebar History

**Impact**: Medium — determines whether sidebar entries are available on first paint (SSR) or only after client hydration, and whether Sanity reads use the write token or a public read endpoint.

- **Option A: Server-side `loader` (SSR) for sidebar list**
  The route `loader` fetches the sidebar entry list from Sanity on every request using the server-only `SANITY_API_TOKEN`. Entries are available on first paint; no hydration flash. Trade-off: every page load makes a Sanity API call on the server, increasing TTFB; the write token is used for reads (acceptable for personal-use, but not principle-of-least-privilege).

- **Option B: `clientLoader` for sidebar list (client-only fetch)**
  The sidebar list is fetched in a `clientLoader` after hydration. SSR renders the page shell without sidebar entries; the list appears after the client fetch resolves. During the loading state, the sidebar renders a skeleton UI (shimmer placeholder rows) instead of an empty list, eliminating any flash of empty content. Session persistence (`lastViewedEntryId`) is read in the same `clientLoader`, so both resolve in a single round trip.

- **Option C: Server `loader` for active entry only, `clientLoader` for sidebar list**
  SSR hydrates the main reading view (last-viewed entry) using a server `loader` that reads `lastViewedEntryId` from a cookie set by client JS. The sidebar list is populated client-side via `clientLoader`. This provides the best perceived performance for the critical path (reading view) while keeping sidebar load lightweight. Trade-off: requires setting a cookie on the client every time `lastViewedEntryId` changes, in addition to `localStorage`.

**Recommended approach**: Option B (`clientLoader` for sidebar list) — preferred. Sidebar renders a skeleton UI during the loading state to prevent flash of empty content; `lastViewedEntryId` resolves in the same round trip.

---

## Milestone-Based Implementation Roadmap

### Milestone 1: Core Generation Loop

**Objective**: Establish the end-to-end path from text input to furigana-rendered reading view, including the annotation string parser, ruby HTML rendering, and all input/output edge case handling. No persistence in this milestone — the generated result lives only in route action data.

**Weight**: 0.23

**Key Components**:
- `app/routes/home.tsx` — rewritten as the primary application shell with `action` for furigana generation
- `app/lib/ai/client.ts` — GPT-4o-mini client wrapper (server-only)
- `app/lib/ai/prompts.ts` — system prompt and few-shot example definitions
- `app/lib/furigana/parser.ts` — `漢字{よみ}` annotation string → structured token array
- `app/components/furigana/ReadingView.tsx` — renders structured tokens as `<ruby>` HTML
- `app/components/furigana/InputArea.tsx` — textarea with character counter and submit button
- `app/app.css` — ruby CSS base rules (`display: ruby`, `display: ruby-text`)

**Architectural Focus**:
- Server-side `action` as the single integration point for GPT-4o-mini (API key never reaches client)
- Parser produces a typed token array (`Array<{ type: 'text'; value: string } | { type: 'ruby'; kanji: string; reading: string }>`) rather than raw HTML — the component renders HTML from this type-safe structure, eliminating XSS surface
- Ruby CSS defined in `@layer base` of `app.css` to ensure Tailwind v4's reset does not zero out `display: ruby` and `display: ruby-text`
- Character counter and submit-disable logic are purely client-side React controlled state on the textarea — no server involvement
- Keyboard shortcut (Cmd/Ctrl+Enter) implemented via `onKeyDown` on the textarea only

**Implementation Approach**:
- Install `openai` npm package; configure client in `app/lib/ai/client.ts` using `process.env.OPENAI_API_KEY` (server-only, no `VITE_` prefix)
- System prompt instructs GPT-4o-mini to return only the annotated string in `漢字{よみ}` format with no additional commentary; two or three few-shot examples lock in the format
- Server `action` in `home.tsx`: read `text` from `formData`, call GPT-4o-mini, validate that the response matches the expected annotation format, return `{ annotationString }` to the client; on failure return `{ error }` with the original text preserved
- Parser regex: `/([^{}\n]+(?:\{[^}]+\})?)/g` iterates through the string producing text and ruby token objects; unit-tested for edge cases (consecutive ruby tokens, no-kanji input, malformed braces)
- `ReadingView` maps the token array to JSX: `<ruby>kanji<rp>(</rp><rt>reading</rt><rp>)</rp></ruby>` for ruby tokens, plain `<span>` for text tokens
- Submission loading state: use `useNavigation().state === 'submitting'` (React Router idiomatic) to disable textarea and show spinner on button
- Error state: render error message below textarea from `useActionData()`, preserving textarea content via controlled state initialized from `useActionData`

**Test Strategy**:
- Unit Testing: `app/lib/furigana/parser.ts` — exhaustive test matrix covering: standard kanji compounds, consecutive ruby tokens, pure hiragana input (no annotations), pure romaji, empty string, malformed braces (unclosed `{`, nested braces), mixed kanji/hiragana/punctuation. Test framework: Vitest (to be added as dev dependency).
- Unit Testing: `app/lib/ai/prompts.ts` — snapshot test for system prompt string to catch accidental edits.
- Integration Testing: `action` handler in `home.tsx` — mock the `openai` SDK client; test that a valid annotation string response is parsed and returned correctly, and that a malformed AI response triggers the error path.
- End-to-End Testing: Playwright (to be added) — paste Japanese text into textarea, click submit, assert that `<ruby>` elements appear in the DOM with correct `<rt>` text.
- End-to-End Testing: Playwright — paste text exceeding 10,000 characters, assert submit button is disabled.
- End-to-End Testing: Playwright — submit with empty textarea, assert no navigation and no error message.

**Deliverables**:
- Working furigana generation flow (input → AI → render) with no persistence
- `app/lib/furigana/parser.ts` with full unit test coverage
- `app/lib/ai/client.ts` and `app/lib/ai/prompts.ts`
- `app/components/furigana/ReadingView.tsx` and `app/components/furigana/InputArea.tsx`
- Ruby base CSS in `app/app.css`
- `.env.example` documenting required `OPENAI_API_KEY`

**Success Criteria**:
- Submitting a standard Japanese paragraph produces a reading view with correct ruby annotations
- Pure hiragana or romaji input produces the reading view with no ruby elements (no crash)
- Malformed AI response (simulated in tests) returns an inline error without losing textarea content
- Parser unit tests pass at 100% line coverage
- `pnpm type-check` passes with zero errors

---

### Milestone 2: Sanity Storage and History Sidebar

**Objective**: Persist every generated entry to Sanity and populate the history sidebar with the persisted list. Establish the full Sanity schema, GROQ queries, and the sidebar component architecture.

**Weight**: 0.22

**Key Components**:
- Sanity project setup (schema, `.env` credentials)
- `app/lib/sanity/client.ts` — server-only Sanity client wrapper
- `app/lib/sanity/queries.ts` — GROQ query definitions typed with Zod
- `app/lib/sanity/schema.ts` — entry document type definition
- `app/components/sidebar/Sidebar.tsx` — history list with active state
- `app/components/sidebar/SidebarEntry.tsx` — individual row (title, timestamp, active highlight)
- Updated `app/routes/home.tsx` — `action` now writes to Sanity after AI generation; `loader` or `clientLoader` fetches sidebar list

**Architectural Focus**:
- Sanity schema for the `entry` document: `{ _id, rawText, annotationString, title, createdAt, deletedAt }`; `deletedAt` defaults to `null` — soft-delete in a single document type, no separate trash collection
- All Sanity write operations (`action` functions) use the server-only `SANITY_API_TOKEN`; reads for the sidebar list use the same token via a `clientLoader` (Option B, **preferred**, from Decision 3 above — sidebar shows a skeleton UI during loading)
- GROQ queries are defined as typed constants in `queries.ts` and validated with Zod schemas on response, ensuring the app never operates on unexpected Sanity response shapes
- Active sidebar entry tracked in React state (or via URL search param) rather than re-fetching from Sanity on every click
- `Sidebar` component uses the layout pattern from Decision 2 (Option A): single component, CSS-controlled visibility

**Implementation Approach**:
- Sanity schema defines `entry` document; dataset name and project ID configured via `SANITY_PROJECT_ID` and `SANITY_DATASET` env vars
- `clientLoader` in `home.tsx` fetches sidebar list with GROQ: `*[_type == "entry" && !defined(deletedAt)] | order(createdAt desc)` — returns `_id`, `title`, `createdAt` (not full annotation string, to keep sidebar payload small)
- `action` writes the new entry to Sanity immediately after AI generation, before returning the annotation string to the client; the client receives both `annotationString` and `entryId` in the action response
- Active entry ID stored in React state; clicking a sidebar row fetches that entry's full data (`annotationString`) via a `useFetcher` call to a dedicated loader (e.g., `GET /api/entries/:id`) and renders `ReadingView`
- Sidebar row shows first 30 characters of `rawText` as title placeholder (since AI title generation comes in Milestone 4); this is the permanent fallback until title is generated
- "New" button resets active entry ID to `null` and shows `InputArea`

**Test Strategy**:
- Unit Testing: Zod schemas for Sanity query responses — assert that valid and invalid shapes pass and fail validation respectively.
- Unit Testing: GROQ query strings — snapshot tests to catch accidental edits to critical queries.
- Integration Testing: Sanity `action` handler — use a Sanity test dataset (configured via `SANITY_TEST_DATASET` env var) or mock the Sanity client; test that a successful AI response writes an entry and returns `entryId`, and that a Sanity write failure returns an error without losing the annotation result.
- End-to-End Testing: Playwright — complete generation flow; assert new entry appears at the top of the sidebar after generation.
- End-to-End Testing: Playwright — click a sidebar entry; assert the reading view updates to show that entry's annotation.
- End-to-End Testing: Playwright — click "New"; assert reading view is replaced by the input area and no sidebar row is highlighted.

**Deliverables**:
- Sanity project setup instructions in `README.md` (required env vars, dataset creation)
- `app/lib/sanity/` module with client, queries, schema, and Zod validation
- `app/components/sidebar/` with `Sidebar.tsx` and `SidebarEntry.tsx`
- Updated `home.tsx` with Sanity write in `action` and sidebar list fetch in `clientLoader`
- Updated `.env.example` with `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN`

**Success Criteria**:
- Generated entries persist across page reloads
- Sidebar lists all non-deleted entries in reverse-chronological order
- Clicking a sidebar entry renders that entry's furigana view
- Sanity schema Zod validation catches malformed responses in tests
- `pnpm type-check` passes with zero errors

---

### Milestone 3: View Mode Toggle and Preference Persistence

**Objective**: Implement the "Always" / "On Hover" display mode toggle with correct desktop hover behavior. Mobile tap behavior is deferred to Milestone 8.

**Weight**: 0.08

**Key Components**:
- `app/components/furigana/ViewModeToggle.tsx` — toggle control (shadcn/ui `ToggleGroup` or `Switch`)
- Updated `app/app.css` — `[data-view-mode="on-hover"]` CSS rules with `@media (pointer: fine)` gate
- Updated `app/routes/home.tsx` `clientLoader` — reads `viewMode` from `localStorage`
- `app/components/furigana/ReadingView.tsx` — accepts `viewMode` prop, sets `data-view-mode` attribute on container

**Architectural Focus**:
- View mode is a CSS concern, not a React re-render concern: toggling mode updates a `data-view-mode` attribute on the reading container; `<rt>` visibility is controlled entirely by CSS selectors
- `@media (pointer: fine)` gates the `:hover` CSS rule so it never fires on touch devices
- Mobile tap delegation deferred to Milestone 8
- `localStorage` read in `clientLoader` (not `useEffect`) per the project's `useEffect` rule; write via a dedicated `clientAction` or inline in the toggle's `onChange` handler using `localStorage.setItem` directly (synchronous, safe on client)
- Toggle state initialized from `clientLoader` data to avoid hydration mismatch

**Implementation Approach**:
- CSS in `app/app.css` (`@layer base`):
  ```css
  [data-view-mode="on-hover"] ruby rt {
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.15s;
  }
  @media (pointer: fine) {
    [data-view-mode="on-hover"] ruby:hover rt {
      visibility: visible;
      opacity: 1;
    }
  }
  ```
- `ReadingView` sets `data-view-mode` on its root element
- `clientLoader` returns `{ viewMode: localStorage.getItem('viewMode') ?? 'always' }` using Zod enum parse to validate the type-safe value
- Toggle `onChange` calls `localStorage.setItem('viewMode', newMode)` and updates local React state

**Test Strategy**:
- Unit Testing: `ViewModeToggle` component — assert correct initial state from loader data; assert `localStorage.setItem` is called on toggle change (via `vi.spyOn`).
- Integration Testing: `clientLoader` — mock `localStorage`; assert default fallback is `'always'`; assert stored value is returned correctly.
- End-to-End Testing: Playwright (desktop viewport) — set mode to "On Hover"; hover over a `<ruby>` element; assert `<rt>` becomes visible. Move mouse away; assert `<rt>` is hidden again.
- End-to-End Testing: Playwright — set mode to "On Hover"; reload page; assert mode is restored to "On Hover".

**Deliverables**:
- `app/components/furigana/ViewModeToggle.tsx`
- Updated `app/app.css` with view mode CSS rules
- `clientLoader` returning persisted view mode preference

**Success Criteria**:
- "Always" mode renders all `<rt>` elements visible at all times
- "On Hover" mode on desktop hides `<rt>` until mouse enters `<ruby>` parent
- Preference survives page reload
- `pnpm type-check` passes with zero errors

---

### Milestone 4: AI Title Generation

**Objective**: Add background AI title generation using `useFetcher`, with a live placeholder in the sidebar row that transitions to the AI title on resolution.

**Weight**: 0.10

**Key Components**:
- `app/routes/api.title.ts` — dedicated route handling `POST /api/title`; calls GPT-4o-mini for title; PATCHes the Sanity entry
- Updated `app/routes/home.tsx` — fires `useFetcher` after `action` completes (triggered by presence of `entryId` in action data)
- Updated `app/components/sidebar/SidebarEntry.tsx` — title placeholder state and transition

**Architectural Focus**:
- Title generation is a follow-up `useFetcher` call, never a `useEffect` — `useFetcher.submit({ text, entryId }, { method: 'POST', action: '/api/title' })` fires after the primary `action` completes and the component receives `entryId` in `useActionData`
- The `useFetcher` fire condition uses the React Router pattern: a `useEffect` with `[entryId]` dependency that calls `fetcher.submit` once — this is an acceptable `useEffect` use because the trigger is a state change (entryId arriving) with no loader/action equivalent for the follow-up dispatch itself
- The route `api.title.ts` is a server-only resource route with no component; it reads `text` and `entryId` from the request, calls GPT-4o-mini, PATCHes Sanity, and returns `{ title }`
- `SidebarEntry` shows the first 30 characters of `rawText` in `text-muted-foreground` until `useFetcher.data.title` arrives; CSS `transition: opacity` smooths the swap without layout shift (fixed `min-height` on the title line)
- On title generation failure, the 30-character placeholder remains permanently — no error surfaced to the user (per PRD spec)

**Implementation Approach**:
- `api.title.ts` action: extract `text` from form data, call `openai.chat.completions.create` with a short prompt asking for a 3–6 word English title, PATCH the Sanity entry with `{ title }`, return JSON response
- Add route to `app/routes.ts`: `route("api/title", "routes/api.title.ts")`
- In `home.tsx` component: after `actionData` arrives with `entryId`, fire `titleFetcher.submit` once; update local sidebar list state when `titleFetcher.data` resolves
- Sanity entry's `title` field: `null` on create (Milestone 2), populated by this milestone's PATCH; sidebar query already returns `title` — null check in `SidebarEntry` selects placeholder vs. title display

**Test Strategy**:
- Unit Testing: title prompt in `app/lib/ai/prompts.ts` — snapshot test.
- Integration Testing: `api.title.ts` action — mock `openai` SDK and Sanity client; assert that a successful response PATCHes Sanity and returns `{ title }`; assert that an AI failure returns a 200 response with `{ title: null }` (so `useFetcher` resolves without crashing the client).
- Integration Testing: failure path — Sanity PATCH fails after successful AI call; assert that the title is still returned to the client (best-effort write).
- End-to-End Testing: Playwright — submit Japanese text; assert that the sidebar row initially shows a truncated placeholder; wait for title fetcher to resolve; assert the placeholder is replaced by an AI-generated title.
- End-to-End Testing: Playwright — simulate AI title failure (intercept network request); assert the truncated placeholder remains with no error UI.

**Deliverables**:
- `app/routes/api.title.ts` resource route
- Updated `home.tsx` with `useFetcher` title dispatch
- Updated `SidebarEntry.tsx` with placeholder/title transition

**Success Criteria**:
- Sidebar row shows 30-character placeholder immediately after generation
- Title replaces placeholder with no layout shift when fetcher resolves
- Title is persisted in Sanity (survives page reload)
- Title generation failure leaves the placeholder permanently with no user-visible error
- `pnpm type-check` passes with zero errors

---

### Milestone 5: Soft-Delete and Trash Menu

**Objective**: Implement hover-triggered trash icon on desktop. Mobile trash icon visibility is deferred to Milestone 8.

**Weight**: 0.16

**Key Components**:
- `app/routes/api.entries.$id.delete.ts` — `POST` action setting `deletedAt` on Sanity entry
- `app/routes/api.entries.$id.restore.ts` — `POST` action clearing `deletedAt`
- `app/routes/api.entries.$id.destroy.ts` — `POST` action permanently deleting a Sanity entry
- `app/routes/api.trash.empty.ts` — `POST` action permanently deleting all `deletedAt != null` entries
- `app/components/sidebar/TrashMenu.tsx` — shadcn/ui `Sheet` panel listing soft-deleted entries
- Updated `app/components/sidebar/SidebarEntry.tsx` — hover-reveal trash icon (desktop)
- Updated `app/components/sidebar/Sidebar.tsx` — trash icon trigger at bottom, toast integration

**Architectural Focus**:
- All delete/restore/destroy operations are `POST` actions on dedicated resource routes — no client-side `fetch` calls; `useFetcher` from each `SidebarEntry` dispatches the appropriate action
- Soft-delete: `action` sets `deletedAt: new Date().toISOString()` via Sanity PATCH; sidebar `clientLoader` GROQ query already filters `deletedAt == null` — the row disappears from sidebar immediately via optimistic `useFetcher` state
- Mobile trash icon visibility deferred to Milestone 8
- Trash Menu fetches `*[_type == "entry" && defined(deletedAt)] | order(deletedAt desc)` from Sanity when the `Sheet` opens (via `useFetcher` triggered by `onOpenChange`)
- Toast notification: use shadcn/ui `Sonner` (or `useToast` from existing shadcn/ui) — "Entry deleted" shown on soft-delete; component added to root layout
- "Deleting currently viewed entry" edge case: when `entryId === activeEntryId`, `action` response includes a flag; component switches to next entry or empty state
- Trash retention: no auto-purge in MVP — entries stay until "Empty Trash" is explicitly triggered (per PRD decision)

**Implementation Approach**:
- Add four resource routes to `app/routes.ts`
- `SidebarEntry` row layout: `group relative flex items-center` — trash icon absolutely positioned right, `opacity-0 group-hover:opacity-100` on desktop
- Optimistic delete: `useFetcher.state === 'submitting'` hides the row immediately; on `useFetcher.data` error, restore row (rare — Sanity PATCH failures)
- `TrashMenu` opens as a shadcn/ui `Sheet` (side="left" or side="right"); on open, fires `useFetcher` to fetch trash list; each row has Restore and Delete buttons wired to their respective fetchers
- Restore action clears `deletedAt` via Sanity PATCH; sidebar `clientLoader` re-runs on navigation, but the sidebar list can be updated optimistically in local state

**Test Strategy**:
- Unit Testing: Sanity GROQ queries for trash list — Zod schema validation on response shape.
- Integration Testing: `api.entries.$id.delete.ts` — mock Sanity; assert `deletedAt` is set; assert deleted entry does not appear in subsequent sidebar list query.
- Integration Testing: `api.entries.$id.restore.ts` — mock Sanity; assert `deletedAt` is cleared; assert restored entry appears at original `createdAt` position in sidebar list.
- Integration Testing: `api.trash.empty.ts` — mock Sanity; assert all `deletedAt != null` entries are hard-deleted.
- End-to-End Testing: Playwright (desktop) — hover over sidebar row; assert trash icon appears; click icon; assert row disappears from sidebar and toast appears.
- End-to-End Testing: Playwright — delete the currently active entry; assert main view switches to next entry (or empty input state if none).
- End-to-End Testing: Playwright — open Trash Menu; assert deleted entry appears; click Restore; assert entry returns to sidebar.
- End-to-End Testing: Playwright — open Trash Menu; click "Empty Trash"; assert Trash Menu is empty.

**Deliverables**:
- Four resource routes for delete/restore/destroy/empty-trash
- `TrashMenu.tsx` component
- Updated `SidebarEntry.tsx` with desktop trash icon
- Toast notification integrated in root layout

**Success Criteria**:
- Soft-deleted entries disappear from sidebar and appear in Trash Menu
- Restore returns entry to original chronological sidebar position
- "Empty Trash" permanently removes all trash entries
- Deleting active entry transitions main view correctly
- `pnpm type-check` passes with zero errors

---

### Milestone 6: Inline Title Editing (Desktop Only)

**Objective**: Implement double-click inline title editing on sidebar rows for desktop, with Enter/Escape/blur semantics and Sanity PATCH persistence.

**Weight**: 0.07

**Key Components**:
- Updated `app/components/sidebar/SidebarEntry.tsx` — inline edit state, `<input>` swap, event handlers
- `app/routes/api.entries.$id.title.ts` — `POST` action PATCHing title on Sanity entry

**Architectural Focus**:
- Edit mode is a local React state flag in `SidebarEntry` — no global state involved
- `onDoubleClick` on the title text element only (not the row `onClick`) activates edit mode; this is distinct from single-click which loads the entry
- The row `onClick` must not fire when `onDoubleClick` fires — handled by calling `event.stopPropagation()` on the double-click handler, or by conditionally blocking the row click when `isEditing` is true
- On confirmation: `value.trim().length > 0` check before dispatching `useFetcher.submit`; empty/whitespace silently restores previous title without a server call
- Optimistic update: title in sidebar updates immediately on Enter/blur; `useFetcher` dispatches the Sanity PATCH in the background
- Mobile inline editing is explicitly out of scope for MVP; no edit affordance on mobile

**Implementation Approach**:
- `SidebarEntry` manages `isEditing: boolean` and `editValue: string` state
- When `isEditing` is true, render `<input>` in place of title text, pre-filled with current title, with `autoFocus`
- `onKeyDown`: Enter → confirm, Escape → cancel (`setIsEditing(false)`, restore `editValue`)
- `onBlur` → confirm (same logic as Enter)
- Confirm logic: if `editValue.trim()` is non-empty, optimistically update displayed title and fire `titleFetcher.submit`; else silently restore
- `api.entries.$id.title.ts` action: read `title` from form data, PATCH Sanity, return `{ title }`
- Add route to `app/routes.ts`

**Test Strategy**:
- Unit Testing: `SidebarEntry` in edit mode — mock `useFetcher`; assert that Enter with non-empty value calls `fetcher.submit`; assert that Enter with empty/whitespace does not call `fetcher.submit` and restores previous title; assert that Escape cancels without calling `fetcher.submit`.
- Unit Testing: assert that `onDoubleClick` sets `isEditing: true` and `onClick` does not trigger row navigation when `isEditing` is true.
- Integration Testing: `api.entries.$id.title.ts` — mock Sanity; assert PATCH is called with correct title; assert response.
- End-to-End Testing: Playwright (desktop) — double-click a sidebar title; assert input appears pre-filled; type new title, press Enter; assert sidebar shows new title.
- End-to-End Testing: Playwright (desktop) — double-click title; clear field; press Enter; assert previous title is restored.
- End-to-End Testing: Playwright (desktop) — double-click title; type new title; press Escape; assert previous title is restored.

**Deliverables**:
- Updated `SidebarEntry.tsx` with inline edit state and handlers
- `app/routes/api.entries.$id.title.ts` resource route

**Success Criteria**:
- Double-click activates inline edit on desktop; single-click still loads entry
- Enter and blur confirm; Escape cancels
- Empty submission silently restores previous title
- Title persists in Sanity after edit
- `pnpm type-check` passes with zero errors

---

### Milestone 7: Relative Timestamps and Session Persistence

**Objective**: Complete the two remaining lower-complexity features — relative timestamps with live updates and session persistence — which can be implemented in parallel.

**Weight**: 0.07

#### 7a: Relative Timestamps

**Key Components**:
- `app/lib/utils/timestamp.ts` — `formatTimestamp(date: Date): string` using `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat`
- Updated `app/components/sidebar/SidebarEntry.tsx` — timestamp display
- `useTimestampRefresh` custom hook — `setInterval` every 60 seconds; this is the one approved `useEffect` use (recurring timer with no loader/action equivalent)

**Implementation Approach**:
- `formatTimestamp`: if `Date.now() - date.getTime() < 24 * 60 * 60 * 1000`, use `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`; otherwise use `Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })`
- `useTimestampRefresh` hook: sets up `setInterval(60_000)` via `useEffect` with cleanup on unmount; triggers a re-render of sidebar entries (via a `tick` counter in state) every 60 seconds

#### 7b: Session Persistence

**Key Components**:
- Updated `app/routes/home.tsx` `clientLoader` — reads `lastViewedEntryId` from `localStorage`, fetches entry from Sanity, handles deleted entry fallback

**Implementation Approach**:
- Every sidebar row click and every successful generation sets `localStorage.setItem('lastViewedEntryId', entryId)`
- `clientLoader` reads `lastViewedEntryId`; if null, returns `{ entry: null }`; fetches entry from Sanity; checks `!entry || entry.deletedAt` → returns `{ entry: null }`; otherwise returns `{ entry }`
- Component initializes from `clientLoader` data: if `entry` is non-null, show `ReadingView`; if null, show `InputArea`

**Test Strategy**:
- Unit Testing: `formatTimestamp` — test matrix: 30 seconds ago → "just now" (or "30 seconds ago"), 5 minutes ago → "5 minutes ago", 25 hours ago → "Mar 17" (or equivalent date).
- Unit Testing: `clientLoader` — mock `localStorage` and Sanity fetch; assert null lastViewedId → `{ entry: null }`; assert deleted entry → `{ entry: null }`; assert valid entry → `{ entry: ... }`.
- End-to-End Testing: Playwright — generate entry; reload page; assert entry's reading view is restored without re-submission.
- End-to-End Testing: Playwright — generate entry; soft-delete it; reload page; assert empty input state is shown.

**Deliverables**:
- `app/lib/utils/timestamp.ts` with unit tests
- Updated `home.tsx` `clientLoader` with session persistence
- `useTimestampRefresh` hook
- Updated `SidebarEntry.tsx` with timestamp display

**Success Criteria**:
- Timestamps update every 60 seconds; entries older than 24 hours show date format
- Page reload restores last-viewed entry; deleted last-viewed falls back to empty input state
- `pnpm type-check` passes with zero errors

---

### Milestone 8: Mobile Support

**Objective**: Implement all mobile-specific behaviors deferred from Milestones 3, 5, 6, and 7. This milestone consolidates mobile functionality into a single cohesive milestone to ensure focus and clarity.

**Weight**: 0.07

**Key Components**:
- `app/components/furigana/ReadingView.tsx` — mobile tap delegation with `.active` class toggle
- Updated `app/app.css` — `[data-view-mode="on-hover"] ruby.active rt` CSS rule
- `app/components/sidebar/SidebarEntry.tsx` — mobile trash icon visibility (always-visible via CSS)
- `app/components/sidebar/Sidebar.tsx` — hamburger icon trigger
- `app/components/layout/AppShell.tsx` — top-level layout component managing sidebar open state

**Architectural Focus**:
- **Decision 1 Resolution (Option B)**: Mobile tap delegation via a single delegated `click`/`touchstart` listener on the reading container; `event.target` walks up to the nearest `<ruby>` ancestor and toggles `.active` class. CSS reveals `rt` for `.active ruby` within a `[data-view-mode="on-hover"]` container.
- **Decision 2 Resolution (Option A)**: Single `Sidebar` component with CSS-controlled visibility. On mobile, render within a `Sheet` wrapper; hamburger icon trigger opens/closes the drawer.
- `@media (pointer: fine)` gates the `:hover` CSS rule to prevent touch hover sticky behavior; mobile tap delegation provides the full "On Hover" mode self-test experience on touch devices
- Mobile trash icon: always-visible via `flex md:hidden`; two separate icon instances (one for mobile, one for desktop) or CSS-only approach using opacity transitions

**Implementation Approach**:
- **Mobile Tap Delegation** (`ReadingView.tsx`):
  - Add a `useRef` on the reading container and attach one delegated `touchstart` + `click` listener (via direct DOM `addEventListener` in `useEffect`)
  - Handler: `event.target` walks up to nearest `<ruby>` ancestor via `closest('ruby')`, toggles `.active` class via `classList.toggle('active')`
  - On same word (second tap or tap elsewhere), the `.active` class is removed or toggled to reveal/hide `rt`
  - `useEffect` cleanup removes the listener on unmount

- **Mobile Trash Icon** (`SidebarEntry.tsx`):
  - Two icon instances: desktop version with `hidden md:group-hover:flex` (hover-reveal), mobile version with `flex md:hidden` (always visible)
  - Or: single icon with conditional classNames: `hidden md:opacity-0 md:group-hover:opacity-100` for desktop, `opacity-100 md:hidden` for mobile

- **Mobile Sidebar Drawer** (`AppShell.tsx`):
  - `AppShell` manages `sidebarOpen: boolean` state
  - On mobile (`<md`), wrap `Sidebar` in a `Sheet` component with `open`/`onOpenChange` props
  - On desktop (`md:`), render `Sidebar` directly in the fixed column layout
  - Sidebar entry click calls `onOpenChange(false)` to close drawer on mobile

- **CSS Updates** (`app/app.css`):
  - Add rule for `.active ruby rt` visibility:
    ```css
    [data-view-mode="on-hover"] ruby.active rt {
      visibility: visible;
      opacity: 1;
    }
    ```

**Test Strategy**:
- End-to-End Testing: Playwright (mobile viewport emulation) — set mode to "On Hover"; tap a `<ruby>` element; assert `<rt>` becomes visible. Tap elsewhere; assert `<rt>` is hidden.
- End-to-End Testing: Playwright (mobile viewport) — assert trash icon is visible without hover; click icon; assert row disappears.
- End-to-End Testing: Playwright (mobile viewport) — tap hamburger; assert sidebar drawer opens; tap entry; assert drawer closes and entry loads.
- End-to-End Testing: Playwright (mobile viewport) — tap hamburger; tap outside drawer; assert drawer closes.
- End-to-End Testing: Playwright (desktop) — verify that mobile-specific CSS and drawer are not present or active.

**Deliverables**:
- Updated `ReadingView.tsx` with mobile tap delegation
- Updated `SidebarEntry.tsx` with mobile trash icon visibility
- Updated `Sidebar.tsx` with mobile drawer integration
- `app/components/layout/AppShell.tsx` new layout component
- Updated `app/app.css` with mobile-specific CSS rules

**Success Criteria**:
- Mobile "On Hover" mode reveals `<rt>` on tap and hides on second tap or tap-elsewhere
- Mobile trash icon is always visible; desktop trash icon appears on row hover
- Mobile sidebar drawer opens/closes correctly; tap-outside dismisses
- Mobile inline editing is not available (no edit affordance)
- Desktop behavior is unchanged from Milestones 3–7
- `pnpm type-check` passes with zero errors

---

## Dependency and Conflict Analysis

**Milestone Dependencies**:

- Milestone 1 → Milestone 2: Milestone 2 requires the annotation string returned by Milestone 1's `action`. Sanity schema and storage are layered on top of the existing action; `entryId` is added to the action response.
- Milestone 1 → Milestone 3: Milestone 3 requires `ReadingView` from Milestone 1 to exist and accept a `viewMode` prop. Can begin as soon as Milestone 1 `ReadingView` is stable.
- Milestone 2 → Milestone 4: Milestone 4 requires `entryId` in the action response (Milestone 2) and a Sanity PATCH endpoint. Cannot start until Milestone 2 is complete.
- Milestone 2 → Milestone 5: Milestone 5 requires the Sanity `entry` document to exist with a `deletedAt` field. The schema can be defined in Milestone 2 with `deletedAt` already included, allowing Milestone 5 to begin without a schema migration.
- Milestone 2 → Milestone 6: Milestone 6 requires sidebar entries and a PATCH action pattern established in Milestone 4. Depends on both Milestone 2 and Milestone 4.
- Milestone 2 → Milestone 7: Session persistence (7b) requires Sanity entry fetching established in Milestone 2. Timestamp utility (7a) can be written and unit-tested in parallel.
- Milestone 1 → Milestone 7a: Timestamp display requires sidebar entries (Milestone 2), but the `formatTimestamp` utility and hook can be written and unit-tested during Milestone 1 or in parallel.
- Milestone 7 → Milestone 8: Milestone 8 requires all feature milestones (1–7) to be complete; mobile behavior is additive on top of the full desktop feature set.

**Sequential Critical Path**:
```
Milestone 1 → Milestone 2 → Milestone 4 → Milestone 6
                 ↓
              Milestone 5
                 ↓
              Milestone 7a, 7b (can run in parallel after Milestone 2)
Milestone 3 (can run in parallel after Milestone 1)
Milestone 8 (after Milestone 7 complete)
```

**Parallel Work Opportunities**:
- Milestone 3 (view mode toggle) can begin immediately after Milestone 1 ships `ReadingView`, in parallel with Milestone 2
- Milestone 7a (`formatTimestamp` utility) can be written and tested during any milestone
- Milestones 7a and 7b can all run in parallel with each other once Milestone 2 is complete
- Milestone 5 and Milestone 6 are independent of each other and can run in parallel after Milestone 2 (and Milestone 4 for Milestone 6)
- Milestone 8 must follow Milestone 7; all mobile consolidation happens in this milestone

**Critical Bottlenecks**:

- **Milestone 2 is the central dependency hub.** Sanity schema must include `deletedAt` from the start to avoid a schema migration when Milestone 5 is implemented. Define `title` as nullable (`string | null`) from the start as well, to avoid a Milestone 4 migration.
- **GPT-4o-mini prompt quality gates Milestones 1 and 4.** If the system prompt for furigana generation is not stable by end of Milestone 1, Milestone 4's title prompt will compound the instability. Allocate time for prompt iteration in Milestone 1.
- **Sanity free tier limits.** The integration test strategy requires a Sanity test dataset. The free tier allows up to 10,000 documents across all datasets in a project — use a dedicated `test` dataset for integration tests, cleaned up after each test run, to avoid polluting the main dataset and consuming the document quota.
- **TypeScript strict mode throughout.** `exactOptionalPropertyTypes` means optional Sanity response fields require explicit `| undefined` in Zod schemas. Validate Zod schemas for all GROQ responses in Milestone 2 before dependent milestones build on them.

**External Dependencies**:
- **OpenAI API**: GPT-4o-mini is the only AI dependency. Pay-as-you-go billing must be enabled before Milestone 1 integration tests can run against the live API. Rate limits (tokens per minute) are unlikely to be hit at development volume.
- **Sanity**: Free project creation requires a Sanity account. The free tier's 10,000-document limit is ample for personal-use MVP development. Sanity API availability is outside the developer's control; integration tests should use mocks for CI reliability and only hit the live Sanity API in a dedicated integration test suite.
- **shadcn/ui components**: `Sheet`, `Toast`/`Sonner`, and `ToggleGroup` may not yet be installed. Each is added with `pnpx shadcn@latest add <component> --defaults` as needed per milestone.
- **Vitest and Playwright**: Not yet in `package.json`. Both must be added as dev dependencies before Milestone 1 testing begins.

---

## Implementation Notes

**Key Architectural Decisions Made in This Roadmap**:
- Mobile tap behavior: Option B (event delegation with `.active` class toggle) — implemented in Milestone 8 to deliver the full "On Hover" self-test experience on mobile without per-element event listeners.
- Sidebar rendering: Option A (single component, CSS-controlled visibility) — SSR-compatible, simpler state model. Mobile drawer integration deferred to Milestone 8.
- Sanity read strategy: Option B (`clientLoader` for sidebar list) — **preferred**. Sidebar renders a skeleton UI during the loading state to prevent flash of empty content; `lastViewedEntryId` resolves in the same round trip.

**Sanity Schema — Define Completely in Milestone 2**:
The `entry` document schema must include all fields from day one to avoid migrations:
```
{
  _id: string,
  _type: 'entry',
  rawText: string,
  annotationString: string,
  title: string | null,        // null until AI title generation completes
  createdAt: string,           // ISO 8601
  deletedAt: string | null,    // null until soft-deleted
}
```

**XSS Prevention**:
The annotation string parser in Milestone 1 is the only point where external data (AI output) is transformed into HTML. The parser must produce only `<ruby>`, `<rt>`, `<rp>`, and text nodes — never raw HTML passthrough. React's JSX rendering (not `dangerouslySetInnerHTML`) is the safe rendering path.

**Known Risks and Mitigations**:
- AI format non-compliance (missing braces, extra prose): server-side validation in the `action` before Sanity write; retry with stricter prompt on format failure; surface error to user if retry also fails.
- Sanity public dataset exposure: document as a known limitation in `README.md`; accept for MVP personal-use scope.
- SSR hydration mismatch from `localStorage`: enforced by always reading in `clientLoader`, never in component body — verify with React strict mode enabled in development.
- Japanese font rendering gap: add `Noto Sans JP` as a web font import for Japanese text specifically; the existing Geist Variable font covers Latin but not CJK glyphs.

**Assumptions**:
- A single engineer implements all milestones sequentially; parallel milestone opportunities are noted for future team growth.
- Sanity free tier document and API request limits are not a constraint at MVP development and personal-use production volume.
- No CI/CD pipeline is in place yet; Vitest unit tests and Playwright end-to-end tests are run locally until a pipeline is configured.
- Trash retention: no auto-purge in MVP — entries remain in Trash until "Empty Trash" is explicitly triggered.
- The `openai` npm package is the sole AI SDK; no second provider SDK is installed.

---

## Appendix

### Project Context

**Technology Stack**:
- React Router v7 (SSR enabled, `ssr: true`)
- React 19, TypeScript 5.8 (strict mode: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSchemaIndexSignature`)
- Tailwind CSS v4 (CSS-first config via `app/app.css`)
- shadcn/ui components in `app/components/ui/` (currently: `button`, `card`)
- Zod v4 for schema validation
- Lucide React for icons
- Geist Variable as primary UI font
- Vite 7, `vite-tsconfig-paths`, `~/ → app/` path alias
- Husky + lint-staged pre-commit hooks (ESLint + Prettier)

**Existing Patterns to Follow**:
- Route files export typed `loader`, `clientLoader`, `action`, and default component — use `satisfies RouteConfig` pattern from `routes.ts`
- Import types with `import type {}` inline style (ESLint `consistent-type-imports` enforced)
- No `any`, no `as` type casts — use `satisfies` operator or proper generics
- `useEffect` reserved for cases with no loader/action equivalent (recurring timers, DOM event listener attachment)
- `useFetcher` for follow-up async calls after action completion

**Key Constraints**:
- `OPENAI_API_KEY`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN` must never carry the `VITE_` prefix — server-only env vars
- All Sanity write operations go through server-side `action` functions
- Parser output must be structured tokens, never raw HTML strings passed to `dangerouslySetInnerHTML`
- Mobile inline title editing is explicitly out of scope for MVP
- Zod enum parse must be used for type-safe view mode validation (not `as` casts per project rules)
