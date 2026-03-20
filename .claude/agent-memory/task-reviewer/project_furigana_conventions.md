---
name: project_furigana_conventions
description: Key code conventions and patterns in the furigana codebase relevant to task review
type: project
---

Key patterns observed during Task 6 and Task 7 reviews:

## TypeScript / ESLint conventions

- `import type {}` is enforced via ESLint `consistent-type-imports`. Type-only symbols always use `import type`.
- `for...of` over strings is the required iteration pattern — `noUncheckedIndexedAccess` makes index access return `string | undefined`, so `str[i]` requires null-coalescing. `for...of` yields `string` directly.
- No `as` casts, no `any`. Object literals that structurally match inferred Zod types satisfy them without casting.
- `ParserState` local union types are intentionally not exported — internal implementation details stay private.
- No barrel `index.ts` files until a directory has 3+ files.

## Testing conventions

- Vitest globals mode is enabled — `describe`/`it`/`expect` need no import in test files.
- Test naming: lowercase verb phrases, no "should" prefix.
- All `RubyToken` assertions must use `yomi` field (not `reading` — renamed in Task 5/6).
- Complete token array assertions — specify all fields and exact count, no partial matching.
- Performance tests use `toHaveLength` + `.every()` instead of `toEqual(Array(N).fill(...))` to avoid giant diffs.
- Test files import with path alias: `import { ... } from "~/lib/furigana/parser"`.
- Task plans may describe a simpler algorithm than the actual implementation requires. Implementations that add justified helpers (like `splitTrailingKanji`) should be accepted, not flagged.

## V8 Coverage Annotations

- Task 7 established the annotation pattern for structurally unreachable branches:
  - `/* v8 ignore next -- @preserve */` on the line above a while statement (suppresses the while condition's branch data)
  - `/* v8 ignore else -- @preserve */` inline on the `if` line (suppresses only the false branch — preferred)
- The `-- @preserve` suffix prevents TypeScript from stripping the comment (though `removeComments` is not set in this project's tsconfig, so it is defensive).
- Always prefer `/* v8 ignore else */` over `/* v8 ignore next */` for `if` guards — it leaves the true branch counted, giving honest coverage data.

## Module organization

- `app/lib/furigana/` — parser and furigana-specific utilities
- `app/lib/ai/` — AI-layer utilities (sanitize.ts, future: client.ts, prompts.ts). NOT furigana-specific.
- `app/lib/axios/` — pre-configured Axios instance
- `app/schema/` — Zod schemas and inferred types

## Sanitization pattern (Task 7)

- `sanitize()` in `app/lib/ai/sanitize.ts` — pure, synchronous, no imports, three chained `.replace()` calls.
- Order matters: tag removal first, then protocol stripping, then event handler removal.
- Applied to AI-generated strings before `parseAnnotationString`. React JSX is the second defense layer.
- No `dangerouslySetInnerHTML` anywhere in the codebase.

## Parser implementation details (for future reviewers)

- `splitTrailingKanji` is not exported — internal to parser.ts. Observable through `parseAnnotationString` tests.
- Three V8-unreachable branches: `?? ""` fallback in while condition (line ~11), and `if (raw.length > 0)` false branches in `}` handler and end-of-input handler. All annotated with `/* v8 ignore */`.
- `KANJI_CHAR_REGEX = /[\p{Script=Han}々〆ヶ]/u` — includes iteration mark, kokuji, and katakana KE explicitly alongside the Unicode Han script class.
