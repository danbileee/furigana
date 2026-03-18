# PRD Review: Furigana MVP — AI Japanese Reading Assistant

**Date:** 2026-03-17
**Status:** Feasible with Considerations

---

## Executive Summary

The Furigana MVP is technically well-scoped and achievable as a solopreneur project. The core loop — paste Japanese text, generate furigana via an AI model, display `<ruby>` annotations, persist entries in a CMS — maps cleanly onto the React Router v7 + SSR stack already in place. No requirement is fundamentally infeasible.

Several decisions have been made explicit in the updated PRD: the default view mode is "Always," the character limit is 10,000 characters (UI-enforced with a counter and disabled submit), inline title editing is desktop-only, the Undo pattern has been replaced by a soft-delete Trash Menu, and the annotation storage format is the raw `漢字{よみ}` string. Two primary decisions remain open: which AI provider to use (GPT-4o-mini is the preferred choice based on cost and format compliance) and which storage backend to use (Sanity free tier via a per-user `.env` API key pattern is the preferred choice). One mobile UX consideration around the "On Hover" mode still requires attention.

---

## Requirement Analysis

### 1. Furigana Generation via AI

**Feasibility:** Moderate Complexity
**Key Dependencies:** AI model provider API, server-side route handler or edge function

**Analysis:**

Furigana generation requires an AI model that can reliably identify every kanji or kanji compound in arbitrary Japanese text, then output a reading annotation in the format `今日{きょう}は天気{てんき}がいい。` This is a structured output task over a multilingual input. The result must then be parsed into HTML `<ruby>` tags on the client or server.

The generation step is best done server-side (in a React Router `action` function) to protect the API key and to avoid CORS issues. The response should be streamed or returned as a single string. Since SSR is already enabled in this project, an `action` in a route file is the natural integration point.

The parsing step — converting `今日{きょう}` into `<ruby>今日<rp>(</rp><rt>きょう</rt><rp>)</rp></ruby>` — is a straightforward regex-based transform. The pattern is: find all occurrences of `{kanji}{reading}` and wrap them. Non-annotated text between annotations passes through as plain text nodes. This parser should be written once and unit-tested, as malformed AI output (e.g., missing closing braces, nested braces, or romanized readings mixed with hiragana) can break the display if not handled defensively.

**AI Model Options — Comparison Table:**

| | **GPT-4o-mini** *(preferred)* | **Claude Haiku 4.5** | **Gemini 2.5 Flash** |
|---|---|---|---|
| **Input cost (per 1M tokens)** | $0.15 | $1.00 | $0.30 |
| **Output cost (per 1M tokens)** | $0.60 | $5.00 | $2.50 |
| **Context window** | 128k tokens | 200k tokens | 1M tokens |
| **Latency** | Fast | Fastest | Fast |
| **Japanese accuracy** | High — GPT-4o family has strong CJK coverage; mini variant retains most of this for structured tasks | High — Claude models have strong multilingual instruction following; Haiku 4.5 is tuned for speed with near-frontier intelligence | High — Gemini 2.5 Flash has strong Japanese support and a generous free tier for prototyping |
| **Structured output / format compliance** | Excellent — supports JSON mode and system prompt constraints reliably | Excellent — follows structured formatting instructions precisely | Good — follows instructions but can occasionally add prose around structured output |
| **Free tier for prototyping** | No free tier; pay-as-you-go from first request | No free tier; pay-as-you-go from first request | Yes — Gemini 2.5 Flash has a free tier (rate-limited) |
| **SDK / integration ease** | Excellent — `openai` npm package, minimal setup | Excellent — `@anthropic-ai/sdk` npm package, minimal setup | Good — `@google/genai` npm package; slightly more verbose setup |
| **Estimated cost per 1,000-word article** (approx. 1,500 input tokens, 800 output tokens) | ~$0.00070 | ~$0.0055 | ~$0.0025 |

**Preferred choice: GPT-4o-mini.** It is the lowest-cost option in production at solopreneur scale (~$0.00070 per article), demonstrates excellent format compliance with system prompt constraints (critical for the `漢字{よみ}` structured output task), and has strong CJK coverage that is more than sufficient for standard Japanese furigana annotation. Claude Haiku 4.5 and Gemini 2.5 Flash remain viable alternatives — Haiku 4.5 for its fastest-in-class latency and Gemini 2.5 Flash for zero-cost prototyping — but GPT-4o-mini is the recommended path to production.

**Notes on accuracy for this specific task:** All three models perform well on standard Japanese furigana annotation. The key variable is format compliance — the model must reliably output `漢字{よみ}` notation without wrapping it in markdown code fences, adding commentary, or omitting annotations for uncommon kanji. GPT-4o-mini and Claude Haiku 4.5 both show strong instruction-following discipline in structured output tasks; a well-crafted system prompt with one or two few-shot examples will lock in the format reliably. Gemini 2.5 Flash is slightly more verbose in raw output and may require a stricter prompt to suppress prose additions.

**Recommendation to consider:** Use the same model for both furigana generation and AI title generation to reduce provider surface area. Both tasks are low-token, structured-output calls.

**Implementation Approaches:**

