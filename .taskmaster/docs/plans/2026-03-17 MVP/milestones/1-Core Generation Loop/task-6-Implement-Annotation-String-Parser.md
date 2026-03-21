# Task 6: Implement Annotation String Parser

**Project**: Furigana MVP — AI Japanese Reading Assistant
**Generated**: 2026-03-19 (revised 2026-03-19)
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`
**Canonical plan location**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-task-6-Implement-Annotation-String-Parser.md`

---

## Overview

Create `app/lib/furigana/parser.ts` containing the `parseAnnotationString` function — the boundary module between raw AI-generated annotation strings and the typed `FuriganaToken[]` array consumed by the renderer.

The parser implements a single-pass character-by-character state machine that splits an annotation string of the form `"東京{とうきょう}に行{い}きました"` into an array of `TextToken` and `RubyToken` objects. It must never throw, never produce HTML in token values, and handle all malformed input gracefully by treating unparseable fragments as literal text.

This is the highest-risk unit in Milestone 1: if it emits wrong tokens, every downstream rendering, persistence, and display layer is affected.

**This revision also covers a required rename in the existing schema file** (`app/schema/furigana.ts`): the `RubyToken` property `reading` is renamed to `yomi` before the parser is implemented, so that the parser and all test code use the canonical field name from the start.

---

## Requirements Analysis

### Functional Requirements

- Export `parseAnnotationString(input: string): FuriganaToken[]` from `app/lib/furigana/parser.ts`.
- Implement a character-by-character state machine with three states: `text` (accumulating plain text), `kanji` (accumulating the kanji portion preceding a `{`), and `reading` (accumulating characters inside `{...}`).
- On encountering `{`: transition from `text` state to `reading` state, treating the accumulated buffer as the kanji of the upcoming ruby token.
- On encountering `}`: finalize the ruby token; transition back to `text` state.
- At end-of-input: flush any remaining buffer as a `TextToken` (unless the buffer is empty).
- Return `[]` for empty string input.
- Never throw on malformed input; treat unclosed `{` and its preceding/following text as literal text.
- Never produce HTML characters in token values (the parser is purely string-splitting; no encoding step is needed since token values go directly into JSX interpolation, not `innerHTML`).
- Handle adjacent ruby tokens (no `TextToken` between consecutive `kanji{reading}` groups) correctly.
- Construct `RubyToken` objects using the field name `yomi` (not `reading`) to match the renamed schema field.

### Schema Conflict Resolution

`app/schema/furigana.ts` (Task 5, already implemented) defines:

- `TextTokenSchema.value` must match `/^(?:[^{}])*$/` — values containing `{` or `}` are rejected.
- `RubyTokenSchema.kanji` and `RubyTokenSchema.yomi` both require `.min(1)` — empty strings are rejected.

**Note on field rename**: The schema was originally generated with `reading` as the field name. This plan requires renaming it to `yomi` (Japanese: 読み, "reading/pronunciation") before the parser is written. See the "Codebase Changes Required" section for the exact edits to `app/schema/furigana.ts` and `app/schema/furigana.test.ts`.

These constraints create the following conflicts with naive parser designs:

| Edge case     | Conflict                                                           |
| ------------- | ------------------------------------------------------------------ |
| `"unclosed{"` | Buffer ends with `{`; if emitted as `TextToken.value`, fails regex |
| `"text{}"`    | Empty yomi string; `RubyToken.yomi` fails `.min(1)`                |
| `"{reading}"` | Empty kanji string; `RubyToken.kanji` fails `.min(1)`              |

**Resolution — Option 3 (import types only, skip Zod validation in the parser)**:

The parser imports `FuriganaToken`, `TextToken`, and `RubyToken` as TypeScript types only (using `import type`). It constructs plain objects that satisfy the TypeScript structural types without passing them through Zod schema validation.

Rationale:

- The parser's correctness guarantee is its state machine logic, not Zod validation.
- The edge-case conflicts above are handled by the state machine itself: unclosed `{` is reconstructed as literal text (including the `{` character). This means the emitted `TextToken.value` for `"unclosed{"` would contain `{`, which **does** violate `TextTokenSchema`. However, the parser is not the validation boundary — the action layer (Task 8) calls `FuriganaTokenSchema.safeParse` on the full array after parsing. That boundary is the correct place for schema validation of AI-sourced content.
- The `TextTokenSchema` regex constraint is an invariant about well-formed AI output, not a constraint the parser must enforce internally on its own intermediate state. The parser's invariant is: "never crash, never lose characters from the input."
- For the empty-yomi case (`"text{}"`), the parser emits the whole fragment as a `TextToken` with value `"text{}"`. This again violates `TextTokenSchema`, but the action layer will catch it, log it, and surface an error to the user — the correct behavior for malformed AI output.

**Documented behavior for edge cases**:

| Input                   | Output                                                                                                  | Rationale                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `"unclosed{"`           | `[{ type:'text', value:'unclosed{' }]`                                                                  | Treat whole fragment as text; action validates     |
| `"text{}"`              | `[{ type:'text', value:'text{}' }]`                                                                     | Empty yomi treated as malformed; fallback to text  |
| `"{reading}"`           | `[{ type:'text', value:'{reading}' }]`                                                                  | Empty kanji treated as malformed; fallback to text |
| `"bad{nested{braces}}"` | `[{ type:'ruby', kanji:'bad', yomi:'nested{braces' }, { type:'text', value:'}' }]` — see algorithm note |

