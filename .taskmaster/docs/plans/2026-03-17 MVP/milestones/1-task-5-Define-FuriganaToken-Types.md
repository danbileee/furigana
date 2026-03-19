# Task 5: Define FuriganaToken Types

## Overview

Create `app/schema/furigana.ts` — the foundational schema module for the entire furigana pipeline. This file defines `TextTokenSchema` and `RubyTokenSchema` as Zod schemas, derives the `TextToken` and `RubyToken` TypeScript types from them via `z.infer`, composes them into the discriminated union `FuriganaTokenSchema` and `FuriganaToken`, and exports two narrowing type guards (`isTextToken`, `isRubyToken`). Every downstream module in Milestone 1 and beyond imports exclusively from this file.

Zod is chosen over pure TypeScript types for two reasons:

1. **Runtime validation**: The parser (Task 6) produces plain objects from AI-generated strings. Zod lets any call site validate an unknown value against the token schema at runtime — essential for the action boundary where AI output enters the system.
2. **Schema-driven type safety**: The TypeScript types are derived from the schemas with `z.infer`, so the schema is the single source of truth. The types and the runtime validators are guaranteed to agree.

---

## Requirements Analysis

### Functional Requirements

- Define `TextTokenSchema` as a Zod object schema with shape `{ type: z.literal('text').readonly(), value: z.string() }`, representing plain-text segments (hiragana, katakana, punctuation, romaji).
- Define `RubyTokenSchema` as a Zod object schema with shape `{ type: z.literal('ruby').readonly(), kanji: z.string(), reading: z.string() }`, representing a kanji compound with its furigana reading.
- Apply a regex refinement to the `value` field of `TextTokenSchema` to reject strings matching the `{}` annotation placeholder format (pattern: `/\{[^}]*\}/`). A valid `TextToken.value` must not contain brace-wrapped substrings — those belong in a `RubyToken`.
- Define `FuriganaTokenSchema` as `z.discriminatedUnion('type', [TextTokenSchema, RubyTokenSchema])`.
- Derive `TextToken`, `RubyToken`, and `FuriganaToken` types using `z.infer<typeof ...>`.
- Export type guard `isTextToken(token: FuriganaToken): token is TextToken` that narrows via the `type` discriminant.
- Export type guard `isRubyToken(token: FuriganaToken): token is RubyToken` that narrows via the `type` discriminant.
- All `type` discriminant properties must be declared with `.readonly()` so Zod emits the `readonly` modifier in the inferred TypeScript type.
- All exports must be named exports (no default exports), consistent with the project's module style.

### Non-Functional Requirements

- **Type strictness**: The file must compile without errors under all five strict flags in `tsconfig.json` (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `strict`).
- **Downstream stability**: The shape of `TextToken` and `RubyToken` is a Milestone 1 contract. The discriminant values `'text'` and `'ruby'` must not change. Future milestones (M2 persistence, M3 view modes) must not require changes to these schemas.
- **ESLint compliance**: The `consistent-type-imports` rule is satisfied — this file imports from `zod` as a value (`import * as z from 'zod'`), which is a runtime import and does not need `import type`.
- **No `any`, no `as` casts**: Use `z.infer` for all type derivations. Never assert the schema output with `as`.

### Dependencies & Constraints

- **Internal**: No task dependencies. This task can be implemented in isolation. Zod is already a production dependency (`^4.0.0`).
- **Downstream consumers** (informational — do not couple implementation to them):
  - Task 6 (`app/lib/furigana/parser.ts`): produces `FuriganaToken[]`; may call `FuriganaTokenSchema.parse()` on each constructed object to validate parser output.
  - Task 12 (`app/components/furigana/ReadingView.tsx`): renders `FuriganaToken[]` as `<ruby>` JSX; uses type guards.
  - M2: `annotationString` is stored in Turso DB; re-parsing yields `FuriganaToken[]` — same type contract. Zod schemas can validate deserialized JSON from the DB without additional adapter code.
  - M3: `ReadingView` gains a `viewMode` prop; `tokens: FuriganaToken[]` prop is unchanged.
- **External libraries**: `zod ^4.0.0` (already installed).
- **Technical constraints**:
  - File must live at `app/schema/furigana.ts` — the `app/schema/` directory already exists.
  - The `~/` path alias maps to `app/`; consumers will import as `import { FuriganaTokenSchema } from '~/schema/furigana'` and `import type { FuriganaToken } from '~/schema/furigana'`.
  - The existing `app/schema/user.ts` uses the `import * as z from 'zod'` import style — follow the same convention.