- **Option A: Single API call with system prompt + few-shot examples** — Send the raw Japanese text as user content; system prompt instructs the model to annotate every kanji compound using `漢字{よみ}` notation and return only the annotated text with no other content. Pros: simple, predictable output. Cons: very long articles (10,000+ characters) may approach context limits for GPT-4o-mini (128k tokens is ample for all practical article lengths at the 10,000-character UI cap).
- **Option B: Structured JSON output** — Request the model to return a JSON array of `{ "text": "今日", "reading": "きょう" }` objects, then assemble the ruby HTML from the array. Pros: easier to parse, more fault-tolerant. Cons: higher output token count (roughly 3–4x), higher cost.

Option A is strongly preferred for this use case given the low cost sensitivity of solopreneur scale and the simplicity of parsing.

**Considerations:**

- The PRD specifies a 10,000-character limit enforced in the UI with a character counter and disabled submit button. This also serves as the effective server-side input cap, preventing runaway API costs on very long submissions.
- The PRD does not specify whether furigana is generated for all kanji or only for kanji above a certain JLPT difficulty threshold. For MVP, annotating all kanji is simpler and safer.
- The AI result format `今日{きょう}` must be validated on the server before storing it. Malformed output stored in the CMS will result in a broken reading view on reload.

---

### 2. Furigana Rendering with `<ruby>` Tags

**Feasibility:** Straightforward
**Key Dependencies:** HTML `<ruby>` element (97.5% global browser support), CSS for annotation styling

**Analysis:**

The HTML `<ruby>` element with `<rt>` (reading text) and `<rp>` (ruby parentheses fallback) is the correct semantic approach and has broad browser support. The target markup is:

```html
<ruby>今日<rp>(</rp><rt>きょう</rt><rp>)</rp></ruby>は
<ruby>天気<rp>(</rp><rt>てんき</rt><rp>)</rp></ruby>がいい。
```

The `<rp>` tags provide parenthetical fallback text in browsers without ruby support (approximately 2.5% of users based on caniuse data as of this review). This is best practice and already implied by the PRD format.

**Parsing implementation:** A regex-driven transform function reads the AI output string and replaces each `漢字{よみ}` token with the ruby HTML. A safe implementation iterates through the string character by character or uses a regex like `/([^\{]+)\{([^\}]+)\}/g` to capture kanji and reading pairs. Text segments between annotations are output as plain text nodes.

**Typography considerations:** Ruby annotations significantly increase effective line height. The PRD correctly calls out that "font size, line height, and ruby spacing are tuned for comfortable sustained reading." This requires explicit CSS — `line-height` alone is not sufficient; `ruby-position: over` (CSS3) and ensuring `<rt>` font size is approximately 50% of the base kanji font size are the key variables. These are CSS-only concerns with no JavaScript dependency.

**Tailwind v4 and shadcn/ui note:** There are no shadcn/ui components for ruby annotation rendering. This is a custom Tailwind implementation using CSS classes applied to the `<ruby>` and `<rt>` elements. Tailwind v4 uses CSS custom properties natively, so ruby-specific spacing variables can be defined in the CSS entrypoint (`app.css`) and referenced via `@theme`.

**Annotation storage format (decided):** The raw annotation string — `今日{きょう}は天気{てんき}がいい。` — is the definitive storage format. The ruby HTML is generated at render time from this string via the regex parser. This approach is more compact than storing HTML, is not subject to XSS risks from stored HTML content, and remains portable if the rendering logic changes. HTML is never stored.

**Considerations:**

- The PRD states "each kanji (or kanji compound) shows its hiragana reading." This implies the parser must handle compound kanji (e.g., `天気` annotated as a unit with `てんき`, not `天` + `気` individually). The AI model is best instructed to handle this naturally via examples in the system prompt — compound readings are idiomatic and should not be split.
- The PRD specifies "non-kanji characters are displayed without annotation." This is handled by the parser: text segments that are not wrapped in `漢字{よみ}` tokens pass through as plain text, which is the natural output of the regex replacement.

---

### 3. View Mode Toggle — Always / On Hover

**Feasibility:** Moderate Complexity (with a mobile-specific caveat)
**Key Dependencies:** CSS `:hover` pseudo-class, CSS class toggling via React state, `clientLoader` for preference persistence

**Analysis:**

**Desktop ("Always" and "On Hover"):** This is well-suited to a CSS-only implementation. A class on the reading view container (e.g., `data-mode="always"` or `data-mode="on-hover"`) controls whether `<rt>` elements are visible. In "On Hover" mode, `rt` is hidden by default and revealed via `:hover` on the parent `<ruby>` element:

```css
/* On Hover mode */
[data-mode="on-hover"] ruby rt {
  visibility: hidden;
  opacity: 0;
}
[data-mode="on-hover"] ruby:hover rt {
  visibility: visible;
  opacity: 1;
}
```

The toggle switch updates React state, which sets the data attribute or class on the container. No re-render of the annotation content is needed — the annotation HTML is stable; only the CSS rule activation changes. This satisfies the PRD requirement that "the change is visual only — the underlying annotation data is already present."

**Mobile ("On Hover" via tap):** This is the key complexity point. On mobile touch devices, `:hover` behaves inconsistently across browsers. In iOS Safari and most Android browsers, `:hover` is triggered by tap and persists until the user taps elsewhere — this is called "sticky hover." The practical behavior is that tapping a `<ruby>` word reveals its `<rt>`, but the reveal persists until another tap, which is actually acceptable UX for self-testing. However, the PRD specifies "taps it (mobile)" as the interaction — this matches the sticky hover behavior.