The nested brace case is handled by the state machine naturally: once inside `reading` state, encountering `{` is treated as a literal character in the yomi buffer (since the machine does not recurse). The first `}` closes the yomi. The trailing `}` is flushed as a `TextToken`. This is deterministic and does not crash.

### Non-Functional Requirements

- **No throws**: The function wraps no logic in `try/catch` because the algorithm itself contains no operations that can throw (no regex exec on user input, no array index access that could be out of bounds under `noUncheckedIndexedAccess`).
- **`noUncheckedIndexedAccess` safety**: Character-by-character iteration uses `for...of` over the string — each iteration yields a `string` character with no index access, so `T | undefined` never appears.
- **`verbatimModuleSyntax`**: Type-only imports use `import type {}`.
- **No `any`, no `as` casts**: Token objects are constructed as object literals that satisfy the structural type. The return type annotation `FuriganaToken[]` provides inference — no cast is needed.
- **Pure function**: No side effects, no module-level state, no imports from `app/lib/ai/` or any server-only module. The parser can safely be imported by both server and client code.
- **Performance**: Single-pass O(n) where n is input length. No regex, no split, no intermediate array joins until the final flush step.

### Dependencies & Constraints

- **Depends on Task 5**: `app/schema/furigana.ts` must be implemented and passing type-check. (It is — Task 5 is complete.) The `reading` → `yomi` rename described in this plan must be applied to that file before the parser is written.
- **Depended on by Task 7** (test file) and Task 8 (server action that calls the parser).
- **No new runtime dependencies**: The parser uses only TypeScript built-ins. No additional packages needed.
- **File location**: `app/lib/furigana/parser.ts`. The `app/lib/furigana/` directory does not yet exist and must be created implicitly by creating the file.
- **Path alias**: Consumers import as `import { parseAnnotationString } from '~/lib/furigana/parser'`.
- **Test file**: `app/lib/furigana/parser.test.ts` (covered in Phase 3 below). Vitest coverage is configured to include `app/lib/**/*.ts`, so this file is automatically included in the coverage report.

---

## Codebase Changes Required

These edits must be applied to existing files **before** writing the parser or the parser test file. Both changes are mechanical renames with no logic changes.

### Edit 1: `app/schema/furigana.ts` — rename `reading` to `yomi`

**File**: `/Users/danbilee/Projects/furigana/app/schema/furigana.ts`

Exact replacement (line 24 in the current file):

```diff
-  reading: z.string().min(1),
+  yomi: z.string().min(1),
```

The JSDoc comment on the schema (line 19–21) does not need to change — it describes the schema purpose, not the field name. The inferred `RubyToken` TypeScript type will automatically update to `{ readonly type: "ruby"; kanji: string; yomi: string }` after the rename.

Full updated `RubyTokenSchema` block for reference:

```typescript
/**
 * Schema for a kanji compound paired with its furigana reading.
 */
export const RubyTokenSchema = z.object({
  type: z.literal("ruby").readonly(),
  kanji: z.string().min(1),
  yomi: z.string().min(1),
});
```

No other lines in `furigana.ts` reference the string `"reading"` — all other references are through the inferred type, which updates automatically.

### Edit 2: `app/schema/furigana.test.ts` — update `reading` references to `yomi`

**File**: `/Users/danbilee/Projects/furigana/app/schema/furigana.test.ts`

There are five occurrences of `reading:` in the test file. Each must be replaced with `yomi:`. No structural changes to the tests are needed — only the field name in object literals changes.

**Occurrence 1** — `RubyTokenSchema` "parses a valid ruby token" test (lines 53–64):

```diff
-    const result = RubyTokenSchema.parse({
-      type: "ruby",
-      kanji: "東京",
-      reading: "とうきょう",
-    });
-
-    expect(result).toEqual({
-      type: "ruby",
-      kanji: "東京",
-      reading: "とうきょう",
-    });
+    const result = RubyTokenSchema.parse({
+      type: "ruby",
+      kanji: "東京",
+      yomi: "とうきょう",
+    });
+
+    expect(result).toEqual({
+      type: "ruby",
+      kanji: "東京",
+      yomi: "とうきょう",
+    });
```

**Occurrence 2** — "rejects empty kanji" test (lines 66–73):

```diff
-    const result = RubyTokenSchema.safeParse({
-      type: "ruby",
-      kanji: "",
-      reading: "とうきょう",
-    });
+    const result = RubyTokenSchema.safeParse({
+      type: "ruby",
+      kanji: "",
+      yomi: "とうきょう",
+    });
```

**Occurrence 3** — "rejects empty reading" test (lines 75–83). Also rename the `it` description:

```diff
-  it("rejects empty reading", () => {
-    const result = RubyTokenSchema.safeParse({
-      type: "ruby",
-      kanji: "東京",
-      reading: "",
-    });
+  it("rejects empty yomi", () => {
+    const result = RubyTokenSchema.safeParse({
+      type: "ruby",
+      kanji: "東京",
+      yomi: "",
+    });
```

**Occurrence 4** — `FuriganaTokenSchema` "parses a ruby token through the union schema" test (lines 94–101):

```diff
-    const result = FuriganaTokenSchema.parse({
-      type: "ruby",
-      kanji: "行",
-      reading: "い",
-    });
-
-    expect(result).toEqual({ type: "ruby", kanji: "行", reading: "い" });
+    const result = FuriganaTokenSchema.parse({
+      type: "ruby",
+      kanji: "行",
+      yomi: "い",
+    });
+
+    expect(result).toEqual({ type: "ruby", kanji: "行", yomi: "い" });
```

