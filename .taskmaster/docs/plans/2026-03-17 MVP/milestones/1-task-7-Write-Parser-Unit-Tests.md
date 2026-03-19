# Task 7: Write Parser Unit Tests

**Project**: Furigana MVP — AI Japanese Reading Assistant
**Generated**: 2026-03-19
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

---

## Overview

`app/lib/furigana/parser.test.ts` already exists with 23 tests that all pass. The parser itself (`app/lib/furigana/parser.ts`) achieves 100% line and statement coverage, but **branch coverage sits at 91.17%** due to three structurally unreachable V8 branch arms on lines 11, 57, and 81.

This plan covers:

1. A precise gap analysis of the existing 23 tests against the PRD edge case matrix and parser implementation.
2. A definitive list of additional test cases needed to cover newly discovered parser behaviors not present in Task 6's documentation — specifically the `splitTrailingKanji` helper and its interaction with the `{` transition.
3. A strategy for handling the three unreachable branches in coverage reporting.
4. **New: HTML sanitization architecture** — the `sanitize` function that must be applied to AI-generated annotation strings before they enter the parser, along with a comprehensive test suite (Tests 31–42) covering XSS vectors, edge cases, and integration with the parser.
5. A complete verification checklist.

---

## State of the Codebase at Task 7 Start

The parser implementation diverges significantly from the naive two-buffer design described in Task 6's documentation. The actual implementation adds a `splitTrailingKanji` helper that uses `KANJI_CHAR_REGEX` (`/[\p{Script=Han}々〆ヶ]/u`) to identify the trailing kanji portion of the text buffer at the point a `{` is encountered. This means the parser extracts only the kanji-script characters from the end of `textBuffer` as the kanji candidate — non-kanji characters that preceded the kanji are emitted as a leading `TextToken`.

This is the critical behavioral difference: instead of the entire `textBuffer` becoming the kanji, only the trailing kanji characters do.

**Example**: `"私は東京{とうきょう}"` — when `{` is encountered, `textBuffer = "私は東京"`. `splitTrailingKanji("私は東京")` returns `{ leading: "私は", kanji: "東京" }`. The parser emits `{ type: "text", value: "私は" }` followed by `{ type: "ruby", kanji: "東京", yomi: "とうきょう" }`. The current test suite already covers this in Test 7. However, many more split-boundary behaviors remain untested.

**`app/lib/ai/` does not exist yet** — it will be created as part of the sanitization work described in Phase 2.5 below. `app/routes/home.tsx` is currently the starter kit template; the furigana action will be implemented in a later task. The plan describes the integration contract so that the future action implementer knows exactly where to call `sanitize`.

---

## Requirements Analysis

### Functional Requirements

- The test file at `app/lib/furigana/parser.test.ts` must pass completely with `pnpm exec vitest run`.
- Branch coverage for `parser.ts` must reach 100% or all uncovered branches must be explicitly documented as structurally unreachable with a `/* v8 ignore */` comment.
- All tests must be stable (no dependency on execution order).
- All `RubyToken` assertions must use `yomi` (not `reading`).
- Import path must use `~/lib/furigana/parser` (path alias), consistent with the existing file.
- Vitest globals are configured (`globals: true`); no explicit import of `describe`/`it`/`expect` is needed.
- **New**: A `sanitize` function must be created in `app/lib/ai/sanitize.ts` that strips HTML tags, event handler attributes, and the `javascript:` protocol from AI-generated annotation strings before they enter `parseAnnotationString`.
- **New**: The sanitize module must have its own unit test file at `app/lib/ai/sanitize.test.ts` with Tests 31–42.

### Non-Functional Requirements

- Tests must run in isolation — no shared mutable state between test cases.
- Each `it()` block must test exactly one behavior.
- Expected token arrays must be specified completely (token count + all field values), not as partial assertions.
- Test naming must follow the existing convention: lowercase verb phrases, no "should" prefix.
- The `sanitize` function must be pure and synchronous — no async, no side effects.
- Sanitization regex patterns must not exhibit O(n²) behavior on pathological inputs (catastrophic backtracking risk must be assessed for each regex).

### Dependencies and Constraints

- **Task 6 complete**: `parser.ts` is implemented and passing type-check.
- **Task 2 complete**: Vitest 4.1.0 is configured with `globals: true`, `environment: 'node'`, coverage provider `v8`.
- **Schema rename complete**: `RubyTokenSchema.yomi` (not `reading`) is the canonical field name.
- **No new runtime dependencies**: `sanitize.ts` uses only native `String.prototype.replace` with standard regex — no external libraries.
- **`app/lib/ai/` does not yet exist**: Phase 2.5 creates this directory and its first module.

---

## Gap Analysis

### What the Existing 23 Tests Cover

| Test# | Behavior Tested | PRD Edge Case | Parser Path |
|-------|----------------|---------------|-------------|
| 1 | Empty string → `[]` | Implicit | Early return at line 22 |
| 2 | Pure hiragana → single TextToken | E5 | End-of-input flush, `textBuffer` non-empty |
| 3 | Pure romaji → single TextToken | E5 | End-of-input flush, `textBuffer` non-empty |
| 4 | Single kanji compound, no surrounding text | F5 table row 1 | Single `{` → `}` cycle |
| 5 | Single kanji character | F5 table row 2 | Single-char kanji |
| 6 | Ruby followed by trailing text | F5 table row 2 | `}` then end-of-input flush |
| 7 | Leading text + ruby | Implicit | `splitTrailingKanji` splits non-kanji prefix |
| 8 | Adjacent ruby tokens | F5 table row 7 | Two `{...}` cycles, no text between |
| 9 | PRD primary example (two ruby + interleaved text) | F5 table row 3 | Multiple cycles |
| 10 | Two ruby tokens + trailing punctuation | F5 table row 11 | Punctuation in end-of-input flush |
| 11 | Unclosed `{` | E6 / F5 table row 8 | End-of-input flush in `yomi` state |
| 12 | Empty yomi `"text{}"` | E6 / F5 table row 10 | `}` with empty yomiBuffer → TextToken |
| 13 | Empty kanji `"{reading}"` | E6 / F5 table row 10 variant | `{` with empty textBuffer → fallback |
| 14 | Nested braces | E6 / F5 table row 9 | `{` in `yomi` state → literal char |
| 15 | Stray `}` in plain text | E6 | `}` in `text` state → textBuffer |
| 16 | Only `"{}"` | E6 | Empty kanji + empty yomi → TextToken |
| 17 | Only `"{"` | E6 | Minimal unclosed brace |
| 18 | TextToken shape (no extra keys) | F5 safety | `Object.keys` assertion |
| 19 | RubyToken shape (no extra keys, `yomi` field) | F5 safety | `Object.keys` assertion |
| 20 | No character loss invariant | F5 safety | Reconstruction check |
| 21 | News article excerpt (6 ruby tokens) | F5 table rows 3/11 | Long sequence |
| 22 | Classic literature excerpt (4 ruby tokens) | F5 | Two-sentence paragraph |
| 23 | Long compound sentence (9 ruby tokens) | F5 | High-density kanji |