The risk is that some mobile browsers apply `:hover` to the entire page on first tap, inadvertently revealing all furigana at once. This can be mitigated with a media query: apply the `:hover` logic only on devices that support fine pointers (i.e., mouse/trackpad), and use a different interaction model on touch devices.

A more reliable mobile approach uses JavaScript: attach a `touchstart` or `click` handler to each `<ruby>` element that toggles a `.active` class, and CSS reveals `<rt>` for `.active ruby`. This introduces a small amount of JS but eliminates cross-browser inconsistency. The PRD says "no JS re-render," which is satisfied here — no re-render occurs, only a class toggle on an individual element.

**Option A: Pure CSS with `:hover` and media queries** — Simplest to implement; relies on browser sticky hover. Works acceptably on iOS Safari and Chrome for Android. Risk: inconsistent reveal behavior across older Android browsers.

**Option B: CSS class + minimal JS touch handler per `<ruby>` element** — Slightly more code, but deterministic and testable. Recommended for production quality.

**Preference persistence:** The mode preference ("always" vs. "on-hover") is persisted in `localStorage`. On route load, the preference should be read in a `clientLoader` (not `useEffect`) — this is the React Router v7 idiomatic approach for client-only data reads. Since `localStorage` is unavailable during SSR, the `clientLoader` runs only on the client and provides the stored preference to the component before first render, avoiding hydration mismatches.

```typescript
// In the route file
export async function clientLoader() {
  const viewMode = localStorage.getItem('viewMode') ?? 'always';
  return { viewMode };
}
```

**Considerations:**

- The PRD defines the default mode for first-time users as "Always." This is reflected in the `clientLoader` fallback above (`?? 'always'`).
- The CSS approach means `<rt>` elements are always in the DOM regardless of mode, which is correct — screen readers benefit from this, and it avoids layout shifts when toggling.

---

### 4. History Sidebar and Entry Storage

**Feasibility:** Moderate Complexity
**Key Dependencies:** CMS or storage backend for CRUD operations, React state for sidebar active state

**Analysis:**

Each history entry requires storing: a unique ID, the raw annotation string, the original text, the AI-generated title (or placeholder), a created-at timestamp, a soft-delete flag with deletion timestamp, and the active/trash state. The total data volume per user is low — a typical user will have at most dozens of entries, each a few kilobytes of annotated text.

The PRD specifies no user authentication (out of scope). The intended architecture uses environment variables (`.env`) to hold the Sanity project ID, dataset name, and API token — meaning each deployment gets its own isolated Sanity workspace. This is a per-developer/per-deployment isolation model, not a shared multi-tenant namespace. See the Decision Framework section for a full analysis of this approach.

**CMS Options — Comparison Table:**

| | **Sanity (Free Tier)** *(preferred)* | **Directus (Self-Hosted)** | **Contentful (Free Tier)** |
|---|---|---|---|
| **Free tier** | Yes — 250k API requests/mo, 1M CDN requests/mo, 10k documents, 100GB assets | Yes — fully free to self-host; infrastructure cost only (e.g., Railway ~$5/mo) | Yes — 100k API calls/mo, 25 content types, 10 users |
| **Developer experience** | Excellent — GROQ query language is powerful; Studio UI for data inspection; strong TypeScript SDK | Excellent — auto-generated REST + GraphQL from any SQL schema; no vendor lock-in; familiar SQL mental model | Good — REST and GraphQL APIs; content modeling UI is polished but less flexible |
| **API quality** | High — GROQ enables complex queries in a single request; real-time via Live Connections (1k concurrent on free) | High — REST and GraphQL both auto-generated; direct SQL access possible for complex queries | Good — REST and GraphQL; limited filtering compared to GROQ or SQL |
| **Real-time capability** | Yes — Live Connections (WebSocket-based) included on free tier | Yes — Directus supports WebSocket subscriptions and Server-Sent Events | Limited — webhooks available but no built-in real-time push |
| **Fit for this use case** | Strong — document storage with rich content, fast CDN, real-time title updates; free tier is generous for a solopreneur MVP; per-deployment isolation via `.env` API keys eliminates the shared-namespace problem | Strong — full control; no rate limit surprises; easy to add columns as requirements evolve; slightly more ops overhead | Moderate — 100k API calls/mo may be tight under heavy use; content modeling is more editorial-focused than developer-data-focused |
| **Vendor lock-in** | Medium — GROQ is Sanity-specific; migrating requires rewriting queries | Low — data in standard SQL; switch databases or providers without schema migration | Medium — content model and API are Contentful-specific |
| **Maintenance burden (solopreneur)** | Low — fully managed; no infra to maintain | Medium — requires a server or PaaS deployment; Docker image is available but needs occasional updates | Low — fully managed |
| **Private datasets on free tier** | No — free tier only supports public datasets | Yes — full access control on self-hosted | Yes |

**Key consideration for this use case:** See Decision 1 for a full analysis of the `.env`-based per-deployment Sanity approach and its trade-offs.

**Implementation Approaches:**