**Occurrence 5** — `type guards` "isRubyToken narrows ruby tokens" test (lines 128–133):

```diff
-    const token: FuriganaToken = {
-      type: "ruby",
-      kanji: "漢字",
-      reading: "かんじ",
-    };
+    const token: FuriganaToken = {
+      type: "ruby",
+      kanji: "漢字",
+      yomi: "かんじ",
+    };
```

After both edits, run `pnpm type-check` and `pnpm exec vitest run app/schema/furigana.test.ts` to confirm no regressions before proceeding to Phase 2.

---

## Implementation Plan

### Phase 1: Apply Schema Rename

**Objective**: Rename `reading` to `yomi` in the existing schema and schema test file before any parser code is written. This ensures the parser is written against the canonical field name from the start.

#### Subtask 1.1: Edit `app/schema/furigana.ts`

- **Files to modify**: `app/schema/furigana.ts`
- **Change**: Replace `reading: z.string().min(1)` with `yomi: z.string().min(1)` in `RubyTokenSchema`.
- **Key considerations**: The `RubyToken` type is inferred — no explicit type definition needs updating. All downstream consumers that reference `token.reading` will now produce a TypeScript error, making it easy to find and fix them.
- **Acceptance criteria**: `pnpm type-check` reports errors only in `furigana.test.ts` (expected — those will be fixed in Subtask 1.2). No errors in `furigana.ts` itself.

#### Subtask 1.2: Edit `app/schema/furigana.test.ts`

- **Files to modify**: `app/schema/furigana.test.ts`
- **Change**: Apply the five `reading` → `yomi` replacements described in "Codebase Changes Required" above.
- **Key considerations**: This is a mechanical rename. The test logic and assertions are unchanged — only the field name in object literals changes.
- **Acceptance criteria**:
  - `pnpm type-check` exits with code 0.
  - `pnpm exec vitest run app/schema/furigana.test.ts` exits with code 0 with all 12 tests passing.

---

### Phase 2: Create the Parser Module

**Objective**: Write `app/lib/furigana/parser.ts` with the complete state machine implementation, satisfying all TypeScript strict-mode constraints and using `yomi` in all `RubyToken` object literals.

#### Subtask 2.1: Create the directory and parser file

- **Files to create**: `app/lib/furigana/parser.ts` (new file; creates the `furigana/` subdirectory implicitly).
- **Code pattern**: Single-pass state machine using `for...of` string iteration. See "Code Patterns" section for the full implementation.
- **Key considerations**:
  - Use `for...of` over the input string, not `for (let i = 0; i < input.length; i++)`. The `noUncheckedIndexedAccess` flag makes index access return `string | undefined`; `for...of` over a `string` yields `string` characters directly, avoiding this complication.
  - The state machine has exactly two states represented by a string literal union type defined locally in the file: `type ParserState = 'text' | 'reading'`. The kanji candidate is held in `textBuffer` during the `reading` state.
  - Maintain two mutable string buffers: `textBuffer` (accumulates characters in `text` state; holds the kanji candidate while in `reading` state) and `yomiBuffer` (accumulates characters in `reading` state).
  - The `result` array is `FuriganaToken[]`, built up by pushing tokens as they are finalized.
  - On `{`: switch state to `reading`; `textBuffer` is retained as the kanji candidate; clear `yomiBuffer`.
  - On `}`: attempt to finalize a `RubyToken` from `textBuffer` (kanji) and `yomiBuffer` (yomi). If either is empty, reconstruct the raw fragment as a `TextToken` instead. Clear both buffers; switch state to `text`.
  - On any other character: append to `textBuffer` (if state is `text`) or `yomiBuffer` (if state is `reading`).
  - At end-of-input: if state is `reading` (unclosed brace), reconstruct the raw fragment (`textBuffer + '{' + yomiBuffer`) as a `TextToken`. If state is `text` and `textBuffer` is non-empty, emit it as a `TextToken`.
  - Push `TextToken` only when the value is non-empty, to avoid emitting zero-width tokens unnecessarily.
  - The function must never mutate its input.
  - All `RubyToken` object literals must use `yomi` (not `reading`) as the field name.
- **Acceptance criteria**:
  - File exists at `app/lib/furigana/parser.ts`.
  - `pnpm type-check` exits with code 0.
  - `pnpm exec eslint app/lib/furigana/parser.ts` exits with code 0.
  - Manual smoke test: `parseAnnotationString("東京{とうきょう}に行{い}きました")` returns a 4-element array: two `RubyToken`s and two `TextToken`s.

#### Subtask 2.2: Validate import style and ESLint compliance

- **Files to modify**: `app/lib/furigana/parser.ts` (review only — no edits expected).
- **Key considerations**:
  - The file must use `import type { FuriganaToken } from '~/schema/furigana'`. Since `TextToken` and `RubyToken` are only used as the types of object literals (inferred structurally), they may not need to be explicitly imported — verify during implementation.
  - `verbatimModuleSyntax` is enabled, so any type-only import that uses a plain `import {}` will be flagged by the compiler. Use `import type {}` for all type-only symbols.
  - No runtime import from `~/schema/furigana` is needed (no `FuriganaTokenSchema.parse()` call in the parser).
