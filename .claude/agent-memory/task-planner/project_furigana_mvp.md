---
name: Furigana MVP Project Context
description: Core facts about the Furigana MVP project — what it is, its milestone structure, and key architectural decisions that constrain planning.
type: project
---

Furigana is a single-page React Router v7 (SSR) web app that adds AI-generated furigana readings to Japanese text using GPT-4o-mini. The MVP is structured as 8 milestones.

**Why:** Solopreneur project by Dan Lee to help Japanese learners read native-level text without breaking reading flow.

**How to apply:** Every plan must respect the 8-milestone ordering. Milestone 1 is the core generation loop (foundational). All downstream milestones add features on top without modifying Milestone 1 contracts.

## Milestone Structure (summary)

- M1: Core Generation Loop — textarea input → GPT-4o-mini server action → FuriganaToken[] → <ruby> rendering
- M2: Persistence (Sanity CMS) + History Sidebar + "New" button
- M3: View mode toggle (Always / On Hover)
- M4: AI Title Generation
- M5: Inline Title Editing
- M6: Soft-delete + Trash menu
- M7a: Relative timestamps | M7b: Session persistence (last-viewed entry on reload)
- M8: Mobile sidebar drawer

## Critical M1 Contracts (must not be broken by later milestones)

- `FuriganaToken[]` is the canonical parsed type; Sanity stores `annotationString` and re-parses on load
- `ActionSuccess` returns `{ tokens: FuriganaToken[] }` — M2 extends this with `{ entryId: string }`
- `ReadingView` receives `tokens: FuriganaToken[]` — M3 adds `viewMode` as a second prop
- `openaiClient` in `app/lib/ai/client.ts` is reused by M4 for title generation
- Ruby CSS lives in `@layer base` in `app/app.css` — M3 adds `[data-view-mode]` rules to the same file

## Key Architectural Decisions

- Server/client boundary: `app/lib/ai/` is server-only; parsed token array is the only data crossing the boundary
- No `dangerouslySetInnerHTML` anywhere — XSS safety enforced via typed JSX interpolation
- `OPENAI_API_KEY` is server-only (no VITE\_ prefix); the module throws at import time if unset
- Parser (`parseAnnotationString`) runs on the server inside the action; client only receives typed tokens