- **Option A: Sanity free tier (preferred)** — Persistent cloud storage, real-time title updates, generous free limits. Each deployment uses its own Sanity project via `.env` credentials, eliminating shared-namespace concerns. Requires a Sanity project setup and GROQ query integration. Adds a network round-trip on every read/write.
- **Option B: localStorage / IndexedDB (client-side only)** — Zero backend cost, no API key, no rate limits. Use IndexedDB (via the `idb` library) for structured queries and larger data. Loses data on browser storage clear. Suitable as a fallback or for offline-first variations.
- **Option C: Directus self-hosted** — Most control; suits a builder who wants a proper API layer. Requires Docker or Railway deployment (~$5/mo). Best for projects expecting to grow into multi-user scenarios.

---

### 5. AI Title Generation

**Feasibility:** Straightforward
**Key Dependencies:** AI model (same provider as furigana generation), async follow-up request

**Analysis:**

Title generation is a secondary request made after the furigana result is returned to the client. The PRD specifies the title is generated "in the background — after the furigana result is displayed." In React Router v7, the idiomatic pattern for a follow-up async operation triggered after a primary action completes is a separate `action` call or a `clientLoader` on a subsequent navigation — not a `useEffect`. The recommended implementation is to fire a second `fetch` to a dedicated title-generation route (e.g., `POST /api/title`) from the component that receives the furigana `action` response, using a `useFetcher` hook from React Router. `useFetcher` manages the async lifecycle (loading, data, error) without requiring a `useEffect` and integrates cleanly with React Router's data model.

```typescript
// In the component, after furigana action completes:
const titleFetcher = useFetcher();

// Trigger title generation after furigana result arrives:
titleFetcher.submit({ text: submittedText, entryId }, { method: 'POST', action: '/api/title' });
```

The placeholder (first ~30 characters) is shown immediately; when the title fetcher response resolves, it replaces the placeholder via `titleFetcher.data`.

**Considerations:**

- The PRD requires the title to update "without a layout shift." This means the sidebar row's height must be consistent between placeholder and title states — achieved by setting a fixed line height and `min-height` on the title element, and using CSS transitions for the text swap.
- The same AI model used for furigana generation should handle title generation to avoid a second provider setup. The call is tiny: ~500–800 input tokens (the Japanese text excerpt) and ~20 output tokens (the title). Cost is negligible.
- If the title call fails, the PRD specifies the 30-char placeholder becomes permanent. This means the entry schema must support a `title` field that may be null (replaced by the truncated original text in the UI layer). For MVP, storing only the final title string and using null as the "use placeholder" state is sufficient — no additional status flag is needed.

---

### 6. Inline Title Editing

**Feasibility:** Straightforward
**Key Dependencies:** React controlled input, CMS PATCH/update API

**Analysis:**

Double-click on a sidebar row title activates an `<input>` element pre-filled with the current title. The double-click event on the title text swaps the display element for an `<input>` (React state toggle). `onBlur` and `onKeyDown` (Enter/Escape) handlers manage confirmation and cancellation. This is a standard React pattern.

The PRD specifies this interaction is **desktop-only**. Mobile title editing is explicitly deferred to a post-MVP iteration. This resolves the previous open question about mobile inline title editing affordance — no mobile gesture needs to be specified for this version.

The PRD specifies that blank submissions silently restore the previous title. This is a client-side validation — `onBlur`/`onKeyDown` check `value.trim().length > 0` before dispatching the save action.

**Considerations:**

- The double-click handler must not conflict with single-click (which loads the entry). This requires `onDoubleClick` on the title text specifically, not on the entire row. The row's `onClick` should not fire when `onDoubleClick` fires — React's synthetic event system handles this correctly since `dblclick` fires after `click`, but care is needed to prevent the row `onClick` from navigating away mid-edit.
- If a CMS is used, the title update is a PATCH request to the entry's record. The UI should optimistically update the sidebar (update state immediately, then confirm with the server) to feel instant.

---

### 7. Delete Entry with Trash Menu

**Feasibility:** Moderate Complexity
**Key Dependencies:** CMS soft-delete support (deletedAt field), shadcn/ui Sheet or Dialog for Trash Menu panel, toast notification

**Analysis:**

The PRD now uses a soft-delete Trash Menu pattern instead of the previous 4-second timed undo. The delete flow is:

1. User hovers a sidebar row on desktop — a trash icon appears.
2. Clicking the icon immediately removes the row from the sidebar and shows an "Entry deleted" toast.
3. The deleted entry is moved to a soft-delete trash store (a `deletedAt` timestamp is set on the record; the entry is not destroyed).
4. A trash icon at the bottom of the left sidebar opens the Trash Menu — a list of soft-deleted entries with title and deletion timestamp.
5. From the Trash Menu, users can restore individual entries (returned to original chronological position) or permanently delete them. An "Empty Trash" option permanently removes all trash entries.

This replaces the previous internal contradiction: "Undoing history deletion" is no longer listed as out of scope, and the 4-second timer undo pattern is removed. The Trash Menu pattern is the authoritative delete/restore mechanism.

**Implementation notes:**

- The entry schema requires a `deletedAt: datetime | null` field. All sidebar list queries must filter `deletedAt == null`. The Trash Menu query filters `deletedAt != null`.
- Permanent deletion from the Trash is a hard-delete API call.
- Restoring an entry clears `deletedAt` and returns the entry to its original `createdAt` position in the sidebar sort order.
- On mobile, the trash icon is visible at all times on each sidebar row (no hover affordance on touch devices), per the PRD's UI considerations.

**Considerations:**

