---
name: Furigana Architectural Patterns
description: Reusable architectural patterns and phasing strategies observed while generating the Furigana MVP roadmap
type: project
---

## Parser Pattern: Typed Token Array vs Raw HTML

When AI output must be converted to HTML, prefer producing a typed token array (`Array<TextToken | RubyToken>`) from the parser rather than raw HTML strings. The component renders HTML from the type-safe structure via JSX — this eliminates XSS surface and keeps the parser output testable without DOM.

**Why:** Prevents `dangerouslySetInnerHTML` usage and keeps type safety intact across the AI → render pipeline.

## Phasing Strategy: Core Loop First, Storage Second

For apps with AI generation + persistence, always validate the core generation loop (AI call → render) before layering in storage. This isolates the highest-risk component (AI format compliance, parser correctness) from storage integration complexity.

**Why:** AI prompt quality issues discovered in Phase 1 are cheap to fix; discovering them after Sanity integration doubles the debugging surface.

## Sanity Schema: Define Completely at Phase 2

When using Sanity for a feature that will accrue soft-delete and AI-generated fields over multiple phases, define the complete schema (including `deletedAt`, `title`) in the initial schema creation to avoid migrations. Use `null` as the default for optional fields.

## useEffect Rule (Project-Specific)

This project enforces: `useEffect` only for cases with no loader/action/useFetcher equivalent. Approved uses:

- Recurring timers (relative timestamp refresh via `setInterval`)
- DOM event listener attachment (delegated touch/click handler on reading container)

Everything else: `clientLoader`, `loader`, `action`, or `useFetcher`.

## Mobile Hover Interaction Pattern

For CSS-driven "On Hover" reveals (furigana visibility, trash icons) on touch devices:

- Gate the CSS `:hover` rule with `@media (pointer: fine)`
- Add a single delegated `click` listener on the container that toggles `.active` on the target element
- Use `opacity` + `visibility` (not `display: none`) to allow CSS transitions

## Resource Route Pattern for CMS Operations

For CRUD operations on a CMS (Sanity), use dedicated resource routes with no UI component:

- `POST /api/entries/:id/delete` → sets `deletedAt`
- `POST /api/entries/:id/restore` → clears `deletedAt`
- `POST /api/entries/:id/destroy` → hard delete
- `POST /api/entries/:id/title` → PATCH title field

Each is wired via `useFetcher` from the component that triggers it. Never use client-side `fetch` directly.

## Parallelizable Phases

Low-complexity polish features (mobile drawer, relative timestamps, session persistence) are good candidates for parallelization once the central data layer (storage phase) is complete. Identify them explicitly in roadmaps as Phase 7a/7b/7c to signal parallelism.
