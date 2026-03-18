---
name: Furigana Project Context
description: Core architectural decisions and technology choices made for the Furigana MVP roadmap (2026-03-17 PRD)
type: project
---

The Furigana MVP is a React Router v7 (SSR) single-page app for AI-powered Japanese reading assistance. All key decisions have been locked in via the PRD review process.

**Why:** Solopreneur personal-use tool. No auth, no multi-user, per-deployment isolation via `.env` credentials.

**How to apply:** When suggesting changes, keep within the decided stack and patterns. Do not propose auth, multi-user Sanity, or alternative AI providers unless the user raises them.

## Locked Decisions

- **AI provider**: GPT-4o-mini via `openai` npm package (server-only, `OPENAI_API_KEY` — no `VITE_` prefix)
- **Storage**: Sanity free tier, per-deployment isolation via `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN` (all server-only)
- **Annotation format**: Raw `漢字{よみ}` string stored in Sanity; HTML generated at render time via parser — never stored
- **View mode default**: Always
- **Character limit**: 10,000 chars, UI-enforced counter + disabled submit
- **Inline title editing**: Desktop-only; mobile deferred to post-MVP
- **Delete pattern**: Soft-delete with `deletedAt` field; Trash Menu (no timed undo)
- **Trash retention**: No auto-purge in MVP; manual empty only
- **Mobile trash affordance**: Always-visible icon per row
- **useEffect rule**: Only for recurring timers (timestamp refresh) and DOM event listener attachment. All data fetching via loader/clientLoader/action/useFetcher.
- **Mobile "On Hover" tap**: Option B — CSS `@media (pointer: fine)` + single delegated `click` listener toggling `.active` class on `<ruby>` elements
- **Sidebar rendering**: Single component, CSS-controlled visibility (no useMediaQuery branching)

## Sanity Schema (defined completely in Phase 2)

```
{
  _id: string,
  _type: 'entry',
  rawText: string,
  annotationString: string,
  title: string | null,
  createdAt: string,
  deletedAt: string | null,
}
```

## Implementation Sequence (7 phases)

1. Core generation loop (textarea → GPT-4o-mini → ruby rendering) — 4–6 days
2. Sanity storage + history sidebar — 5–7 days
3. View mode toggle + preference persistence — 2–3 days
4. AI title generation (useFetcher follow-up) — 2–3 days
5. Soft-delete and Trash Menu — 4–5 days
6. Inline title editing (desktop-only) — 2–3 days
7. Parallelizable polish (mobile drawer, timestamps, session persistence) — 3–4 days

Total: ~3–4 weeks solo.