- **Acceptance criteria**:
  - No ESLint `@typescript-eslint/consistent-type-imports` violations.
  - No `verbatimModuleSyntax` TypeScript errors.

---

### Phase 3: Write the Test Suite

**Objective**: Create `app/lib/furigana/parser.test.ts` with comprehensive coverage of the state machine, including all PRD edge cases, token shape integrity tests, and paragraph-level realistic tests.

#### Subtask 3.1: Create the test file

- **Files to create**: `app/lib/furigana/parser.test.ts`.
- **Code pattern**: Vitest `describe`/`it` blocks with `expect().toEqual()` for exact array comparison. See "Test Cases" section for the full suite.
- **Key considerations**:
  - Vitest is configured with `globals: true`, so `describe`, `it`, and `expect` are available without import.
  - Import the parser with `import { parseAnnotationString } from '~/lib/furigana/parser'` — the path alias resolves via `vite-tsconfig-paths`.
  - Use `import type` if any type symbols from `~/schema/furigana` are needed for variable annotations in tests.
  - All expected `RubyToken` objects in test assertions must use `yomi` (not `reading`).
  - Coverage target: 100% line coverage of `app/lib/furigana/parser.ts`. The vitest coverage config already includes `app/lib/**/*.ts`.
  - Order tests from simplest (empty string, plain text) to most complex (paragraph-level), matching the state machine's code paths.
- **Acceptance criteria**:
  - `pnpm exec vitest run app/lib/furigana/parser.test.ts` exits with code 0.
  - `pnpm exec vitest run --coverage app/lib/furigana/parser.ts` reports 100% line coverage.
  - `pnpm type-check` exits with code 0 (test file must also pass type-check, since `tsconfig.json` includes `**/*`).

---

### Phase 4: Verification

**Objective**: Confirm the implementation satisfies type-check, lint, and test runner in a single clean run.

#### Subtask 4.1: Full verification pass

- **Files to modify**: None.
- **Commands** (run in sequence):
  1. `pnpm type-check` — zero TypeScript errors
  2. `pnpm exec eslint app/lib/furigana/` — zero lint errors or warnings
  3. `pnpm exec vitest run app/schema/furigana.test.ts` — all schema tests still pass after rename
  4. `pnpm exec vitest run app/lib/furigana/parser.test.ts` — all parser tests pass
  5. `pnpm exec vitest run --coverage` — 100% line coverage on parser file
- **Acceptance criteria**: All five commands exit with code 0.

---

## Third-Party Integration Research

### Vitest v4.1.0 (to be installed; currently not yet in package.json per tech stack memory)

- **Official docs**: https://vitest.dev — v4 docs. Relevant sections: configuration (`defineConfig`), globals mode, `environment: 'node'`, coverage provider `v8`.
- **Recent changes**: Vitest v4 (released 2025) maintains compatibility with the v3 API for `describe`/`it`/`expect`. The `globals: true` option and `environment: 'node'` config are unchanged. Coverage with `@vitest/coverage-v8` works the same as v3.
- **Open issues / known bugs**: No blocking issues found for the file-based unit testing pattern used here. The `for...of` string iteration in the parser produces no async code, so Vitest's async handling is not exercised.
- **Security advisories**: None relevant.
- **Performance notes**: The parser is a pure synchronous function; test execution will be sub-millisecond per test. A suite of 23 tests will complete in under 100ms.
- **Case studies**: The existing `app/schema/furigana.test.ts` uses the identical Vitest setup (no imports for globals, `describe`/`it` used directly). Follow the same pattern.

> No `Needs Review` items identified.

### Zod v4.0.0 (installed; used by `~/schema/furigana` but NOT called in the parser)

- **Usage in this task**: The parser imports types derived from Zod schemas but does not call any Zod runtime methods. No `parse`, `safeParse`, or schema construction occurs in `parser.ts`.
- **Relevant note**: The `TextToken` and `RubyToken` types inferred by Zod v4 are structurally equivalent to `{ readonly type: 'text'; value: string }` and `{ readonly type: 'ruby'; kanji: string; yomi: string }` respectively (after the rename). Object literals in the parser that match these shapes satisfy the structural types without casting.
- **No Needs Review items** for this specific usage.

---

## Code Patterns

### Pattern 1: State Machine with `for...of` String Iteration

```typescript
// app/lib/furigana/parser.ts

import type { FuriganaToken } from "~/schema/furigana";

type ParserState = "text" | "reading";

export function parseAnnotationString(input: string): FuriganaToken[] {
  if (input.length === 0) return [];

  const result: FuriganaToken[] = [];
  let state: ParserState = "text";
  let textBuffer = "";
  let yomiBuffer = "";

  for (const char of input) {
    if (char === "{") {
      if (state === "text") {
        // Transition: text -> reading; textBuffer becomes the kanji candidate
        state = "reading";
        // textBuffer holds the kanji; do not flush it yet — wait for '}'
      } else {
        // Already in reading state: treat '{' as a literal yomi character
        yomiBuffer += char;
      }
    } else if (char === "}") {
      if (state === "reading") {
        // Attempt to finalize a RubyToken
        if (textBuffer.length > 0 && yomiBuffer.length > 0) {
          result.push({ type: "ruby", kanji: textBuffer, yomi: yomiBuffer });
        } else {
          // Malformed: empty kanji or empty yomi — reconstruct as TextToken
          const raw = textBuffer + "{" + yomiBuffer + "}";
          if (raw.length > 0) {
            result.push({ type: "text", value: raw });
          }
        }
        textBuffer = "";
        yomiBuffer = "";
        state = "text";
      } else {
        // In text state: stray '}' is a literal character
        textBuffer += char;
      }
    } else {
      if (state === "text") {
        textBuffer += char;
      } else {
        yomiBuffer += char;
      }
    }
  }

  // End-of-input flush
  if (state === "reading") {
    // Unclosed '{': reconstruct full fragment as TextToken
    const raw = textBuffer + "{" + yomiBuffer;
    if (raw.length > 0) {
      result.push({ type: "text", value: raw });
    }
  } else if (textBuffer.length > 0) {
    result.push({ type: "text", value: textBuffer });
  }

  return result;
}
```

