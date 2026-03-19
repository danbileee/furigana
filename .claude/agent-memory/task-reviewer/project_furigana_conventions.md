---
name: project_furigana_conventions
description: Key code conventions and patterns in the furigana codebase relevant to task review
type: project
---

Key patterns observed during Task 6 review:

- `import type {}` is enforced via ESLint `consistent-type-imports`. Type-only symbols always use `import type`.
- `for...of` over strings is the required iteration pattern — `noUncheckedIndexedAccess` makes index access return `string | undefined`, so `str[i]` requires null-coalescing. `for...of` yields `string` directly.
- No `as` casts, no `any`. Object literals that structurally match inferred Zod types satisfy them without casting.
- `ParserState` local union types are intentionally not exported — internal implementation details stay private.
- No barrel `index.ts` files until a directory has 3+ files. Followed for `app/lib/furigana/`.
- Vitest globals mode is enabled — `describe`/`it`/`expect` need no import in test files. Schema test file is the exception: it explicitly imports from vitest (both patterns are acceptable).
- Coverage requirement is 100% LINE coverage (not branch). Defensive dead-code guards (`if (raw.length > 0)` where raw always has `{` in it) produce uncovered branches but are acceptable.
- Task plans may describe a simpler algorithm than what is actually needed to pass the plan's own test cases. Implementations that add justified helpers (like `splitTrailingKanji`) to satisfy plan test cases should be accepted, not flagged.

**Why:** The `reading` → `yomi` rename in Task 6 is the canonical example: plan describes a simple algorithm but Test 7 ("parses leading text followed by a ruby token") requires auto-splitting kanji from preceding hiragana, which needed `splitTrailingKanji`.