### PRD Edge Cases: Coverage Status

| PRD Case | Coverage Status | Notes |
|----------|----------------|-------|
| `"日本語{にほんご}"` | Covered (Test 4) | |
| `"行{い}きました"` | Covered (Test 6) | |
| `"東京{とうきょう}に行{い}きました"` | Covered (Test 9) | |
| Pure hiragana | Covered (Test 2) | |
| Pure romaji | Covered (Test 3) | |
| Empty string | Covered (Test 1) | |
| Consecutive ruby | Covered (Test 8) | |
| Unclosed `{` | Covered (Test 11) | |
| Nested braces | Covered (Test 14) | |
| Empty reading `"text{}"` | Covered (Test 12) | PRD says "document chosen behavior" — behavior is TextToken fallback |
| Mixed with punctuation | Covered (Test 10) | |

All 11 PRD edge cases are covered by the existing 23 tests.

### Gaps: Behaviors Introduced by `splitTrailingKanji` (Not in Task 6 Docs)

The actual parser implementation uses a `splitTrailingKanji` helper that was not in the Task 6 reference design. This function contains code paths not exercised by the current test suite.

#### Gap A: `splitTrailingKanji` called with empty string (line 7)

The early return `if (value.length === 0) return { leading: "", kanji: "" }` is reached only when `textBuffer` is empty at the moment `{` is encountered. This happens when:
- Input starts with `{` (e.g., `"{reading}"` — covered by Test 13)
- Two adjacent `{...}` groups: after the first `}` clears `textBuffer`, the second `{` triggers `splitTrailingKanji("")`

Test 13 (`"{reading}"`) exercises the path but the current test only verifies the final output. The internal `splitTrailingKanji("")` call is exercised, confirming line 7 is covered.

#### Gap B: Non-kanji `{...}` annotation (hiragana as fake "kanji")

`splitTrailingKanji` extracts only characters matching `KANJI_CHAR_REGEX`. If the text immediately before `{` is entirely non-kanji (e.g., pure hiragana), `kanji` will be empty and the parser will fall into the `else` branch at line 37 (`leadingTextBeforeRuby = ""`), keeping the entire `textBuffer` intact (but the textBuffer is non-kanji, so `kanji.length === 0` triggers the fallback). The whole fragment `textBuffer + "{" + yomiBuffer + "}"` is emitted as a TextToken.

**Example**: `"あいう{おん}"` — `splitTrailingKanji("あいう")` returns `{ leading: "あいう", kanji: "" }`. Since `kanji.length === 0`, `leadingTextBeforeRuby = ""` and `textBuffer` is NOT replaced (it remains `"あいう"`). When `}` arrives, `textBuffer.length = 3 > 0` but `yomiBuffer.length = 2 > 0` so the condition at line 50 is TRUE, and it emits `{ type: "ruby", kanji: "あいう", yomi: "おん" }`.

Wait — this needs re-examination. Looking at the code more carefully:

```
if (kanji.length > 0) {
  leadingTextBeforeRuby = leading;
  textBuffer = kanji;           // replace textBuffer with kanji-only portion
} else {
  leadingTextBeforeRuby = "";  // no leading text; textBuffer stays as-is
}
state = "yomi";
yomiBuffer = "";
```

When `kanji.length === 0`, `textBuffer` is NOT cleared — it retains whatever non-kanji characters were in it. Then on `}`, `textBuffer.length > 0 && yomiBuffer.length > 0` is TRUE, and the parser emits `{ type: "ruby", kanji: "あいう", yomi: "おん" }`. This is AI output that is technically malformed (annotating hiragana), but the parser treats it as a valid RubyToken.

This is a significant untested behavior: **the parser accepts any non-empty text before `{` as a valid kanji candidate, not just actual kanji characters**. The `splitTrailingKanji` function only affects whether non-kanji text before the kanji is split off as a leading TextToken — it does not gatekeep what becomes the kanji field.

**New test needed**: `"あいう{おん}"` — hiragana annotated as if it were kanji.

#### Gap C: Mixed kanji+hiragana immediately before `{`

`splitTrailingKanji` splits at the boundary where non-kanji characters end and kanji begins (scanning right-to-left). Input like `"すごい東京{とうきょう}"` should yield `{ leading: "すごい", kanji: "東京" }`, producing `[TextToken("すごい"), RubyToken("東京", "とうきょう")]`. Test 7 (`"私は東京{とうきょう}"`) covers exactly this.

But what about kanji interspersed with hiragana before `{`? For example, `"東京は大{おお}きい"` — here `splitTrailingKanji("東京は大")` scans right-to-left: `大` is kanji, `は` is not → splits to `{ leading: "東京は", kanji: "大" }`. This produces `[TextToken("東京は"), RubyToken("大", "おお"), TextToken("きい")]`.

**New test needed**: Input where non-kanji characters separate two kanji groups, and only the last kanji group is annotated.

#### Gap D: Entirely kanji `textBuffer` at `{` (no leading text to split)

`splitTrailingKanji("東京")` returns `{ leading: "", kanji: "東京" }`. The `if (kanji.length > 0)` branch is taken, `leadingTextBeforeRuby = ""`, `textBuffer = "東京"`. On `}`, `leadingTextBeforeRuby.length === 0`, so the `if (leadingTextBeforeRuby.length > 0)` guard at line 51 is FALSE — no leading TextToken is emitted before the RubyToken.

The existing Test 4 (`"日本語{にほんご}"`) exercises this path. The branch at line 51 where `leadingTextBeforeRuby.length === 0` is taken. This is already covered.

#### Gap E: `splitTrailingKanji` with all-kanji input (loop runs all the way to `splitIndex = 0`)

When `textBuffer` consists entirely of kanji characters, the while loop runs until `splitIndex === 0`. The loop terminates when `splitIndex > 0` becomes false. At that point, `leading = ""` and `kanji = entire input`. The `chars[splitIndex - 1] ?? ""` with `splitIndex = 1` evaluates `chars[0]`, which is defined — the `?? ""` fallback is never used since the `splitIndex > 0` guard prevents the loop body from executing when `splitIndex = 0`.

**Branch at line 11 that is uncovered**: V8 counts the `?? ""` fallback as a branch. Since `splitIndex > 0` short-circuits before `chars[splitIndex - 1]` is ever evaluated with `splitIndex = 0`, the `undefined` branch of `??` is structurally unreachable. This branch cannot be exercised by any test input.