**Where to apply**: `app/lib/furigana/parser.ts` — this is the complete implementation.

**Why this pattern**:

- `for...of` over a `string` in JavaScript/TypeScript iterates Unicode code points, not UTF-16 code units. This correctly handles multi-byte CJK characters (each CJK character is a single code point and a single `for...of` iteration step).
- The `noUncheckedIndexedAccess` flag would require `input[i]` to have type `string | undefined` under index-based iteration. `for...of` yields `string` directly, avoiding this complication without any type assertions.
- Two separate string buffers (`textBuffer`, `yomiBuffer`) avoid array allocation overhead during character accumulation. String concatenation is idiomatic for short sequences in this domain.
- The `ParserState` union type is local to the file — it is not exported because no other module needs to inspect the parser's internal state.

**Why `type: "ruby"` object literal satisfies `RubyToken`**:

`RubyToken` is inferred as `{ readonly type: "ruby"; kanji: string; yomi: string }`. The `readonly` modifier on the `type` field means the property cannot be reassigned after construction, but constructing a fresh object literal `{ type: "ruby", kanji: ..., yomi: ... }` satisfies the type because object literals are assignable to types with `readonly` properties — the `readonly` constraint only prohibits post-construction mutation, not construction itself. No `as` cast or `satisfies` operator is needed.

### Pattern 2: Test File Structure Matching Existing `furigana.test.ts` Convention

```typescript
// app/lib/furigana/parser.test.ts

import { parseAnnotationString } from "~/lib/furigana/parser";

describe("parseAnnotationString", () => {
  describe("base cases", () => {
    it("returns [] for empty string", () => {
      expect(parseAnnotationString("")).toEqual([]);
    });
  });

  describe("plain text inputs", () => {
    it("wraps a plain hiragana string in a single TextToken", () => {
      expect(parseAnnotationString("こんにちは")).toEqual([{ type: "text", value: "こんにちは" }]);
    });
  });

  // ... additional describe blocks per edge case category
});
```

**Where to apply**: `app/lib/furigana/parser.test.ts`.

**Why this pattern**: The existing `app/schema/furigana.test.ts` uses the same structure — `describe` blocks grouping related cases, `it` for individual assertions, `expect().toEqual()` for deep equality. Maintaining the same convention keeps the test suite readable without learning a new style.

---

## Test Cases

### Unit Tests

#### Test Suite: `parseAnnotationString` — Base Cases

**Test 1**: Returns empty array for empty string

- **Given**: `input = ""`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[]`
- **Coverage**: Detects regressions where the function tries to process an empty string and emits a spurious token

**Test 2**: Returns a single `TextToken` for plain hiragana

- **Given**: `input = "こんにちは"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: 'こんにちは' }]`
- **Coverage**: Confirms the text-only path emits a correctly typed TextToken; detects off-by-one in the end-of-input flush

**Test 3**: Returns a single `TextToken` for plain romaji

- **Given**: `input = "Hello world"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: 'Hello world' }]`
- **Coverage**: Confirms the parser is encoding-agnostic; pure ASCII is not treated specially

#### Test Suite: `parseAnnotationString` — Single Ruby Token

**Test 4**: Parses a single annotated kanji compound with no surrounding text

- **Given**: `input = "日本語{にほんご}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: '日本語', yomi: 'にほんご' }]`
- **Coverage**: Core happy path; detects failure to emit a RubyToken or to correctly attribute the kanji buffer

**Test 5**: Parses an annotated single kanji character

- **Given**: `input = "行{い}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: '行', yomi: 'い' }]`
- **Coverage**: Confirms single-character kanji is handled; detects fence-post error on the first `{`

**Test 6**: Parses ruby token followed by trailing text

- **Given**: `input = "行{い}きました"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: '行', yomi: 'い' }, { type: 'text', value: 'きました' }]`
- **Coverage**: Confirms the state machine correctly returns to `text` state after `}` and flushes remaining text at end-of-input

**Test 7**: Parses leading text followed by a ruby token

- **Given**: `input = "私は東京{とうきょう}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: '私は' }, { type: 'ruby', kanji: '東京', yomi: 'とうきょう' }]`
- **Coverage**: Confirms the text buffer accumulated before `{` is correctly used as the kanji, not as a preceding TextToken

#### Test Suite: `parseAnnotationString` — Multiple Tokens

**Test 8**: Parses two adjacent ruby tokens with no text between them

- **Given**: `input = "漢字{かんじ}漢字{かんじ}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: '漢字', yomi: 'かんじ' }, { type: 'ruby', kanji: '漢字', yomi: 'かんじ' }]`
- **Coverage**: Detects a bug where the state machine emits a spurious empty TextToken between consecutive ruby tokens