- The PRD specifies a retention period for Trash entries ("after a reasonable retention period — to be determined in implementation"). For MVP, this can be deferred (entries stay in Trash until explicitly emptied). A background cleanup job or a TTL-based purge can be added later.
- The Trash Menu can be implemented with a shadcn/ui `Sheet` component (slide-in panel) — the same component used for the mobile sidebar drawer — to keep the component footprint consistent.
- If the currently viewed entry is deleted, the main view immediately falls back to the next most recent entry (or the empty input state if none remain), per the PRD's edge case spec.

---

### 8. Session Persistence (Last-Viewed Entry Restoration)

**Feasibility:** Straightforward
**Key Dependencies:** `localStorage` for last-viewed entry ID, `clientLoader` for reading on page load

**Analysis:**

On page load, the app reads a `lastViewedEntryId` from `localStorage`, fetches that entry from the storage backend, and renders the furigana view. Per the updated PRD, if the key is absent, the entry no longer exists, or the entry is in the Trash (soft-deleted), the app falls back to the empty input state.

In React Router v7, the correct place to read `localStorage` on page load is a `clientLoader` — not `useEffect`. The `clientLoader` runs on the client after SSR hydration, provides data to the component before first render, and avoids the hydration mismatch risk that comes from reading `localStorage` in component body or in `useEffect`. Since `localStorage` is unavailable during SSR, the server renders the empty input state; the `clientLoader` then resolves the last-viewed entry on the client.

```typescript
// In the route file
export async function clientLoader() {
  const lastViewedId = localStorage.getItem('lastViewedEntryId');
  if (!lastViewedId) return { entry: null };
  const entry = await fetchEntry(lastViewedId); // fetches from CMS or IndexedDB
  if (!entry || entry.deletedAt) return { entry: null }; // handles deleted entry case
  return { entry };
}
```

If the brief flash of the empty input state before the `clientLoader` resolves is undesirable, a session cookie (set on the client, read during SSR) could carry the last-viewed ID server-side — but this adds complexity for a marginal UX gain and is not recommended for MVP.

**Considerations:**

- "Last-viewed" means the entry the user most recently opened in the sidebar, not the most recently created entry. This requires updating `lastViewedEntryId` in `localStorage` every time a sidebar entry is clicked or a new generation completes.
- The PRD specifies that if the last-viewed entry has been deleted (moved to Trash), the app falls back to the empty input state. The `clientLoader` handles this by checking `entry.deletedAt` before returning the entry.
- The PRD says "Reloading the page restores the last-viewed entry, including its rendered furigana, without requiring re-submission." If the annotation string is stored in the CMS/IndexedDB, the furigana HTML can be regenerated from it instantly on load — no AI re-call needed.

---

### 9. Mobile Sidebar Drawer

**Feasibility:** Straightforward
**Key Dependencies:** CSS media queries, React state for open/closed, shadcn/ui Sheet component

**Analysis:**

The shadcn/ui library includes a `Sheet` component that implements a slide-in drawer overlay. This is the correct component for the mobile sidebar. It handles focus trapping, backdrop click dismissal, and animation out of the box. The hamburger icon (e.g., `Menu` from `lucide-react`) toggles the sheet open state.

The PRD specifies: "Tapping a sidebar entry or tapping outside the drawer closes it." Both behaviors are native to the shadcn/ui `Sheet` component — `onOpenChange` is called on outside clicks, and the entry click handler can call `setOpen(false)` before navigating.

**Considerations:**

- The desktop sidebar is always visible; the mobile drawer is a separate layout mode. This is a responsive layout concern — at the desktop breakpoint, the sidebar renders as a fixed column; below that breakpoint, it is unmounted (or hidden via CSS) and replaced by the `Sheet`. Two approaches: (a) render one sidebar component and control visibility purely via CSS (simpler, sidebar is always in the DOM); (b) conditionally render the sheet component only on mobile (cleaner, but requires a `useMediaQuery` hook or a React Router client-side breakpoint detection).

---

### 10. Relative Timestamps

**Feasibility:** Straightforward
**Key Dependencies:** `date-fns` or `Intl.RelativeTimeFormat`

**Analysis:**

The PRD specifies timestamps that update over time (e.g., "just now" → "5 minutes ago") and switch to absolute dates after 24 hours (e.g., "Mar 15"). This is implementable with `Intl.RelativeTimeFormat` (no external library) or `date-fns/formatDistanceToNow`.

For timestamps to update automatically, a `setInterval` running every 60 seconds re-computes the display string for all sidebar entries. This is a small performance concern if the sidebar has hundreds of entries, but negligible at MVP scale. This is one case where `useEffect` remains appropriate — the interval is a side effect that belongs in `useEffect` since there is no loader or action equivalent for a recurring UI timer.

**Considerations:**

- `Intl.RelativeTimeFormat` is natively available in all modern browsers targeted by this project. No external library dependency is needed.
- The switch from relative ("5 minutes ago") to absolute ("Mar 15") at the 24-hour boundary requires a conditional: if `Date.now() - entry.createdAt > 24 * 60 * 60 * 1000`, format with `Intl.DateTimeFormat` instead. The format "Mar 15" (abbreviated month + day, no year) should use `{ month: 'short', day: 'numeric' }` options.

---

## Cross-Requirement Analysis

### Integration Points