---

## Implementation Plan

### Phase 1: Create the Schema Module

**Objective**: Write `app/schema/furigana.ts` with all schema definitions, inferred types, and type guards.

#### Subtask 1.1: Create `app/schema/furigana.ts`

- **Files to create**: `app/schema/furigana.ts` (new file; parent directory already exists).
- **Exact content**:

```typescript
// app/schema/furigana.ts

import * as z from "zod";

/**
 * Schema for a plain text segment (hiragana, katakana, punctuation, romaji).
 *
 * The value field must not contain brace-wrapped substrings of the form {…}
 * because those denote ruby annotation placeholders and belong in a RubyToken.
 */
export const TextTokenSchema = z.object({
  type: z.literal("text").readonly(),
  value: z
    .string()
    .regex(/^(?:[^{}])*$/, "TextToken value must not contain {…} placeholders"),
});

/**
 * Schema for a kanji compound paired with its furigana reading.
 */
export const RubyTokenSchema = z.object({
  type: z.literal("ruby").readonly(),
  kanji: z.string().min(1),
  reading: z.string().min(1),
});

/**
 * Discriminated union schema for all token types in parsed furigana output.
 * The discriminant is the `type` field.
 */
export const FuriganaTokenSchema = z.discriminatedUnion("type", [
  TextTokenSchema,
  RubyTokenSchema,
]);

/**
 * TypeScript type for a plain text segment, derived from TextTokenSchema.
 */
export type TextToken = z.infer<typeof TextTokenSchema>;

/**
 * TypeScript type for a kanji+reading pair, derived from RubyTokenSchema.
 */
export type RubyToken = z.infer<typeof RubyTokenSchema>;

/**
 * Union type for all possible tokens in parsed furigana output,
 * derived from FuriganaTokenSchema.
 */
export type FuriganaToken = z.infer<typeof FuriganaTokenSchema>;

/**
 * Type guard for TextToken. Narrows a FuriganaToken to TextToken.
 */
export function isTextToken(token: FuriganaToken): token is TextToken {
  return token.type === "text";
}

/**
 * Type guard for RubyToken. Narrows a FuriganaToken to RubyToken.
 */
export function isRubyToken(token: FuriganaToken): token is RubyToken {
  return token.type === "ruby";
}
```

- **Key considerations**:
  - The `type` field on both schemas uses `z.literal(...)` which emits a string literal type (`'text'` or `'ruby'`). Chaining `.readonly()` on the literal makes the inferred property `readonly type: 'text'`, satisfying the immutability requirement without needing to add `readonly` manually on every property.
  - The regex `^(?:[^{}])*$` on `TextTokenSchema.value` rejects any string containing `{` or `}`. This is the correct invariant: a parser bug that leaves a `{reading}` placeholder inside a text segment would be caught at validation time, not silently rendered as garbage.
  - `z.discriminatedUnion('type', [...])` is the correct Zod v4 API for discriminated union schemas. It requires all member schemas to share the discriminant key with a `z.literal(...)` value, which both `TextTokenSchema` and `RubyTokenSchema` satisfy.
  - The type guard functions are implemented as named function declarations (not arrow `const`s) to match the existing codebase utility style.
  - `kanji` and `reading` carry `.min(1)` to reject empty strings — a `RubyToken` with an empty kanji or reading would be semantically invalid and would produce broken `<ruby>` HTML.
  - There is no `index.ts` barrel file for `app/schema/` at this stage. Do not add one prematurely.
  - The import style `import * as z from 'zod'` matches the existing `app/schema/user.ts` convention.

- **Acceptance criteria**:
  - File exists at `app/schema/furigana.ts`.
  - `pnpm type-check` exits with code 0.
  - `pnpm exec eslint app/schema/furigana.ts` exits with code 0.
  - `TextTokenSchema.parse({ type: 'text', value: 'こんにちは' })` succeeds at runtime.
  - `TextTokenSchema.parse({ type: 'text', value: '日本語{にほんご}' })` throws a `ZodError`.
  - `FuriganaTokenSchema.parse({ type: 'ruby', kanji: '東京', reading: 'とうきょう' })` succeeds at runtime.

---

### Phase 2: Verification