**Test 9**: Parses two ruby tokens separated by hiragana text (PRD primary example)

- **Given**: `input = "東京{とうきょう}に行{い}きました"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: '東京', yomi: 'とうきょう' }, { type: 'text', value: 'に' }, { type: 'ruby', kanji: '行', yomi: 'い' }, { type: 'text', value: 'きました' }]`
- **Coverage**: End-to-end PRD example; detects incorrect token boundaries or lost characters

**Test 10**: Parses two ruby tokens with punctuation at the end

- **Given**: `input = "東京{とうきょう}は元気{げんき}？"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: '東京', yomi: 'とうきょう' }, { type: 'text', value: 'は' }, { type: 'ruby', kanji: '元気', yomi: 'げんき' }, { type: 'text', value: '？' }]`
- **Coverage**: Confirms punctuation after the last annotation is captured; detects premature end-of-input flush

#### Test Suite: `parseAnnotationString` — Malformed Input (Safety)

**Test 11**: Treats unclosed `{` as literal text

- **Given**: `input = "unclosed{"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: 'unclosed{' }]`
- **Coverage**: The most important safety test; detects any path where the function throws instead of recovering

**Test 12**: Treats `{}` (empty yomi) as literal text

- **Given**: `input = "text{}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: 'text{}' }]`
- **Coverage**: Detects a parser that emits an invalid RubyToken with empty yomi, which would fail Zod validation upstream

**Test 13**: Treats a group with empty kanji (`{reading}`) as literal text

- **Given**: `input = "{reading}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: '{reading}' }]`
- **Coverage**: Detects a parser that emits a RubyToken with empty kanji

**Test 14**: Handles nested braces without crashing

- **Given**: `input = "bad{nested{braces}}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'ruby', kanji: 'bad', yomi: 'nested{braces' }, { type: 'text', value: '}' }]`
- **Coverage**: Critical safety test — no exception on adversarial input

  **Algorithm note for nested braces**: With the state machine as written, when processing `"bad{nested{braces}}"`:
  - `b`, `a`, `d` → textBuffer = `"bad"`
  - `{` → state = `reading`, textBuffer stays `"bad"`, yomiBuffer = `""`
  - `n`, `e`, `s`, `t`, `e`, `d` → yomiBuffer = `"nested"`
  - `{` → state is already `reading`; yomiBuffer += `{` → yomiBuffer = `"nested{"`
  - `b`, `r`, `a`, `c`, `e`, `s` → yomiBuffer = `"nested{braces"`
  - `}` → state = `reading`; both textBuffer (`"bad"`) and yomiBuffer (`"nested{braces"`) are non-empty → emit `{ type: 'ruby', kanji: 'bad', yomi: 'nested{braces' }`; state = `text`, buffers cleared
  - `}` → state = `text`; stray `}` → textBuffer += `}` → textBuffer = `"}"`
  - end-of-input → emit `{ type: 'text', value: '}' }`

  Final: `[{ type: 'ruby', kanji: 'bad', yomi: 'nested{braces' }, { type: 'text', value: '}' }]`

**Test 15**: Handles stray `}` in plain text

- **Given**: `input = "text}more"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: 'text}more' }]`
- **Coverage**: Detects a parser that crashes on `}` when not in reading state

**Test 16**: Handles string that is only braces

- **Given**: `input = "{}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: '{}' }]`
- **Coverage**: Empty-kanji + empty-yomi case; no RubyToken should be emitted

**Test 17**: Handles string that is only `{`

- **Given**: `input = "{"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns `[{ type: 'text', value: '{' }]`
- **Coverage**: Minimal unclosed brace; ensures end-of-input flush for single-character input

#### Test Suite: `parseAnnotationString` — Token Shape Integrity

**Test 18**: Emitted `TextToken` objects have correct shape

- **Given**: `input = "こんにちは"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: `result[0]` satisfies `{ type: 'text', value: string }` and has no extra properties
- **Coverage**: Detects accidental extra fields (e.g., a `kanji` field left on a text token from a copy-paste bug)

**Test 19**: Emitted `RubyToken` objects have correct shape

- **Given**: `input = "行{い}"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: `result[0]` satisfies `{ type: 'ruby', kanji: string, yomi: string }` and has no extra properties
- **Coverage**: Confirms that the `yomi` field (not `reading`) is present and the object contains exactly the three expected keys

**Test 20**: No characters from the input are lost

- **Given**: `input = "東京{とうきょう}に行{い}きました"`
- **When**: `parseAnnotationString(input)` is called and all token values are concatenated
- **Then**: `tokens.map(t => t.type === 'ruby' ? t.kanji + t.yomi : t.value).join('')` equals the set of all non-brace characters in the input (minus the annotation delimiters `{` and `}`)
- **Coverage**: Detects character loss anywhere in the state machine — the most general correctness invariant

#### Test Suite: `parseAnnotationString` — Paragraph-Level Tests

These tests use realistic annotation strings representative of GPT-4o-mini output for authentic Japanese text. They verify the parser under real-world load: many consecutive ruby tokens, interspersed plain text, varied kanji density, and sentence-ending punctuation.

**Test 21**: News article excerpt — moderate kanji density with sentence-final verb form

- **Given**: `input = "今日{きょう}、日本{にほん}の首相{しゅしょう}が新{あたら}しい政策{せいさく}を発表{はっぴょう}しました。"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns exactly:
  ```
  [
    { type: 'ruby', kanji: '今日',   yomi: 'きょう'    },
    { type: 'text', value: '、'                         },
    { type: 'ruby', kanji: '日本',   yomi: 'にほん'    },
    { type: 'text', value: 'の'                         },
    { type: 'ruby', kanji: '首相',   yomi: 'しゅしょう'},
    { type: 'text', value: 'が'                         },
    { type: 'ruby', kanji: '新',     yomi: 'あたら'    },
    { type: 'text', value: 'しい'                       },
    { type: 'ruby', kanji: '政策',   yomi: 'せいさく'  },
    { type: 'text', value: 'を'                         },
    { type: 'ruby', kanji: '発表',   yomi: 'はっぴょう'},
    { type: 'text', value: 'しました。'                 },
  ]
  ```