- **AI model → annotation string → CMS:** The server action that calls the AI model produces the annotation string. That string is written to the CMS/storage in the same action. The client receives the annotation string in the action response and renders it immediately — no second fetch needed.
- **AI title → CMS update:** Title generation is a secondary async call using `useFetcher`. The title is written to the CMS as a PATCH on the existing entry record. The sidebar listens for this update (via local state from `useFetcher.data`, polling, or CMS real-time subscription) and updates the placeholder.
- **Last-viewed ID → localStorage → session restoration:** Decoupled from the CMS — `localStorage` holds only the ID, and the entry content is fetched from the CMS on load via `clientLoader`.
- **View mode preference → localStorage:** Fully client-side; read via `clientLoader` on route load.
- **Soft-delete → Trash Menu → restore:** Delete sets `deletedAt` on the record; Trash Menu queries for `deletedAt != null`; restore clears `deletedAt`. All sidebar list queries filter `deletedAt == null`.

### Data Flow and Architecture

```
User input (textarea, max 10,000 chars)
  → React Router action (server)
    → AI model API (furigana generation)
    → CMS write (entry: id, raw text, annotation string, created_at, title: null, deletedAt: null)
    → Response to client (annotation string)
  → Client renders ruby HTML from annotation string
  → useFetcher fires background title POST to /api/title
    → AI model API (title generation)
    → CMS PATCH (entry: title)
    → Sidebar updates via useFetcher.data

On page load (clientLoader):
  localStorage.getItem('lastViewedEntryId')
    → CMS read (entry by ID)
    → Check: entry exists AND deletedAt == null
    → Render ruby HTML from annotation string (or fall back to empty input state)

On Trash Menu open:
  CMS read (entries where deletedAt != null)
  → Display restore / permanent delete actions
```

---

## Decision Framework

### Decision 1: Storage Backend

**What needs to be decided:** Where do entry records live — client-only storage (IndexedDB/localStorage), or a backend CMS?

**Preferred choice: Sanity free tier** via the `.env`-based per-user workspace pattern (described below).

**The `.env` API key pattern — architectural assessment:**

The proposed approach stores the Sanity project ID, dataset name, and API token in `.env` environment variables. Each developer or deployer sets up their own Sanity project and provides their own credentials. This means:

- **Isolation by design:** Each deployment gets a completely separate Sanity workspace. There is no shared namespace problem — user A's entries are in a different Sanity project than user B's entries. The earlier concern about entries from different users being visible to each other disappears entirely.
- **Architectural soundness:** This is a well-established pattern for self-serve developer tools and personal-use apps. It is architecturally clean: the app is stateless with respect to storage credentials; the storage backend is fully controlled by the operator. Comparable to how a self-hosted Ghost blog or a personal Notion integration works.
- **API token security in React Router SSR:** In React Router v7 with SSR, environment variables loaded without the `VITE_` prefix are server-only and never sent to the client. The Sanity API token should be stored as a server-only env var (e.g., `SANITY_API_TOKEN`). All Sanity write operations should go through server-side `action` functions. Reads that don't require authentication can optionally go through a `loader` or `clientLoader` depending on whether SSR pre-rendering is desired for those entries.
- **Public vs. authenticated dataset:** Sanity's free tier only supports public datasets. This means any client with the project ID and dataset name can read the data without the API token. For a personal-use app where the data is not sensitive, this is acceptable. If the data is considered private, upgrading to a paid Sanity plan (which enables private datasets) or switching to Directus self-hosted (which has full access control) would be required.
- **Setup friction for non-technical users:** Requiring the user to create a Sanity account, create a project, copy the project ID and API token into a `.env` file, and deploy is a non-trivial setup step for non-technical users. For a solopreneur personal tool this is acceptable; for a product distributed to general users it would need a different approach (e.g., a managed backend or OAuth-based Sanity integration).

**Key factors:**
- No authentication is in scope → the `.env` per-deployment model eliminates the shared namespace problem without requiring auth.
- Cloud sync and cross-device access are explicitly out of scope → the primary advantage of a backend CMS is persistent cloud storage per deployment, not multi-user sync.
- Future PRD versions may add authentication and sync → Sanity's schema and GROQ queries remain valid if auth is added later; the migration path is to add user identity to entries rather than redesigning storage.

**Paths forward:**
- **Path A: Sanity free tier (preferred)** → Timeline: 1–1.5 days (project setup, schema definition, GROQ queries); Complexity: Medium; Trade-offs: Persistent cloud storage, real-time title updates, GROQ learning curve, public dataset on free tier.
- **Path B: IndexedDB (client-only)** → Timeline: 0.5 days to integrate `idb`; Complexity: Low; Trade-offs: Data is browser-local, lost on storage clear, no cross-device access. Useful as a fallback or interim approach.
- **Path C: Directus self-hosted** → Timeline: 1.5–2 days (Docker/Railway setup, schema, REST integration); Complexity: Medium-High; Trade-offs: Full control, private datasets, no vendor lock-in, ~$5/mo infrastructure cost.

### Decision 2: AI Model Provider

**What needs to be decided:** Which AI provider to use for furigana generation and title generation.

**Preferred choice: GPT-4o-mini.** Rationale: lowest cost in production at solopreneur scale (~$0.00070 per article), excellent format compliance with structured output system prompts, and sufficient Japanese accuracy for this task. The `openai` npm package is minimal to set up — approximately 30 minutes to integrate.