#### Gap F: `splitTrailingKanji` with extended Unihan / rare kanji (supplementary plane)

The regex `KANJI_CHAR_REGEX` uses `\p{Script=Han}` with the Unicode flag. Characters like `𠀋` (U+2000B, a rare kanji) are in supplementary plane and encoded as two UTF-16 surrogates. `Array.from(value)` correctly splits these into single code point strings, and `KANJI_CHAR_REGEX.test("𠀋")` matches because `\p{Script=Han}` covers the full Han script range. No special handling is needed, but this behavior is untested.

**New test needed**: Input with a supplementary-plane kanji.

#### Gap G: Special kanji characters `々`, `〆`, `ヶ` in regex

The regex includes `々` (iteration mark), `〆` (kokuji), and `ヶ` (katakana KE used in kanji compounds). These are not in `\p{Script=Han}` but are treated as kanji by the parser. This behavior is entirely untested.

**New test needed**: Input using `々` (e.g., `"時々{ときどき}"`) and `ヶ` (e.g., `"三ヶ月{さんかげつ}"` where `三ヶ月` should be parsed as a compound).

#### Gap H: `raw.length > 0` branches at lines 57 and 81

**Line 57** (inside `}` handler, malformed case): `raw = leadingTextBeforeRuby + textBuffer + "{" + yomiBuffer + "}"`. The minimum value is `"{}"` (length 2). This branch can never be false. **Structurally unreachable — must annotate with `/* v8 ignore next */`**.

**Line 81** (end-of-input, unclosed brace): `raw = leadingTextBeforeRuby + textBuffer + "{" + yomiBuffer`. The minimum value is `"{"` (length 1). This branch can never be false. **Structurally unreachable — must annotate with `/* v8 ignore next */`**.

### Coverage Strategy for Unreachable Branches

The three uncovered V8 branches are:

1. **Line 11, `?? ""` false branch**: `chars[splitIndex - 1]` with `splitIndex = 0` cannot occur because `splitIndex > 0` short-circuits. Unreachable.
2. **Line 57, `raw.length > 0` false branch**: `raw` is always at least `"{}"` (length 2). Unreachable.
3. **Line 81, `raw.length > 0` false branch**: `raw` is always at least `"{"` (length 1). Unreachable.

**Resolution**: Add `/* v8 ignore next */` comments on lines 57 and 81 in `parser.ts` to tell V8 to skip branch counting on those guards. For line 11, the `?? ""` is a TypeScript safety pattern required by `noUncheckedIndexedAccess` — annotate the while condition with `/* v8 ignore next */` to suppress.

Note: `/* v8 ignore next */` suppresses coverage for the NEXT line only. Place the comment on the line above the `if (raw.length > 0)` guards and on the line with the `?? ""` expression. After annotation, the branch coverage report should reach 100%.

---

## Sanitization Architecture

### Where Sanitization Lives in the Pipeline

```
GPT-4o-mini API response
         |
         v
  annotationString (raw AI output, untrusted)
         |
         v
   sanitize(annotationString)          <-- app/lib/ai/sanitize.ts
         |
         v
  sanitizedString (HTML-free, protocol-stripped)
         |
         v
  parseAnnotationString(sanitizedString) <-- app/lib/furigana/parser.ts
         |
         v
  Token[] (TextToken | RubyToken)
         |
         v
  React render (JSX escapes remaining content)
```

Sanitization is applied in `app/routes/home.tsx` inside the `action` function, immediately after receiving and decoding the GPT-4o-mini response but before calling `parseAnnotationString`. This is the earliest possible intervention point: the AI response is treated as untrusted input from the moment it arrives.

React's JSX rendering provides a second layer of defense — it escapes any characters that survive sanitization into HTML entities when they are rendered as text nodes. The combination of pre-parse sanitization and React's built-in escaping gives defense in depth for MVP, without requiring a full DOMPurify integration.

### Why This Approach Is Sufficient for MVP

1. **The parser output is never injected as raw HTML**: `dangerouslySetInnerHTML` is not used. Token values are rendered as React children (text nodes), which React escapes unconditionally.
2. **The annotation string never touches the DOM as HTML**: It goes through the parser and becomes a typed token array before any rendering occurs. An `<img onerror="...">` in the annotation string would become a `TextToken` with value `"<img onerror="...">"` after sanitization fails to remove it — but React would still render it as the literal string, not as an HTML element.
3. **Sanitization removes the most dangerous injection vectors**: The three regex passes remove HTML tags, event handlers, and the `javascript:` protocol. These are the vectors by which XSS could theoretically reach the DOM if future code introduced unsafe rendering.
4. **MVP scope**: The app is a reading assistant targeting individual users. The GPT-4o-mini model's output is constrained to the annotation format described in the system prompt. HTML injection in AI output is adversarial only if the system prompt itself is compromised, which is an application-level concern outside this task's scope.

### The `sanitize` Function

Located at `app/lib/ai/sanitize.ts`. The function is pure, synchronous, and has no dependencies.

```typescript
export function sanitize(input: string): string {
  return input
    // Remove HTML tags (opening and closing, with optional whitespace around tag name)
    .replace(/\s*<\/? *[A-Za-z][^>]*>/g, "")
    // Remove javascript: protocol (case-insensitive)
    .replace(/javascript:/gi, "")
    // Remove event handler patterns (on* = patterns)
    .replace(/on\w+=/gi, "");
}
```

**Regex analysis — catastrophic backtracking risk**:

- `/\s*<\/? *[A-Za-z][^>]*>/g`: The `[^>]*` quantifier is greedy but atomic — it matches any non-`>` character. There is no ambiguity in what each quantifier matches, so catastrophic backtracking cannot occur. The worst case is O(n) for a string with many `<` characters but no `>`.
- `/javascript:/gi`: Literal string match with no quantifiers. O(n) always.
- `/on\w+=/gi`: `\w+` is greedy but unambiguous — it matches word characters until a non-word character. No backtracking risk. O(n).

All three regexes are safe for production use.

**Integration point in `app/routes/home.tsx` action** (to be implemented in a future task):

```typescript
import { sanitize } from "~/lib/ai/sanitize";
import { parseAnnotationString } from "~/lib/furigana/parser";

// Inside the action function, after receiving annotationString from GPT-4o-mini:
const sanitizedAnnotation = sanitize(annotationString);
const tokens = parseAnnotationString(sanitizedAnnotation);
```

---

## Implementation Plan

### Phase 1: Analyze Coverage Gaps and Confirm Test Additions Needed

**Objective**: Run the existing suite with coverage, confirm the exact three uncovered branches, and decide which additional test cases fill genuine behavioral gaps versus which gaps only require parser annotations.

