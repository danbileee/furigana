---
name: Furigana project overview
description: Core product purpose, tech stack, and key architectural decisions for the Furigana app
type: project
---

Furigana is a single-page web app (solopreneur project) that lets Japanese learners paste text and receive a furigana-annotated reading view. The user is building this solo.

**Why:** Personal tool to help Japanese learners read native-level text without breaking reading flow.

**Tech stack:**

- Frontend: React Router v7 (SSR enabled), shadcn/ui, Tailwind CSS v4
- Storage backend: Notion database (CMS) — NOT a traditional DB or localStorage for entry data
- AI: OpenAI API (furigana generation + title generation — two calls per submission)
- Furigana format: `今日{きょう}` parsed into `<ruby>今日<rt>きょう</rt></ruby>` HTML
- View mode toggle: CSS-only class toggle (no JS re-render)
- Hosting: React Router SSR (Node.js)

**How to apply:** When reviewing PRDs or suggesting implementation patterns, always account for Notion as the storage backend (with its rate limits and 2,000-char rich text limit), OpenAI as the AI provider, and the solopreneur context (minimize operational overhead).
