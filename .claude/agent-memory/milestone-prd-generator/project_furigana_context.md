---
name: Furigana MVP — Project Context
description: Core facts about the Furigana MVP project structure, roadmap, and milestone sequencing
type: project
---

Furigana MVP is a React Router v7 SSR single-page app that generates furigana (ruby annotation) readings for Japanese text using GPT-4o-mini.

**Architecture**: Textarea input → server-side `action` → GPT-4o-mini API → `漢字{よみ}` annotation string → parser → `FuriganaToken[]` → `<ruby>` JSX rendering.

**Milestone sequencing** (8 milestones total):
1. Core Generation Loop (weight 0.23) — annotation string parser, ruby rendering, no persistence
2. Sanity Storage and History Sidebar (weight 0.22) — persistence, sidebar component
3. View Mode Toggle and Preference Persistence (weight 0.08) — Always/On Hover CSS toggle
4. AI Title Generation (weight 0.10) — background useFetcher title call
5. Inline Title Editing — double-click sidebar row
6. Soft-Delete and Trash Menu — trash store, restore flow
7a. Relative Timestamps — formatTimestamp utility
7b. Session Persistence — last-viewed entry on reload
8. Mobile Sidebar Drawer — hamburger + drawer overlay

**Master PRD**: `docs/plans/2026-03-17/prd.md`
**Roadmap**: `docs/plans/2026-03-17/roadmap.md`
**Milestone 1 sub-PRD**: `.taskmaster/docs/plans/2026-03-18/prd.md`

**Why:** The core generation loop (M1) must be stable before any persistence or UI features build on top of it. All downstream milestones depend on the `FuriganaToken[]` data contract and the `annotationString` action return.

**How to apply:** When generating future milestone sub-PRDs, reference M1's established contracts: `FuriganaToken` type, `ActionData` return shape, `ReadingView` props interface, and the `openaiClient` singleton.