#### Subtask 1.1: Run coverage baseline

- **Command**: `pnpm exec vitest run --coverage app/lib/furigana/parser.test.ts`
- **Expected output**: 100% statements, 100% lines, 91.17% branches, uncovered lines 11/57/81
- **Acceptance criteria**: Confirms the baseline before any changes.

#### Subtask 1.2: Identify structurally unreachable branches

- **Files to examine**: `app/lib/furigana/parser.ts` lines 11, 57, 81
- **Determination**:
  - Line 11: `chars[splitIndex - 1] ?? ""` — `undefined` arm unreachable due to `splitIndex > 0` guard
  - Line 57: `if (raw.length > 0)` — `raw` always ≥ 2 chars; false arm unreachable
  - Line 81: `if (raw.length > 0)` — `raw` always ≥ 1 char; false arm unreachable
- **Acceptance criteria**: All three confirmed as structurally unreachable; no test can exercise them.

---

### Phase 2: Add `v8 ignore` Annotations to Parser

**Objective**: Suppress the three unreachable V8 branch arms in `parser.ts` using `/* v8 ignore next */` comments so that branch coverage reaches 100% without artificial tests.

#### Subtask 2.1: Annotate line 11 in `parser.ts`

- **Files to modify**: `app/lib/furigana/parser.ts`
- **Change**: Add `/* v8 ignore next */` on the line immediately before the `chars[splitIndex - 1] ?? ""` expression (or inline on the while condition if V8 supports inline ignore for branch arms).
- **Exact placement**: The while loop at line 11 — add the comment on line 10 (above the while statement) or use `/* v8 ignore next 2 */` if the while condition spans multiple lines.
- **Key considerations**: The V8 ignore comment suppresses the line's branch data entirely. Because the `splitIndex > 0` guard makes the `?? ""` fallback unreachable, this does not hide any real coverage gap.
- **Acceptance criteria**: Line 11 no longer appears in the "Uncovered Line #s" column in the coverage report.

#### Subtask 2.2: Annotate line 57 in `parser.ts`