**Key factors:**
- Both tasks are structured output calls: format compliance is more important than raw intelligence.
- Cost at solopreneur scale is negligible for any of the three options, but GPT-4o-mini is an order of magnitude cheaper than Claude Haiku 4.5.
- Minimizing provider surface area (one SDK, one API key, one invoice) favors using the same provider for both calls.
- Free-tier prototyping before committing to billing is available with Gemini 2.5 Flash.

**Paths forward:**
- **Path A: GPT-4o-mini (preferred)** → Timeline: 30 minutes to integrate `openai` SDK; Complexity: Low; Trade-offs: No free tier, lowest cost in production, excellent format compliance.
- **Path B: Claude Haiku 4.5** → Timeline: 30 minutes to integrate `@anthropic-ai/sdk`; Complexity: Low; Trade-offs: No free tier, slightly higher cost than GPT-4o-mini, excellent format compliance, fastest latency.
- **Path C: Gemini 2.5 Flash** → Timeline: 45 minutes to integrate `@google/genai`; Complexity: Low-Medium; Trade-offs: Free tier available for prototyping; slightly more verbose output requiring stricter prompting.

### Decision 3: Trash Retention Period

**What needs to be decided:** How long should entries remain in the Trash before automatic permanent deletion?

The PRD leaves this as "to be determined in implementation." This is a minor decision that does not block MVP development.

**Key factors:**
- Too short a retention period (e.g., 24 hours) risks unexpected data loss for infrequent users.
- No automatic deletion means the Trash grows unbounded — acceptable for low-volume personal use.
- A simple implementation: no automatic deletion in MVP; entries stay in Trash until explicitly emptied.

**Paths forward:**
- **Path A: No automatic deletion (MVP)** → Simplest; entries persist until the user empties the Trash. Acceptable for a personal-use tool.
- **Path B: TTL-based deletion (e.g., 30 days)** → Requires a scheduled job or a check on Trash Menu open. Adds complexity; deferred to post-MVP.

---

## Real-World Implementation Considerations

### For a Solopreneur

The MVP feature set is ambitious for a single developer but achievable in 2–3 weeks of focused work given the existing stack (React Router v7, SSR, shadcn/ui, Tailwind v4). The highest-leverage sequencing is:

1. **Core generation loop first** (textarea → AI call → ruby rendering) — validates the primary value proposition.
2. **Storage second** (Sanity free tier or IndexedDB for sidebar history) — adds persistence without backend overhead.
3. **View mode toggle third** (CSS class toggle + localStorage via `clientLoader`) — low-effort, high perceived value.
4. **AI title generation fourth** (`useFetcher` follow-up call, async, non-blocking, additive).
5. **Soft-delete and Trash Menu fifth** — moderate complexity but well-scoped; the shadcn/ui `Sheet` component handles the menu UI.
6. **Inline editing last** — most edge-case complexity; desktop-only per PRD, which simplifies the mobile surface significantly.

The sidebar drawer, relative timestamps, and session persistence (`clientLoader`) are all low-complexity items that can be done in parallel with the above.