**Objective**: Confirm the schemas, inferred types, and type guards satisfy TypeScript strict mode and ESLint rules.

#### Subtask 2.1: Run type-check

- **Files to modify**: None.
- **Command**: `pnpm type-check`
- **Key considerations**: `pnpm type-check` runs `react-router typegen && tsc --noEmit`. The `tsc` invocation uses the project's `tsconfig.json` with all five strict flags. A clean exit confirms the Zod v4 import and all `z.infer` derivations are valid under strict mode.
- **Acceptance criteria**: Command exits with code 0.

#### Subtask 2.2: Run ESLint

- **Files to modify**: None.
- **Command**: `pnpm exec eslint app/schema/furigana.ts`
- **Key considerations**: The file uses `import * as z from 'zod'` — a namespace import of runtime values. ESLint's `consistent-type-imports` rule applies only to type-only imports, so this import form is correct and will not trigger the rule. No `any` or `as` casts are present.
- **Acceptance criteria**: Command exits with code 0.

---

## Third-Party Integration Research

### Zod v4.0.0 (installed: `^4.0.0`)

- **Official docs**: [https://zod.dev](https://zod.dev) — v4 documentation. Relevant sections: `z.object`, `z.literal`, `z.discriminatedUnion`, `z.string().regex()`, `.readonly()`, `z.infer`.
- **Breaking changes from v3**: Zod v4 (released 2025) is a major rewrite. Key differences that affect this task:
  - `z.string().regex()` signature is unchanged — takes a `RegExp` and an optional error message string.
  - `z.discriminatedUnion()` is available in v4 with the same API as v3 (first arg is discriminant key string, second arg is array of object schemas). No breaking change for this use.
  - `.readonly()` is available on `z.literal()` in v4. It adds the `readonly` modifier to the inferred property type. Verify by checking the inferred type in the IDE after implementation.
  - Import style: Zod v4 supports both `import { z } from 'zod'` and `import * as z from 'zod'`. The existing project uses `import * as z from 'zod'` — continue with this style for consistency.
  - `z.infer<typeof schema>` syntax is unchanged from v3.
- **Open issues / known bugs**: Zod v4.0.0 was released recently. Monitor the [zod GitHub issues](https://github.com/colinhacks/zod/issues) for bugs related to `discriminatedUnion` and `readonly`. No blocking issues were found as of 2026-03-19.
- **Security advisories**: None.
- **Performance notes**: Schema parsing (`schema.parse()`) is fast for small objects like tokens. The parser (Task 6) will call `FuriganaTokenSchema.parse()` (or `safeParse`) on each token — this adds a negligible per-token overhead compared to the upstream AI API call latency.
- **Case studies**: Zod discriminated unions are the standard pattern for typed event/message systems in the TypeScript ecosystem (e.g., Redux Toolkit's action matching, tRPC input validation). The pattern is well-established and production-proven.

> No `Needs Review` items were identified. The `z.literal().readonly()` chain is a valid Zod v4 API. Confirm the inferred type includes `readonly` after implementation using IDE type inspection.

---

## Code Patterns

### Pattern 1: Zod Object Schema with Literal Discriminant and Readonly

```typescript
import * as z from "zod";

export const TextTokenSchema = z.object({
  type: z.literal("text").readonly(),
  value: z.string().regex(/^(?:[^{}])*$/, "..."),
});

export type TextToken = z.infer<typeof TextTokenSchema>;
// Inferred: { readonly type: "text"; value: string }
```

**Where to apply**: `app/schema/furigana.ts`. The `z.literal(...).readonly()` chain is the correct way to get a `readonly` discriminant field in the inferred type without manually writing `readonly type: 'text'`.

**Why this pattern**: Deriving types with `z.infer` keeps the schema as the single source of truth. If the schema changes (e.g., a new field is added), the TypeScript type updates automatically. Manual type duplication would allow the schema and the type to drift silently.

### Pattern 2: Zod Discriminated Union

```typescript
export const FuriganaTokenSchema = z.discriminatedUnion("type", [
  TextTokenSchema,
  RubyTokenSchema,
]);

export type FuriganaToken = z.infer<typeof FuriganaTokenSchema>;
// Inferred: TextToken | RubyToken
```

**Where to apply**: `app/schema/furigana.ts`. Use `z.discriminatedUnion` (not `z.union`) when all members share a literal-typed discriminant key. Zod uses the discriminant to select the correct schema branch before running validation, which is faster than trying each branch in sequence.

**Why this pattern**: `z.discriminatedUnion` requires all members to have a `z.literal` value on the discriminant field — this is a structural guarantee at schema-definition time, not just at parse time. It will throw during schema construction (at module load) if any member schema is missing the discriminant, surfacing misconfiguration immediately.

### Pattern 3: Type Guards Working with Zod-Inferred Types

```typescript
export function isTextToken(token: FuriganaToken): token is TextToken {
  return token.type === "text";
}
```

**Where to apply**: `app/schema/furigana.ts`. The guards work identically whether `FuriganaToken` is a hand-written type alias or a `z.infer` derivation — the discriminant comparison is a pure runtime string equality check.

**Why this pattern**: Type guards are needed for JSX `.map()` contexts (Task 12's `ReadingView`) where `switch` is syntactically awkward. They centralize the discriminant string literals so a rename of `'text'` or `'ruby'` requires only one edit in `types.ts`.

### Pattern 4: Consumer Import Style

```typescript
// Consumer that needs both schemas (for validation) and types (for annotations)
import * as z from "zod";
import { FuriganaTokenSchema, isRubyToken } from "~/schema/furigana";
import type { FuriganaToken } from "~/schema/furigana";

// Consumer that only needs types (e.g., a loader passing tokens to a component)
import type { FuriganaToken } from "~/schema/furigana";
```

**Where to apply**: Every file that imports from `~/schema/furigana`.

**Why this pattern**: ESLint's `consistent-type-imports` rule (inline style) requires that type-only imports use `import type {}`. Schema values (`FuriganaTokenSchema`, `TextTokenSchema`) and guard functions (`isTextToken`, `isRubyToken`) are runtime values and must use plain `import {}`. When a file needs both, two separate import statements from the same path are required.

---

## Test Cases

Task 6 (Configure Vitest) must be complete before unit tests can be written. The test file described below is written as part of Task 6's verification step or as a standalone verification immediately after. The plan is specified here so the author can write the tests without re-analysis.

**Test file location**: `app/schema/furigana.test.ts`

### Unit Tests

#### Test Suite: `TextTokenSchema` — Zod Validation

**Test 1**: Parses a valid `TextToken` object
- **Given**: `{ type: 'text', value: 'こんにちは' }`
- **When**: `TextTokenSchema.parse(input)` is called
- **Then**: Returns `{ type: 'text', value: 'こんにちは' }` without throwing
- **Coverage**: Detects regressions in the schema definition (e.g., accidentally using `z.string()` for `type` instead of `z.literal`)

**Test 2**: Parses an empty `value` string as valid
- **Given**: `{ type: 'text', value: '' }`
- **When**: `TextTokenSchema.parse(input)` is called
- **Then**: Returns successfully — empty text segments are valid (e.g., edge case in parser output)
- **Coverage**: Confirms no inadvertent `.min(1)` constraint on `value`

**Test 3**: Rejects a value containing `{...}` annotation placeholders
- **Given**: `{ type: 'text', value: '日本語{にほんご}' }`
- **When**: `TextTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }` with a `ZodError` describing the regex failure
- **Coverage**: This is the primary invariant of the regex rule — detects removal or weakening of the pattern

**Test 4**: Rejects a value with only an opening brace
- **Given**: `{ type: 'text', value: 'text{' }`
- **When**: `TextTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }` — the regex `^(?:[^{}])*$` rejects any `{` or `}` character
- **Coverage**: Detects a regex that is too permissive (e.g., only rejects complete `{...}` pairs)

**Test 5**: Rejects an object with a wrong `type` literal
- **Given**: `{ type: 'ruby', value: 'hi' }`
- **When**: `TextTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }`
- **Coverage**: Confirms the literal discriminant is enforced

#### Test Suite: `RubyTokenSchema` — Zod Validation

**Test 6**: Parses a valid `RubyToken` object
- **Given**: `{ type: 'ruby', kanji: '東京', reading: 'とうきょう' }`
- **When**: `RubyTokenSchema.parse(input)` is called
- **Then**: Returns the object without throwing
- **Coverage**: Baseline correctness of schema definition

**Test 7**: Rejects a `RubyToken` with an empty `kanji`
- **Given**: `{ type: 'ruby', kanji: '', reading: 'とうきょう' }`
- **When**: `RubyTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }` — `.min(1)` on `kanji` rejects empty strings
- **Coverage**: Detects removal of the `.min(1)` guard, which would allow semantically invalid tokens to reach the renderer

**Test 8**: Rejects a `RubyToken` with an empty `reading`
- **Given**: `{ type: 'ruby', kanji: '東京', reading: '' }`
- **When**: `RubyTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }` — `.min(1)` on `reading` rejects empty strings
- **Coverage**: Same as Test 7 for the `reading` field

#### Test Suite: `FuriganaTokenSchema` — Discriminated Union Validation

**Test 9**: Parses a `TextToken` shape via the union schema
- **Given**: `{ type: 'text', value: 'きました' }`
- **When**: `FuriganaTokenSchema.parse(input)` is called
- **Then**: Returns the object; TypeScript infers it as `FuriganaToken`
- **Coverage**: Confirms the union schema delegates correctly to `TextTokenSchema`

**Test 10**: Parses a `RubyToken` shape via the union schema
- **Given**: `{ type: 'ruby', kanji: '行', reading: 'い' }`
- **When**: `FuriganaTokenSchema.parse(input)` is called
- **Then**: Returns the object; TypeScript infers it as `FuriganaToken`
- **Coverage**: Confirms the union schema delegates correctly to `RubyTokenSchema`

**Test 11**: Rejects an unknown `type` value
- **Given**: `{ type: 'unknown', value: 'x' }`
- **When**: `FuriganaTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }` with a `ZodError` indicating no matching discriminant
- **Coverage**: Confirms discriminated union does not silently pass unknown token shapes (critical for security at the AI output boundary)

**Test 12**: Rejects an object missing the `type` field entirely
- **Given**: `{ value: 'x' }`
- **When**: `FuriganaTokenSchema.safeParse(input)` is called
- **Then**: Returns `{ success: false }`
- **Coverage**: Detects bugs where the parser omits the `type` field from constructed objects

#### Test Suite: `isTextToken` — Type Guard

**Test 13**: Returns `true` for a `TextToken`
- **Given**: `const token: FuriganaToken = { type: 'text', value: 'こんにちは' }`
- **When**: `isTextToken(token)` is called
- **Then**: Returns `true`; TypeScript narrows `token` to `TextToken` inside the `if` block
- **Coverage**: Detects regression if the guard's predicate is accidentally changed

**Test 14**: Returns `false` for a `RubyToken`
- **Given**: `const token: FuriganaToken = { type: 'ruby', kanji: '漢字', reading: 'かんじ' }`
- **When**: `isTextToken(token)` is called
- **Then**: Returns `false`
- **Coverage**: Detects incorrect guard logic that returns `true` for the wrong union member

#### Test Suite: `isRubyToken` — Type Guard

**Test 15**: Returns `true` for a `RubyToken`
- **Given**: `const token: FuriganaToken = { type: 'ruby', kanji: '東京', reading: 'とうきょう' }`
- **When**: `isRubyToken(token)` is called
- **Then**: Returns `true`; TypeScript narrows `token` to `RubyToken` inside the `if` block
- **Coverage**: Detects regression if the guard predicate is wrong

**Test 16**: Returns `false` for a `TextToken`
- **Given**: `const token: FuriganaToken = { type: 'text', value: '。' }`
- **When**: `isRubyToken(token)` is called
- **Then**: Returns `false`
- **Coverage**: Detects conflation of the two token types

#### Test Suite: `readonly` Enforcement (Compile-time)

**Test 17**: `type` property on `TextToken` is `readonly` (compile-time assertion)
- **Given**: `const token: TextToken = { type: 'text', value: 'hi' }`
- **When**: TypeScript attempts to compile `token.type = 'ruby'`
- **Then**: TypeScript emits `TS2540` ("Cannot assign to 'type' because it is a read-only property")
- **Coverage**: Confirms `.readonly()` on `z.literal('text')` emits the `readonly` modifier in the inferred type
- **Note**: Expressed in Vitest using `@ts-expect-error`:

```typescript
// @ts-expect-error — type is readonly
token.type = "ruby";
```

If the `@ts-expect-error` is not suppressing an actual error (i.e., the property is not `readonly`), Vitest's type-checking mode flags the directive as unused, which surfaces the missing `readonly`.

### Integration Tests

Not applicable for this task. The schema module has no runtime dependencies beyond Zod and no integration surface (no API calls, no DB, no React components).

### E2E Tests

Not applicable. The schema module has no user-facing behavior.

---

## Implementation Checklist

- [x] Create `app/schema/furigana.ts` with the exact content from Subtask 1.1
- [x] Verify `import * as z from 'zod'` import style (matches `app/schema/user.ts` convention)
- [x] Confirm `TextTokenSchema` uses `z.literal('text').readonly()` for the `type` field
- [x] Confirm `RubyTokenSchema` uses `z.literal('ruby').readonly()` for the `type` field
- [x] Confirm `TextTokenSchema.value` has the regex refinement rejecting `{...}` patterns
- [x] Confirm `RubyTokenSchema.kanji` and `RubyTokenSchema.reading` both have `.min(1)`
- [x] Confirm `FuriganaTokenSchema` uses `z.discriminatedUnion` (not `z.union`)
- [x] Confirm all three types (`TextToken`, `RubyToken`, `FuriganaToken`) are derived via `z.infer`
- [x] Confirm `isTextToken` and `isRubyToken` use the `token is X` predicate return type form
- [x] Confirm no default exports — all exports are named
- [x] Run `pnpm type-check` — zero errors
- [x] Run `pnpm exec eslint app/schema/furigana.ts` — zero lint warnings or errors

---

## Notes & Considerations

**Why Zod instead of pure TypeScript types**: Pure TypeScript types are erased at runtime. The parser (Task 6) produces token objects from AI-generated strings — strings that can contain anything. Zod schemas validate those objects at the boundary where AI output enters the typed system. A `FuriganaTokenSchema.safeParse(candidate)` call in the parser gives a `ZodError` with field-level details instead of a silent type assertion failure. For the M2 persistence layer, Zod also validates JSON deserialized from Turso DB without any adapter code.

**Why `z.literal(...).readonly()` and not manual `readonly` in the type**: When types are derived with `z.infer`, all properties are mutable by default unless the schema emits `readonly`. The `.readonly()` chain on the literal schema is the Zod v4 mechanism to emit `readonly` on a specific field in the inferred type. An alternative is `z.object({...}).readonly()` at the object level, which makes all inferred properties `readonly` — but this applies transitively to nested objects and may be over-broad. Applying `.readonly()` only to the discriminant `type` field is the minimal and most explicit approach. If full immutability is needed on all fields in a future refactor, switch to object-level `.readonly()`.

**Why the regex rejects both `{` and `}`**: The annotation format from the AI is `漢字{よみ}`. A text segment that somehow contains either brace character is almost certainly a parser bug — either the parser failed to split on a brace group or the AI returned a malformed string. Rejecting both characters (not just the `{...}` pair) at the schema level catches both failure modes. The regex `^(?:[^{}])*$` means: zero or more characters that are neither `{` nor `}`.

**Why `kanji` and `reading` have `.min(1)` but `value` does not**: An empty `kanji` or `reading` would produce a `<ruby>` element with no text or no annotation — semantically broken HTML. An empty `value` on a `TextToken` is valid (it can represent a zero-width text segment between two ruby tokens) and imposes no rendering problem. `.min(1)` is not applied to `value`.

**Why `z.discriminatedUnion` over `z.union`**: `z.discriminatedUnion` reads the discriminant field first and selects the correct schema branch directly, making it O(1) per parse. `z.union` tries each branch sequentially, making it O(n). For two members this is negligible, but `discriminatedUnion` also enforces at schema-construction time that all members have a `z.literal` discriminant — this is a valuable structural guarantee. Always prefer `discriminatedUnion` when members share a literal-typed field.

**No barrel file**: `app/schema/index.ts` is intentionally omitted. Add a barrel if and when the directory reaches three or more files and consumers are importing from multiple files within it.

**ESLint import style for consumers**: When Task 12 imports `FuriganaToken` only for type annotations, it must use `import type { FuriganaToken } from '~/schema/furigana'`. When it also imports `isRubyToken` for runtime use and `FuriganaTokenSchema` for validation, the split pattern is:

```typescript
import { FuriganaTokenSchema, isRubyToken } from "~/schema/furigana";
import type { FuriganaToken } from "~/schema/furigana";
```

This is required by the project's `consistent-type-imports: 'inline'` ESLint rule. Document this expectation in Task 12's plan.
