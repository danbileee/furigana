---
name: Verified third-party services and pricing
description: AI model and CMS service details verified against official docs during PRD reviews, with pricing snapshots and key constraints.
type: reference
---

## AI Models (verified 2026-03-17)

### Claude Haiku 4.5 (Anthropic)
- Model ID: `claude-haiku-4-5-20251001`
- Input: $1.00/MTok | Output: $5.00/MTok
- Context window: 200k tokens | Max output: 64k tokens
- Latency: Fastest in Claude lineup
- Docs: https://platform.claude.com/docs/en/docs/about-claude/models/overview

### Claude Sonnet 4.6 (Anthropic)
- Model ID: `claude-sonnet-4-6`
- Input: $3.00/MTok | Output: $15.00/MTok
- Context window: 1M tokens | Max output: 64k tokens

### Claude Opus 4.6 (Anthropic)
- Model ID: `claude-opus-4-6`
- Input: $5.00/MTok | Output: $25.00/MTok
- Context window: 1M tokens | Max output: 128k tokens

### GPT-4o (OpenAI)
- Input: $2.50/MTok | Output: $10.00/MTok | Cached: $1.25/MTok
- Context window: 128k tokens

### GPT-4o-mini (OpenAI)
- Input: $0.15/MTok | Output: $0.60/MTok
- Context window: 128k tokens
- Note: No free tier; pay-as-you-go from first request

### Gemini 2.5 Flash (Google)
- Input: $0.30/MTok | Output: $2.50/MTok
- Context window: 1M tokens
- Free tier: Available (rate-limited)
- Docs: https://ai.google.dev/pricing

## CMS Options (verified 2026-03-17)

### Sanity (Free Tier)
- 250k API requests/mo, 1M CDN requests/mo
- 10k documents, 100GB assets, 100GB bandwidth
- 2 public datasets (no private datasets on free tier)
- Real-time: Live Connections (1k concurrent on free), 15-min retention
- Docs: https://www.sanity.io/pricing

### Contentful (Free Tier)
- 100k API calls/mo (no overages), 50GB bandwidth
- 25 content types, 2 environments, 2 locales, 10 users
- No real-time push; webhooks available
- Docs: https://www.contentful.com/pricing/

### Directus (Self-Hosted)
- Fully free to self-host; infrastructure cost only
- Directus Cloud Professional: $99/mo (Starter at $15/mo retired Dec 2025)
- REST + GraphQL auto-generated from SQL schema
- Supports SQLite, PostgreSQL, MySQL, MariaDB, MS SQL, Oracle
- Railway deployment: ~$5/mo for small instance
- Docs: https://directus.io/docs

## Notion API
- Rate limit: 3 requests/second per integration
- Rich text: 2000 char limit per property
- Max 1000 blocks per request, 500KB payload
- Not suitable as primary data store for this use case (too slow, rate-limited, content-model mismatch)