- **Coverage**: Verifies that Japanese punctuation (、。) is correctly passed through as `TextToken` values; detects boundary errors between ruby tokens and grammatical particles; confirms a 6-ruby-token sequence with alternating text is tokenized without character loss.

**Test 22**: Classic literature excerpt — low kanji density, all annotations immediately followed by end-of-sentence

- **Given**: `input = "吾輩{わがはい}は猫{ねこ}である。名前{なまえ}はまだ無{な}い。"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns exactly:
  ```
  [
    { type: 'ruby', kanji: '吾輩', yomi: 'わがはい' },
    { type: 'text', value: 'は'                      },
    { type: 'ruby', kanji: '猫',   yomi: 'ねこ'     },
    { type: 'text', value: 'である。'                },
    { type: 'ruby', kanji: '名前', yomi: 'なまえ'   },
    { type: 'text', value: 'はまだ'                  },
    { type: 'ruby', kanji: '無',   yomi: 'な'        },
    { type: 'text', value: 'い。'                    },
  ]
  ```
- **Coverage**: Verifies multi-character plain text segments between ruby tokens (e.g., `"である。"`, `"はまだ"`) are emitted as a single `TextToken` without being split; detects premature flush on Japanese full-stop `。` character; confirms correct handling of a two-sentence paragraph as a single input string.

**Test 23**: Long compound sentence — high kanji density with many consecutive ruby+text alternations

- **Given**: `input = "東京{とうきょう}と大阪{おおさか}は日本{にほん}の二{ふた}つの大{おお}きな都市{とし}であり、経済{けいざい}と文化{ぶんか}の中心{ちゅうしん}として知{し}られています。"`
- **When**: `parseAnnotationString(input)` is called
- **Then**: Returns exactly:
  ```
  [
    { type: 'ruby', kanji: '東京', yomi: 'とうきょう'  },
    { type: 'text', value: 'と'                          },
    { type: 'ruby', kanji: '大阪', yomi: 'おおさか'    },
    { type: 'text', value: 'は'                          },
    { type: 'ruby', kanji: '日本', yomi: 'にほん'       },
    { type: 'text', value: 'の'                          },
    { type: 'ruby', kanji: '二',   yomi: 'ふた'         },
    { type: 'text', value: 'つの'                        },
    { type: 'ruby', kanji: '大',   yomi: 'おお'         },
    { type: 'text', value: 'きな'                        },
    { type: 'ruby', kanji: '都市', yomi: 'とし'         },
    { type: 'text', value: 'であり、'                    },
    { type: 'ruby', kanji: '経済', yomi: 'けいざい'     },
    { type: 'text', value: 'と'                          },
    { type: 'ruby', kanji: '文化', yomi: 'ぶんか'       },
    { type: 'text', value: 'の'                          },
    { type: 'ruby', kanji: '中心', yomi: 'ちゅうしん'  },
    { type: 'text', value: 'として'                      },
    { type: 'ruby', kanji: '知',   yomi: 'し'           },
    { type: 'text', value: 'られています。'              },
  ]
  ```
- **Coverage**: Stress-tests the state machine with 9 consecutive ruby tokens across a single long sentence; verifies that single-character kanji (`二`, `大`, `知`) with short yomi values are correctly bounded; detects any fence-post error in the transition from `reading` back to `text` state that accumulates incorrectly across many cycles; confirms the full 20-token output matches expected token count.

### Integration Tests

Not applicable for this task. `parseAnnotationString` is a pure function with no I/O, no React rendering, and no external service calls. The integration boundary (parser → action → renderer) is covered by the E2E tests in Task 13.

### E2E Tests

Not applicable for this individual task. The E2E test covering the full annotation loop (textarea input → generation → ruby rendering) is specified in Task 13. Task 6 contributes to that test but has no standalone E2E surface.

---

## Implementation Checklist

### Phase 1: Schema Rename

- [ ] Edit `app/schema/furigana.ts`: replace `reading: z.string().min(1)` with `yomi: z.string().min(1)` in `RubyTokenSchema`
- [ ] Edit `app/schema/furigana.test.ts`: apply all 5 `reading` → `yomi` replacements (including renaming the `it("rejects empty reading")` description)
- [ ] `pnpm type-check` exits with code 0 after both edits
- [ ] `pnpm exec vitest run app/schema/furigana.test.ts` exits with code 0 (all 12 tests pass)

### Phase 2: Parser Implementation

- [ ] Create `app/lib/furigana/` directory (by creating `parser.ts` within it)
- [ ] Implement `parseAnnotationString` with `for...of` state machine in `app/lib/furigana/parser.ts`
- [ ] Confirm `import type { FuriganaToken } from '~/schema/furigana'` (no runtime Zod import)
- [ ] Confirm `for...of` used for character iteration (not index-based access)
- [ ] Confirm `yomiBuffer` used as internal buffer name (consistent with renamed `yomi` field)
- [ ] Confirm all `RubyToken` object literals use `yomi:` (not `reading:`)
- [ ] Confirm no `any` types, no `as` casts
- [ ] Confirm `ParserState` union type is local (not exported)
- [ ] Confirm empty-yomi case emits `TextToken`, not invalid `RubyToken`
- [ ] Confirm empty-kanji case emits `TextToken`, not invalid `RubyToken`
- [ ] Confirm unclosed `{` at end-of-input emits raw fragment as `TextToken`
- [ ] Confirm zero-width `TextToken` values (empty string) are never pushed to result
- [ ] `pnpm type-check` exits with code 0
- [ ] `pnpm exec eslint app/lib/furigana/parser.ts` exits with code 0

### Phase 3: Test Suite

- [ ] Create `app/lib/furigana/parser.test.ts` with all 23 test cases
- [ ] Confirm all expected `RubyToken` objects in tests use `yomi:` (not `reading:`)
- [ ] `pnpm exec vitest run app/lib/furigana/parser.test.ts` exits with code 0
- [ ] `pnpm exec vitest run --coverage` reports 100% line coverage on `parser.ts`
- [ ] `pnpm type-check` exits with code 0 after adding test file

### Phase 4: Final Verification

- [ ] `pnpm exec vitest run app/schema/furigana.test.ts` still passing (no regression from rename)
- [ ] `pnpm exec eslint app/lib/furigana/` exits with code 0
- [ ] Full test suite passing: `pnpm exec vitest run`

---

## Notes & Considerations

**Why the parser does not call `FuriganaTokenSchema.parse()` or `safeParse()`**

The schema conflict analysis above shows that three legitimate parser outputs (`"unclosed{"`, `"text{}"`, `"{reading}"`) would produce values that fail the current Zod schema constraints. Calling `safeParse` inside the parser and falling back on failure would silently swallow parser bugs. The correct architecture is:

- The parser's job: never crash, never lose characters, emit a best-effort `FuriganaToken[]` from any string.
- The action's job (Task 8): call `FuriganaTokenSchema.array().safeParse(tokens)` on the full output. If any token fails, the action surfaces an error to the user ("Something went wrong. Please try again.") and logs the raw annotation string for debugging.

This separation means the schema is the validation boundary for AI output quality, and the parser is the safety boundary for program correctness.

**Why `TextToken.value` is allowed to contain `{` or `}` in the parser's output for malformed input**

The `TextTokenSchema` regex `^(?:[^{}])*$` was designed to catch parser bugs: if a well-formed annotation string is parsed correctly, no `TextToken.value` should ever contain `{` or `}`. But in the malformed-input fallback cases, the parser intentionally reconstructs the raw fragment (which may include braces) as a `TextToken`. This means the parser can produce values that fail `TextTokenSchema`.

This is intentional and correct. The Zod schema constraint is an invariant about AI output quality, not an invariant about parser internal behavior. When the action layer validates the output and finds a `TextToken` with braces in its value, that correctly surfaces a "malformed AI output" error to the user. It does not indicate a parser bug — it indicates the AI returned a malformed annotation string.

**Why `for...of` correctly handles Japanese characters**

JavaScript strings are UTF-16. CJK characters (U+4E00–U+9FFF for common kanji) are all in the Basic Multilingual Plane — each is a single UTF-16 code unit and a single code point. `for...of` over a string iterates code points (using the string's `[Symbol.iterator]`). For the characters used in Japanese text including emoji, this is the correct iteration mechanism. `for (let i = 0; ...)` with `str[i]` iterates UTF-16 code units, which would split supplementary-plane characters (e.g., some historical kanji in U+20000+) into two iterations. Using `for...of` is the safer choice.

**Why `yomi` instead of `reading`**

`yomi` (読み) is the standard Japanese term for the phonetic reading of a kanji character. It is unambiguous, compact, and conventional in Japanese NLP tooling (e.g., MeCab, Kuromoji, ICU). Using `reading` is English-language and creates confusion with the general verb "reading" in contexts like "reading a file". The rename aligns the codebase terminology with the domain.

**No barrel file (`index.ts`) for `app/lib/furigana/`**

Do not create `app/lib/furigana/index.ts` at this stage. The directory will gain additional files in Task 8 (`prompt.ts`) and beyond. A barrel file can be added when the directory has three or more files and consumer imports become verbose. Following the same decision made for `app/schema/` in Task 5.

**The `ParserState` type is an implementation detail**

It is intentionally not exported. Exporting it would invite other modules to pattern-match on the parser's internal state, creating an unnecessary coupling. The only public API is `parseAnnotationString` and the return type `FuriganaToken[]`, both of which are stable Milestone 1 contracts.

**Memory note for future tasks**

Task 8 (server action) will call `parseAnnotationString` and then validate the result with `FuriganaTokenSchema.array().safeParse(tokens)`. If validation fails, the action should log the raw `annotationString` (not the tokens) for debugging, then return an error to the client. The parser result itself is not logged to avoid leaking user content in server logs.

Task 8 must also construct `RubyToken` objects using `yomi` if it ever builds tokens directly — but since Task 8 consumes `parseAnnotationString` output rather than constructing tokens itself, no additional changes to Task 8 are expected from this rename.