- **Files to modify**: `app/lib/furigana/parser.ts`
- **Change**: Add `/* v8 ignore next */` on line 56 (immediately above `if (raw.length > 0)` in the `}` handler's malformed-input branch).
- **Acceptance criteria**: Line 57 no longer appears in the "Uncovered Line #s" column.

#### Subtask 2.3: Annotate line 81 in `parser.ts`

- **Files to modify**: `app/lib/furigana/parser.ts`
- **Change**: Add `/* v8 ignore next */` on line 80 (immediately above `if (raw.length > 0)` in the end-of-input `yomi` state flush).
- **Acceptance criteria**: Line 81 no longer appears in the "Uncovered Line #s" column.

---

### Phase 2.5: HTML Sanitization Implementation

**Objective**: Create the `sanitize` module that will be used by the future home action to scrub AI-generated annotation strings before parsing. Include the module's own unit test file so that sanitization coverage is tracked independently from the parser.

#### Subtask 2.5.1: Create `app/lib/ai/sanitize.ts`

- **Files to create**: `app/lib/ai/sanitize.ts`
- **Content**: Export the `sanitize` function as described in the Sanitization Architecture section above. No imports needed — only native `String.prototype.replace`.
- **TypeScript**: The function signature is `(input: string) => string`. No `any`, no `as` casts.
- **Key considerations**:
  - The three regex passes must be applied in the order shown: tag removal first, then protocol stripping, then event handler removal. This order matters because a tag like `<a href="javascript:...">` should have the tag removed wholesale before the protocol check runs (reducing redundant work, though the protocol check is harmless to run twice).
  - The function is deliberately minimal for MVP. It does not need to handle CSS injection, data URIs, or SVG-based XSS — those vectors only matter when content is injected as raw HTML, which this app does not do.
- **Acceptance criteria**: `app/lib/ai/sanitize.ts` exists, exports `sanitize`, and passes `pnpm type-check` with zero errors.

#### Subtask 2.5.2: Create `app/lib/ai/sanitize.test.ts`

- **Files to create**: `app/lib/ai/sanitize.test.ts`
- **Content**: Tests 31–42 as specified in the Test Cases section below.
- **Structure**: One outer `describe("sanitize")` block containing nested `describe` blocks by category (tag removal, protocol stripping, event handler removal, edge cases, legitimate content preservation, combined attacks).
- **Import**: `import { sanitize } from "~/lib/ai/sanitize";`
- **Acceptance criteria**: `pnpm exec vitest run app/lib/ai/sanitize.test.ts` reports 12 tests passing.

---

### Phase 3: Add Missing Behavioral Test Cases

**Objective**: Cover the newly discovered behaviors introduced by `splitTrailingKanji` that are not in the existing 23 tests.

#### Subtask 3.1: Add `splitTrailingKanji` behavioral tests

Add the following tests to `app/lib/furigana/parser.test.ts` in a new `describe("splitTrailingKanji integration", ...)` block.

**Test 24**: Non-kanji text immediately before annotation is treated as a valid "kanji" field

- **Input**: `"あいう{おん}"`
- **Expected**: `[{ type: "ruby", kanji: "あいう", yomi: "おん" }]`
- **Rationale**: When `splitTrailingKanji("あいう")` returns `{ leading: "あいう", kanji: "" }` (all hiragana, no Han script match), the `else` branch at line 37 sets `leadingTextBeforeRuby = ""` and leaves `textBuffer = "あいう"`. On `}`, both textBuffer and yomiBuffer are non-empty, so a RubyToken is emitted with kanji = `"あいう"`. This tests that the parser does NOT enforce kanji-only content in the kanji field — it defers that to the action's Zod validation. This path exercises the `kanji.length === 0` branch of `splitTrailingKanji` in a way that results in a successful RubyToken.

**Test 25**: Mixed content buffer — non-kanji + kanji immediately before annotation

- **Input**: `"東京は大{おお}きい"`
- **Expected**: `[{ type: "text", value: "東京は" }, { type: "ruby", kanji: "大", yomi: "おお" }, { type: "text", value: "きい" }]`
- **Rationale**: `splitTrailingKanji("東京は大")` — scanning right-to-left: `大` matches Han, `は` does not → `{ leading: "東京は", kanji: "大" }`. The `kanji.length > 0` branch sets `leadingTextBeforeRuby = "東京は"` and `textBuffer = "大"`. On `}`, `leadingTextBeforeRuby.length > 0` so it emits TextToken("東京は") before RubyToken("大", "おお"). This is a materially different split boundary than Test 7.

**Test 26**: Special kanji iteration mark `々` is treated as kanji

- **Input**: `"時々{ときどき}"`
- **Expected**: `[{ type: "ruby", kanji: "時々", yomi: "ときどき" }]`
- **Rationale**: `splitTrailingKanji("時々")` must return `{ leading: "", kanji: "時々" }` — both characters match `KANJI_CHAR_REGEX` (the regex explicitly includes `々`). Verifies that `々` is correctly treated as a kanji-class character and included in the kanji field rather than split into the leading text. This exercises an explicit regex class member that has no other test.

**Test 27**: Katakana `ヶ` in kanji compound is treated as kanji

- **Input**: `"三ヶ月{さんかげつ}"`
- **Expected**: `[{ type: "ruby", kanji: "三ヶ月", yomi: "さんかげつ" }]`
- **Rationale**: `splitTrailingKanji("三ヶ月")` — scanning right-to-left: `月` is Han, `ヶ` is in the regex explicitly, `三` is Han → all kanji → `{ leading: "", kanji: "三ヶ月" }`. Verifies `ヶ` is handled as a kanji class member (it is in the explicit character class in the regex).

**Test 28**: Performance — 10,000 character pure-text input does not degrade

- **Input**: `"あ".repeat(10_000)`
- **Expected**: `[{ type: "text", value: "あ".repeat(10_000) }]`
- **Rationale**: Confirms the parser's O(n) single-pass behavior holds at the PRD-defined maximum input length. This detects any accidental O(n²) behavior from string concatenation in the hot path. As a unit test, it also confirms the 10,000-character limit is not artificially constrained by the parser itself.

**Test 29**: Performance — 10,000 character input with many ruby tokens

- **Input**: `"漢字{かんじ}".repeat(1_000)` (produces a 10,000 char annotation string with 1,000 ruby annotations)
- **Expected**: Array of 1,000 `RubyToken` objects, all `{ type: "ruby", kanji: "漢字", yomi: "かんじ" }`
- **Assertion**: `result.length === 1000` and `result.every(t => t.type === "ruby" && t.kanji === "漢字" && t.yomi === "かんじ")`
- **Rationale**: Stress-tests the state machine's buffer reset behavior across 1,000 consecutive `{...}` cycles. Confirms no token count drift (e.g., off-by-one on buffer clear) across many cycles. Also exercises the `splitTrailingKanji` function 1,000 times.

**Test 30**: Supplementary-plane kanji (UTF-16 surrogate pair) is handled correctly

- **Input**: `"𠀋{じょう}"` (U+2000B, a rare Han character encoded as two UTF-16 surrogates)
- **Expected**: `[{ type: "ruby", kanji: "𠀋", yomi: "じょう" }]`
- **Rationale**: `Array.from("𠀋")` yields `["𠀋"]` (one element, one code point). `KANJI_CHAR_REGEX.test("𠀋")` is `true` because `\p{Script=Han}` with the `u` flag covers supplementary plane Han characters. This test confirms the parser does not split the surrogate pair into two characters and produce incorrect token values. Exercises the `for...of` iteration's correct Unicode code point handling.

#### Subtask 3.2: Organize new tests in `parser.test.ts`

- **Files to modify**: `app/lib/furigana/parser.test.ts`
- **Where to insert**: Add two new `describe` blocks at the end of the outer `describe("parseAnnotationString")` block:
  1. `describe("splitTrailingKanji integration", ...)` — Tests 24–27
  2. `describe("performance and encoding", ...)` — Tests 28–30
- **Acceptance criteria**: `pnpm exec vitest run app/lib/furigana/parser.test.ts` reports 30 tests passing.

---

### Phase 4: Verification

**Objective**: Confirm that after all phases, both test files achieve 100% coverage and all tests pass.

#### Subtask 4.1: Run full coverage pass for parser

- **Command**: `pnpm exec vitest run --coverage app/lib/furigana/parser.test.ts`
- **Expected output** for `parser.ts`: `100% Stmts | 100% Branch | 100% Funcs | 100% Lines`
- **Acceptance criteria**: All four coverage metrics at 100% for `lib/furigana/parser.ts`.

#### Subtask 4.2: Run full coverage pass for sanitize

- **Command**: `pnpm exec vitest run --coverage app/lib/ai/sanitize.test.ts`
- **Expected output** for `sanitize.ts`: `100% Stmts | 100% Branch | 100% Funcs | 100% Lines`
- **Acceptance criteria**: All four coverage metrics at 100% for `lib/ai/sanitize.ts`.

#### Subtask 4.3: Type-check

- **Command**: `pnpm type-check`
- **Acceptance criteria**: Zero TypeScript errors. The `/* v8 ignore next */` comments are valid TypeScript comment syntax and do not affect compilation.

#### Subtask 4.4: Lint check

- **Command**: `pnpm exec eslint app/lib/furigana/ app/lib/ai/`
- **Acceptance criteria**: Zero errors or warnings.

---

## Third-Party Integration Research

### Vitest v4.1.0 (installed)

- **Official docs**: https://vitest.dev/config/ — v4.1.0 release notes and configuration reference.
- **V8 ignore comments**: Vitest delegates coverage instrumentation to `@vitest/coverage-v8`, which uses the underlying V8 coverage engine. V8 recognizes `/* v8 ignore next */` and `/* v8 ignore next N */` (where N is the number of lines to suppress). Both forms are supported in Vitest v4.1.0.
- **Inline ignore**: `/* v8 ignore if */` and `/* v8 ignore else */` can suppress individual branch arms (true or false arms only), which is more surgical than `/* v8 ignore next */`. For lines 57 and 81, use `/* v8 ignore else */` on the `if (raw.length > 0)` line itself to suppress only the `false` branch without hiding the `true` branch.
- **Recent changes**: No breaking changes in v4.1.0 for the file-based unit testing patterns used here. The `globals: true` option, `environment: 'node'`, and `@vitest/coverage-v8` integration are unchanged from v3.
- **Open issues**: No known issues affecting `/* v8 ignore */` in Vitest v4.1.0.
- **Security advisories**: None.
- **Performance notes**: 42 synchronous unit tests for pure functions will complete in under 300ms including coverage instrumentation.

> No `Needs Review` items identified.

### `@vitest/coverage-v8` v4.1.0

- **V8 ignore syntax reference**: From the V8 project docs and Vitest coverage docs:
  - `/* v8 ignore next */` — ignore the next line
  - `/* v8 ignore next N */` — ignore the next N lines
  - `/* v8 ignore if */` — ignore only the true branch of the following `if`
  - `/* v8 ignore else */` — ignore only the false branch of the following `if`
  - `/* v8 ignore start */` / `/* v8 ignore stop */` — ignore a range

  For the guards at lines 57 and 81, `/* v8 ignore else */` placed on the `if (raw.length > 0)` line is the most surgical option.

  For line 11, the while loop's `?? ""` is not a standalone `if`, so `/* v8 ignore next */` on the while line is appropriate.

- **No `Needs Review` items** for this specific usage.

---

## Code Patterns

### Pattern 1: V8 Ignore Comments for Structurally Unreachable Guards

```typescript
// BEFORE (line 57 area in parser.ts):
const raw = leadingTextBeforeRuby + textBuffer + "{" + yomiBuffer + "}";
if (raw.length > 0) {
  result.push({ type: "text", value: raw });
}

// AFTER:
const raw = leadingTextBeforeRuby + textBuffer + "{" + yomiBuffer + "}";
/* v8 ignore else */ if (raw.length > 0) {
  result.push({ type: "text", value: raw });
}
```

**Where to apply**: Lines 57 and 81 in `parser.ts`.

**Why this pattern**: The `raw` string always contains at least `"{}"` (2 characters), making the `false` branch unreachable. The `/* v8 ignore else */` form is preferred over `/* v8 ignore next */` because it suppresses only the false branch, leaving the true branch counted — this confirms that the emit path IS exercised by tests.

### Pattern 2: V8 Ignore for `??` Fallback in While Condition

```typescript
// BEFORE (line 11 in parser.ts):
while (splitIndex > 0 && KANJI_CHAR_REGEX.test(chars[splitIndex - 1] ?? "")) {

// AFTER:
/* v8 ignore next */
while (splitIndex > 0 && KANJI_CHAR_REGEX.test(chars[splitIndex - 1] ?? "")) {
```

**Where to apply**: Line 11 in `parser.ts` (add comment on line 10).

**Why this pattern**: The `?? ""` fallback activates when `chars[splitIndex - 1]` is `undefined`, which occurs at `splitIndex = 0`. But `splitIndex > 0` short-circuits the evaluation before the index access runs, making the `?? ""` fallback unreachable. The `/* v8 ignore next */` on the preceding line suppresses V8's branch counting for the while condition.

### Pattern 3: Performance Assertions Using `.every()`

```typescript
it("handles 1,000 consecutive ruby tokens without drift", () => {
  const input = "漢字{かんじ}".repeat(1_000);
  const result = parseAnnotationString(input);

  expect(result).toHaveLength(1_000);
  expect(result.every((t) => t.type === "ruby" && t.kanji === "漢字" && t.yomi === "かんじ")).toBe(
    true,
  );
});
```

**Where to apply**: Tests 28 and 29 (performance tests).

**Why this pattern**: For large arrays, `expect(result).toEqual(Array(1000).fill(...))` produces enormous diffs on failure. Using `toHaveLength` + `.every()` keeps the failure message focused on the first failing element rather than diffing 1,000 entries.

### Pattern 4: Pure Sanitization Module

```typescript
// app/lib/ai/sanitize.ts
export function sanitize(input: string): string {
  return input
    .replace(/\s*<\/? *[A-Za-z][^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "");
}
```

**Where to apply**: `app/lib/ai/sanitize.ts`.

**Why this pattern**: A pure function with no imports is the easiest module to test exhaustively. It has no side effects, no state, and no async behavior — every input has a deterministic output. This makes the test suite for it straightforward and the function itself trivial to reason about. The three separate `.replace()` calls are preferred over a single complex regex because each call has a single, clearly documented purpose.

---

## Test Cases

### Unit Tests — `sanitize.test.ts`

#### Test Suite: `sanitize` — HTML Tag Removal

**Test 31**: Removes a `<script>` tag pair

- **Given**: `input = "text<script>alert('xss')</script>more"`
- **When**: `sanitize(input)`
- **Then**: `"textalert('xss')more"`
- **Coverage**: Confirms the opening and closing `<script>` tags are stripped, but the content between them is preserved (the sanitizer is not responsible for the inner content — if a future caller wants to strip inner script content, that is a separate concern; for annotation strings the inner content is already harmless since it is not HTML). Detects a regression where the regex fails to match closing tags.

**Test 32**: Removes `<img>` self-closing tag with attributes

- **Given**: `input = "<img src=\"x\" onerror=\"alert()\">text"`
- **When**: `sanitize(input)`
- **Then**: `"text"` (the entire tag including attributes is gone; the `onerror` event handler does not need a separate pass because the whole tag is removed by the first regex)
- **Coverage**: Confirms the `[^>]*` quantifier correctly consumes all attribute content inside the tag, including quoted attribute values containing `=` and `()`. Detects a regression where the regex stops at the first `"` inside an attribute.

**Test 33**: Removes `<iframe>` tag

- **Given**: `input = "before<iframe src=\"evil.com\"></iframe>after"`
- **When**: `sanitize(input)`
- **Then**: `"beforeafter"`
- **Coverage**: Confirms multi-part tags (opening + closing) are both removed. This is a distinct XSS vector from `<script>` (iframes can load arbitrary pages). Detects a regression where only `<script>` is handled by name.

**Test 34**: Removes tags regardless of case (`<SCRIPT>`, `<Script>`)

- **Given**: `input = "<SCRIPT>x</SCRIPT><Script>y</Script>"`
- **When**: `sanitize(input)`
- **Then**: `"xy"`
- **Coverage**: Confirms the regex's `[A-Za-z]` character class handles mixed-case tag names. Detects a case-sensitivity regression.

**Test 35**: Handles whitespace variants (`< script >`, `</ div >`)

- **Given**: `input = "< script >bad</ script >"`
- **When**: `sanitize(input)`
- **Then**: `"bad"` — the `\s*<\/? *[A-Za-z][^>]*>` pattern allows spaces between `<` and the tag name via the ` *` quantifier.
- **Coverage**: Confirms whitespace before/after the tag name is handled. Detects a regression where the ` *` quantifier is removed from the regex.

**Test 36**: Removes closing tags (`</div>`, `</style>`)

- **Given**: `input = "</div></style>content"`
- **When**: `sanitize(input)`
- **Then**: `"content"`
- **Coverage**: Confirms the `\/?` part of the regex matches the `/` in closing tags. Detects a regression where only opening tags are removed.

#### Test Suite: `sanitize` — Event Handler Removal

**Test 37**: Removes `onclick=` handler pattern

- **Given**: `input = "onclick=\"alert()\"rest"`
- **When**: `sanitize(input)`
- **Then**: `"\"alert()\"rest"` (the `onclick=` prefix is stripped, the quoted value remains)
- **Coverage**: Exercises the `/on\w+=/gi` regex. Detects a regression where event handler removal is removed from the function.

**Test 38**: Removes `onerror=` and `onload=` patterns

- **Given**: `input = "onerror=foo onload=bar"`
- **When**: `sanitize(input)`
- **Then**: `"foo bar"`
- **Coverage**: Confirms multiple handler patterns are removed in a single pass (the `g` flag). Detects a regression where only `onclick` is handled.

#### Test Suite: `sanitize` — JavaScript Protocol Removal

**Test 39**: Removes `javascript:` protocol prefix

- **Given**: `input = "javascript:alert('xss')"`
- **When**: `sanitize(input)`
- **Then**: `"alert('xss')"`
- **Coverage**: Confirms the literal `javascript:` string is stripped. Detects a protocol-stripping regression.

**Test 40**: Removes `JAVASCRIPT:` (case-insensitive)

- **Given**: `input = "JAVASCRIPT:bad" `
- **When**: `sanitize(input)`
- **Then**: `"bad"`
- **Coverage**: Confirms the `i` flag on the protocol regex handles uppercase. Detects a case-sensitivity regression.

#### Test Suite: `sanitize` — Legitimate Content Preservation

**Test 41**: Preserves plain Japanese annotation string without modification

- **Given**: `input = "東京{とうきょう}に行{い}きました"`
- **When**: `sanitize(input)`
- **Then**: `"東京{とうきょう}に行{い}きました"` (identical to input)
- **Coverage**: Confirms the sanitizer is a no-op for clean annotation strings. This is the most important negative test — a sanitizer that over-removes legitimate content is a functional bug. Detects regressions where the regex is too broad and strips `{`, `}`, or Japanese characters.

**Test 42**: Preserves punctuation and numbers in annotation strings

- **Given**: `input = "2024年{ねん}1月{いちがつ}、東京{とうきょう}。"`
- **When**: `sanitize(input)`
- **Then**: `"2024年{ねん}1月{いちがつ}、東京{とうきょう}。"` (identical to input)
- **Coverage**: Confirms digits, Japanese punctuation (`、`、`。`), and the brace notation are all preserved.

#### Test Suite: `sanitize` — Combined XSS Vectors

**Test S12** (12th test in `sanitize.test.ts`): Multiple vectors in one input

- **Given**: `input = "<script>bad</script>javascript:evil onclick=run 日本語{にほんご}"`
- **When**: `sanitize(input)`
- **Then**: `"badevil run 日本語{にほんご}"` — the script tags are removed, the `javascript:` prefix is stripped, the `onclick=` prefix is stripped, and the legitimate annotation is preserved.
- **Coverage**: Confirms all three regex passes operate independently and in sequence. Detects a regression where one pass interferes with another (e.g., the tag removal accidentally strips content needed by the protocol check).

### Unit Tests — `parser.test.ts` (Tests 24–30, Subtask 3.1)

#### Test Suite: `splitTrailingKanji` Integration

**Test 24**: Hiragana-only text before annotation is treated as kanji field

- **Given**: `input = "あいう{おん}"`
- **When**: `parseAnnotationString(input)`
- **Then**: `[{ type: "ruby", kanji: "あいう", yomi: "おん" }]`
- **Coverage**: Exercises `splitTrailingKanji` with all-non-kanji input (returns `kanji: ""`), then the `else` branch at line 37 that leaves `textBuffer` unchanged. On `}`, both buffers are non-empty so a RubyToken is emitted with the hiragana as the kanji field. Detects a regression where the parser would incorrectly discard the pre-brace text when `splitTrailingKanji` returns empty kanji.

**Test 25**: Buffer split on kanji+hiragana+kanji boundary

- **Given**: `input = "東京は大{おお}きい"`
- **When**: `parseAnnotationString(input)`
- **Then**: `[{ type: "text", value: "東京は" }, { type: "ruby", kanji: "大", yomi: "おお" }, { type: "text", value: "きい" }]`
- **Coverage**: Exercises `splitTrailingKanji` returning a non-empty `leading` AND non-empty `kanji`, followed by the leading TextToken emit path at line 52. Tests the exact split boundary when kanji and non-kanji characters are mixed in the buffer.

**Test 26**: Kanji iteration mark `々` classified as kanji

- **Given**: `input = "時々{ときどき}"`
- **When**: `parseAnnotationString(input)`
- **Then**: `[{ type: "ruby", kanji: "時々", yomi: "ときどき" }]`
- **Coverage**: Exercises the `々` member of the KANJI_CHAR_REGEX character class. Detects a regression where `々` is reclassified as non-kanji, causing `splitTrailingKanji` to split the compound incorrectly into `{ leading: "時々", kanji: "" }` and fall back to a TextToken emission instead of a RubyToken.

**Test 27**: `ヶ` in kanji compound is classified as kanji

- **Given**: `input = "三ヶ月{さんかげつ}"`
- **When**: `parseAnnotationString(input)`
- **Then**: `[{ type: "ruby", kanji: "三ヶ月", yomi: "さんかげつ" }]`
- **Coverage**: Exercises the `ヶ` member of the KANJI_CHAR_REGEX. Detects a regression where `ヶ` is misclassified as non-kanji, causing the split to break the compound.

#### Test Suite: Performance and Encoding

**Test 28**: 10,000 character pure-text input

- **Given**: `input = "あ".repeat(10_000)`
- **When**: `parseAnnotationString(input)`
- **Then**: `[{ type: "text", value: "あ".repeat(10_000) }]`
- **Coverage**: Confirms the end-of-input flush handles the maximum PRD-defined input length in a single TextToken. Detects O(n²) string concatenation issues and confirms the parser does not impose its own character limit.

**Test 29**: 1,000 consecutive ruby tokens without drift

- **Given**: `input = "漢字{かんじ}".repeat(1_000)`
- **When**: `parseAnnotationString(input)`
- **Then**: `result.length === 1_000` and all tokens are `{ type: "ruby", kanji: "漢字", yomi: "かんじ" }`
- **Coverage**: Stress-tests buffer reset across 1,000 state machine cycles. Detects off-by-one errors in buffer clearing that only manifest after multiple cycles.

**Test 30**: Supplementary-plane Han character (UTF-16 surrogate pair)

- **Given**: `input = "𠀋{じょう}"` (U+2000B)
- **When**: `parseAnnotationString(input)`
- **Then**: `[{ type: "ruby", kanji: "𠀋", yomi: "じょう" }]`
- **Coverage**: Confirms `for...of` handles a surrogate pair as a single code point. Detects a regression where removing the `u` flag or switching to index-based iteration would split the surrogate pair.

---

## Implementation Checklist

### Phase 1: Baseline Analysis

- [ ] Run `pnpm exec vitest run --coverage app/lib/furigana/parser.test.ts` and confirm 91.17% branch coverage with uncovered lines 11, 57, 81
- [ ] Confirm lines 57 and 81 contain `if (raw.length > 0)` guards
- [ ] Confirm line 11 contains the `?? ""` fallback in the while condition
- [ ] Verify all three branches are structurally unreachable (manual analysis confirms)

### Phase 2: Parser Annotations

- [ ] Add `/* v8 ignore next */` comment above the while loop at line 11 in `parser.ts`
- [ ] Add `/* v8 ignore else */` on the `if (raw.length > 0)` line at line 57 in `parser.ts`
- [ ] Add `/* v8 ignore else */` on the `if (raw.length > 0)` line at line 81 in `parser.ts`
- [ ] Run `pnpm type-check` — zero errors after annotation
- [ ] Run `pnpm exec eslint app/lib/furigana/parser.ts` — zero errors after annotation

### Phase 2.5: Sanitization Module

- [ ] Create `app/lib/ai/sanitize.ts` with the `sanitize` function
- [ ] Confirm no imports are needed in `sanitize.ts` (pure native JS)
- [ ] Run `pnpm type-check` — zero errors on new file
- [ ] Create `app/lib/ai/sanitize.test.ts` with Tests 31–42 plus Test S12 (12 tests total)
- [ ] Run `pnpm exec vitest run app/lib/ai/sanitize.test.ts` — 12 tests passing
- [ ] Run `pnpm exec vitest run --coverage app/lib/ai/sanitize.test.ts` — 100% coverage on `sanitize.ts`
- [ ] Run `pnpm exec eslint app/lib/ai/` — zero errors

### Phase 3: New Test Cases in `parser.test.ts`

- [ ] Add `describe("splitTrailingKanji integration")` block with Tests 24–27
- [ ] Add `describe("performance and encoding")` block with Tests 28–30
- [ ] Confirm all new `RubyToken` assertions use `yomi` (not `reading`)
- [ ] Run `pnpm exec vitest run app/lib/furigana/parser.test.ts` — 30 tests passing
- [ ] Run `pnpm type-check` — zero errors after adding test cases

### Phase 4: Full Verification

- [ ] Run `pnpm exec vitest run --coverage app/lib/furigana/parser.test.ts` — `parser.ts` shows `100% Stmts | 100% Branch | 100% Funcs | 100% Lines`
- [ ] Run `pnpm exec vitest run --coverage app/lib/ai/sanitize.test.ts` — `sanitize.ts` shows `100% Stmts | 100% Branch | 100% Funcs | 100% Lines`
- [ ] Run `pnpm exec eslint app/lib/furigana/ app/lib/ai/` — zero errors
- [ ] All 30 parser tests listed as passing in the test runner output
- [ ] All 12 sanitize tests listed as passing in the test runner output

---

## Notes and Considerations

### Why the Parser Implementation Differs from Task 6 Documentation

Task 6's reference implementation used a simple two-buffer design without `splitTrailingKanji`. The actual implementation adds this helper to correctly handle Japanese input like `"私は東京{とうきょう}"` — without it, the entire `textBuffer` (`"私は東京"`) would be treated as the kanji field, producing a RubyToken with kanji `"私は東京"` instead of the correct `"東京"`.

This is a deliberate enhancement to the reference design. The Task 6 documentation does not describe this function, which is why Tests 24–27 are not in the existing suite: they exercise behaviors that could not have been derived from the documentation alone.

### Why `/* v8 ignore else */` Is Preferred Over `/* v8 ignore next */`

`/* v8 ignore next */` suppresses all coverage data for the following line, including the true branch. For `if (raw.length > 0) { result.push(...) }`, suppressing the entire line would hide whether the emit path is ever reached. Using `/* v8 ignore else */` on the same line suppresses only the false branch arm (the "what happens when the condition is false" path), leaving the true branch counted as covered by tests. This is a more honest representation of coverage.

### Why the `splitTrailingKanji` Helper Is Not Exported

`splitTrailingKanji` is a private implementation detail of the parser. Exporting it would invite direct unit tests that test the helper in isolation, but the helper's behavior is fully observable through `parseAnnotationString` (Tests 24–27 demonstrate this). Exporting implementation details creates fragile tests that break when the parser is refactored without any behavioral change.

### On the `raw.length > 0` Guards Being Unreachable

The guards at lines 57 and 81 were written defensively — the developer who wrote the parser could not have been certain during implementation that `raw` would always be non-empty, so they added the guard. This is good defensive programming. The correct response is not to remove the guard (it documents intent and prevents future bugs if the reconstruction logic changes) but to annotate it as intentionally unreachable so coverage tooling does not penalize it.

### Vitest `/* v8 ignore */` Comment Placement

Vitest 4.1.0 uses V8's native comment syntax. The comment must appear in the transpiled JavaScript output to take effect. TypeScript preserves `/* ... */` block comments in the output by default. The TSConfig for this project does not strip comments (no `removeComments: true`). These annotations will survive the TypeScript transpilation step and be visible to V8's coverage engine.

### Test 30 Prerequisite: Confirm `𠀋` Is Valid Unicode

The character `𠀋` (U+2000B) is a valid CJK Unified Ideograph Extension B character. It is listed in the Unicode Han database and is matched by `\p{Script=Han}` in all modern JavaScript engines (V8, SpiderMonkey, JavaScriptCore). Node.js 22 includes V8 12.x, which has full Unicode 15.1 support. The test is valid.

### Why `app/lib/ai/sanitize.ts` Is Not `app/lib/furigana/sanitize.ts`

The `sanitize` function is not specific to the furigana parser — it is a general-purpose AI output sanitizer that belongs at the boundary between the AI layer and the application layer. Future tasks may add other AI output sanitizers or utilities to `app/lib/ai/`. Placing it in `app/lib/furigana/` would incorrectly imply it is parser-specific, and would make it harder to find when building the AI integration in later tasks.

### Test Numbering Convention

Tests are numbered globally in the order they will appear when running the full test suite. Tests 1–23 are in the existing `parser.test.ts`. Tests 24–30 are new additions to `parser.test.ts`. Tests 31–42 are in the new `sanitize.test.ts`. The combined XSS vectors test in `sanitize.test.ts` is the 12th test in that file (Test S12) — it has no global number since sanitize.test.ts tests are numbered 31–42 for the individually specified cases. The globally unique numbering makes it easy to reference specific tests across planning documents, PR reviews, and bug reports.

### Future Work: DOMPurify for Richer Sanitization

For a production release beyond MVP, consider integrating `dompurify` for more robust sanitization (handles CSS injection, data URIs, SVG XSS, and other vectors). However, DOMPurify requires a DOM environment (or `jsdom` polyfill in Node.js), which adds complexity and a runtime dependency. For MVP, the three-regex approach is sufficient given React's built-in JSX escaping as a second layer.
