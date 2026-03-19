---
name: Furigana project context
description: Core technical decisions, architecture, and open questions for the Furigana MVP — updated after 2026-03-18 PRD review revision.
type: project
---

Furigana is a single-page web app (React Router v7, SSR enabled) that lets users paste Japanese text and receive an AI-generated furigana-annotated reading view.

**Stack confirmed in package.json:**

- React 19 + React Router v7 (SSR, framework mode)
- Tailwind CSS v4 + shadcn/ui (components in app/components/ui/)
- TypeScript (strict: exactOptionalPropertyTypes, noUncheckedIndexedAccess)
- Zod v4, Axios, Sentry, lucide-react
- Vite 7, pnpm 10, Node >=22

**Core architecture pattern:**

- AI generation runs server-side in React Router `action` functions (protects API key, avoids CORS)
- Annotation format stored as raw string: `今日{きょう}は天気{てんき}がいい。` — this is the decided storage format; HTML is never stored
- Ruby HTML rendered client-side from annotation string via regex parser
- Entry persistence: Sanity free tier (preferred) via `.env` per-deployment API key pattern; IndexedDB remains a fallback option

**Project convention: no `useEffect` when a React Router loader/action is available**

- localStorage reads on page load → `clientLoader`
- Follow-up async calls after actions → `useFetcher`
- `useEffect` is reserved for cases with no loader alternative (e.g., `setInterval` for timestamp updates)

**Decisions resolved as of 2026-03-18:**

1. Default view mode → Always
2. Character limit → 10,000 characters, UI-enforced with counter and disabled submit
3. Inline title editing → desktop-only; mobile deferred to post-MVP
4. Undo/delete contradiction → resolved: Trash Menu soft-delete pattern replaces 4-second timed undo
5. Annotation storage format → raw `漢字{よみ}` string; HTML never stored
6. Session persistence fallback when last-viewed entry is deleted → fall back to empty input state

**Preferred choices (not yet hard-decided, but recommended in PRD review):**

- AI provider: GPT-4o-mini (lowest cost, excellent format compliance, sufficient Japanese accuracy)
- Storage backend: Sanity free tier via `.env` per-deployment isolation (architecturally sound for personal-use tool; public dataset on free tier is acceptable for non-sensitive reading passages)

**Open decisions as of 2026-03-18:**

1. Storage backend: confirm Sanity free tier vs IndexedDB
2. AI provider: confirm GPT-4o-mini vs alternative
3. Trash retention period: no auto-purge recommended for MVP (manual empty only)
4. Mobile trash affordance: always-visible icon per row vs swipe-to-delete

**Why:** These are the foundational decisions that shape the entire data layer and component architecture.
**How to apply:** When discussing implementation, note which decisions are resolved vs. still open. Preferred choices (GPT-4o-mini, Sanity) are recommendations, not final decisions.