**Operational complexity:** If Sanity is chosen for storage, the main operational overhead is monitoring API usage against free tier limits (250k API requests/mo) and handling Sanity service downtime (outside the developer's control). For a solopreneur personal-use app at low volume, the free tier is unlikely to be a constraint.

### Scalability and Future Growth

The annotation storage format (`今日{きょう}は...`) is compact, human-readable, and portable — it can be re-parsed if the rendering logic changes and does not couple the data to any specific HTML structure. If authentication and cloud sync are added in a later iteration, the data model is simple enough (id, text, annotation, title, timestamps, deletedAt) to migrate cleanly from a per-deployment Sanity workspace to a multi-user schema.

### Known Gotchas and Best Practices

- **XSS risk from AI output:** The annotation string is parsed into HTML and inserted into the DOM. The parser must sanitize or strictly validate input before generating HTML. Only `<ruby>`, `<rt>`, `<rp>`, and text nodes should ever be produced by the parser — no arbitrary HTML passthrough.
- **Ruby CSS specificity:** Tailwind v4's reset may zero out default ruby display properties. Explicitly set `display: ruby` on `<ruby>` and `display: ruby-text` on `<rt>` in the base CSS to ensure correct rendering across browsers.
- **SSR hydration and localStorage:** Reading `localStorage` in a component body will cause a hydration mismatch in React Router v7's SSR mode. Always read client-only storage inside a `clientLoader` — this is the idiomatic React Router v7 pattern. Reserve `useEffect` for cases where no loader alternative exists (e.g., recurring timers for relative timestamp updates).
- **Japanese font rendering:** The default system font stack may not render Japanese characters at the desired quality. Consider specifying a Japanese-capable font (e.g., `Noto Sans JP` from Google Fonts, or `system-ui` which includes CJK fonts on most platforms) to ensure consistent ruby annotation rendering.
- **Context window for very long articles:** A 10,000-character Japanese article is approximately 10,000 tokens. This is well within the context windows of all three candidate models and GPT-4o-mini's 128k limit in particular. The UI-enforced character cap means this is not a practical concern.
- **Sanity API token in SSR:** Store the Sanity write token as a server-only env var (no `VITE_` prefix). Never expose it to the client bundle. All Sanity write operations must go through server-side `action` functions. Read operations for the history list can optionally use a public read-only token in a `clientLoader`.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI model outputs malformed annotation format (missing braces, extra prose) | Medium | High — breaks ruby rendering | Validate output server-side before storing; retry with stricter prompt on format failure |
| `:hover` CSS behaves unexpectedly on mobile (reveals all furigana on tap) | Medium | Medium — degrades "On Hover" mode on mobile | Use `@media (pointer: fine)` to gate `:hover` rule; fall back to JS click handler on touch devices |
| Sanity public dataset exposes entries to anyone who knows the project ID | Low (personal-use tool) | Low — entries are non-sensitive reading passages; no PII | Accept as MVP trade-off; upgrade to paid Sanity plan or switch to Directus if data sensitivity increases |
| IndexedDB data loss (user clears browser storage) | Low | Medium — all history lost | Mitigated by preferring Sanity free tier; if IndexedDB is used, document as a known limitation |
| Sanity free tier rate limits exceeded under heavy use | Low (MVP scale) | Low | Monitor usage; 250k API requests/mo is unlikely to be hit at solopreneur-personal-use scale |
| SSR hydration mismatch from localStorage reads | Medium | Low — causes React warning and possible flash of wrong content | Always use `clientLoader` for client-only storage reads; never read `localStorage` in component body or SSR `loader` |
| AI title generation fails silently | Medium | Low — fallback to 30-char placeholder is acceptable per PRD | No mitigation needed; PRD explicitly accepts this failure mode |
| Japanese font not available on user's system | Low | Low — system-ui fallback renders correctly, just with different aesthetics | Specify a web font fallback for Japanese glyphs |
| Sanity API token accidentally exposed via VITE_ prefix | Low | High — token could be used to write/delete entries | Use server-only env var naming (no `VITE_` prefix); enforce in code review and `.env.example` documentation |
| Trash retention grows unbounded in MVP (no auto-purge) | Low | Low — only affects storage quota for personal-use data volume | Accept for MVP; add TTL-based purge in a post-MVP iteration |

---

## Recommendations for Refinement

The following are remaining spec gaps or ambiguities that should be resolved before implementation begins:

1. **Define Trash retention period:** The PRD says trash entries are permanently deleted "after a reasonable retention period (to be determined in implementation)." For MVP, explicitly defining "no automatic deletion — user must empty trash manually" eliminates any scheduled job complexity. Recommend updating the PRD with this decision.

2. **Clarify Sanity dataset access scope:** The `.env` per-deployment model means each deployer uses their own Sanity project. The PRD should include a brief setup note for developers (or future documentation) explaining: create a Sanity project, add `SANITY_PROJECT_ID`, `SANITY_DATASET`, and `SANITY_API_TOKEN` to `.env`, and deploy. This prevents configuration ambiguity during implementation.

3. **Specify the mobile trash icon behavior:** The PRD says "on mobile, the trash icon is visible at all times on each sidebar row." Confirm whether this means the icon is always rendered as part of the row layout (requiring space in the row structure) or revealed in a different affordance (e.g., swipe-to-delete). Always-visible is simpler; swipe-to-delete is more polished but requires custom touch event handling.

---

## Questions for Decision-Making

The following questions remain open and should be answered before implementation begins:

1. **Storage:** Sanity free tier (preferred, cloud-persistent, per-deployment isolated via `.env`) or IndexedDB (zero setup, browser-local, data lost on storage clear)? The `.env` model is architecturally sound for this use case — is the setup friction acceptable for the intended deployer audience?

2. **AI provider:** GPT-4o-mini (preferred, lowest cost, excellent format compliance) or another provider? Is there a preference for prototyping on Gemini's free tier before committing to GPT-4o-mini billing?

3. **Trash retention:** Should MVP include automatic trash purge after a set period, or should users manually empty the trash? Recommending no auto-purge for MVP.

4. **Mobile trash affordance:** Always-visible trash icon per row (simpler) or swipe-to-delete (more polished, more complex)?

---

**Review Notes:**

Pricing data for OpenAI (GPT-4o-mini: $0.15/$0.60 per MTok) sourced from pricepertoken.com cross-referenced with openai.com/api/pricing as of 2026-03-17. Anthropic Claude pricing sourced from official Anthropic documentation (platform.claude.com/docs). Gemini pricing sourced from ai.google.dev/pricing. Sanity free tier limits sourced from sanity.io/pricing (250k API requests/mo, 1M CDN requests/mo, 10k documents, public datasets only on free tier). Contentful free tier limits sourced from contentful.com/pricing. Directus pricing sourced from directus.io docs; note that the Directus Cloud $15/mo Starter tier was retired in December 2025 — self-hosting is the practical free option. Browser support for HTML `<ruby>` sourced from caniuse.com (97.5% global coverage). All pricing and plan details should be verified against official documentation at implementation time, as provider pricing changes frequently.

The following items from the original review are now resolved by the updated PRD and no longer require decisions:
- Default view mode → **Always** (resolved)
- Character limit → **10,000 characters, UI-enforced with counter and disabled submit** (resolved)
- Inline title editing on mobile → **Deferred to post-MVP; desktop-only** (resolved)
- Undo/delete scope contradiction → **Resolved: Trash Menu pattern replaces 4-second timed undo**
- Annotation storage format → **Resolved: raw `漢字{よみ}` string; HTML never stored**
- Session persistence fallback when last-viewed entry is deleted → **Resolved: fall back to empty input state**
