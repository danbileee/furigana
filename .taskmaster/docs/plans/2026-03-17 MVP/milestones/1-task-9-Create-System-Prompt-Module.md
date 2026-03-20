# Task 9: Create System Prompt Module

**Project**: Furigana
**Generated**: 2026-03-20
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

## Overview

Create `app/lib/ai/prompt.ts` — a server-only module that exports two named symbols: `FURIGANA_SYSTEM_PROMPT` (a constant string) and `buildUserMessage` (a pass-through function). The system prompt instructs GPT-4o-mini to annotate every kanji compound in the format `漢字{よみ}`, which is exactly the format `parseAnnotationString` in `app/lib/furigana/parser.ts` consumes. `buildUserMessage` is intentionally trivial in M1; it exists to give M4 (text normalization / preprocessing) a stable call-site to extend without touching the call-site in the generation action.

This module is a direct prerequisite of Task 10 (the generation server action). It has no runtime dependencies beyond the standard library — no imports from `openai` or from `~/lib/ai/client`.

## Requirements Analysis

### Functional Requirements

- Export `FURIGANA_SYSTEM_PROMPT` as a named `const` string from `app/lib/ai/prompt.ts`.
- The prompt must instruct the model to:
  - Annotate every kanji compound with its hiragana reading in the format `漢字{よみ}`.
  - Return only the annotated string — no explanations, no markdown, no surrounding quotes.
  - Pass through all non-kanji characters unchanged (hiragana, katakana, punctuation, numbers, latin).
- Include at least three few-shot examples covering: compound kanji, consecutive kanji with mixed non-kanji, pure hiragana input, and mixed content with numbers.
- Export `buildUserMessage(text: string): string` as a named function. In M1, it returns `text` unchanged.
- No default exports — named exports only (matches the `client.ts` convention).

### Non-Functional Requirements

- **Format contract**: The `{よみ}` annotation format produced by the model must be parseable by `parseAnnotationString` in `app/lib/furigana/parser.ts`. That parser expects `kanji{yomi}` with curly braces and a non-empty `yomi` segment. The prompt's few-shot examples serve as the binding specification.
- **Server-only boundary**: `prompt.ts` must never be imported from client-side code. It has no `VITE_` env vars and no browser APIs, but the import boundary must still be respected so the prompt text does not inflate the client bundle.
- **TypeScript strict compliance**: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` all active. No `any`, no `as` casts.
- **Zero side effects**: Module evaluation has no I/O, no network calls, no environment variable reads.
- **Snapshot commitment**: `FURIGANA_SYSTEM_PROMPT` is a deliberate, human-authored artifact. Its content is intentional and reviewed. Do not generate it programmatically or derive it from config.

### Dependencies & Constraints

- **Task 8** (OpenAI Client Module) is complete — `app/lib/ai/client.ts` and `app/lib/ai/` directory exist. `prompt.ts` is placed in the same directory but does not import from `client.ts`.
- **Task 6** (parser) is complete — `app/lib/furigana/parser.ts` is the downstream consumer of the model's output. The `{よみ}` format in few-shot examples must match what `parseAnnotationString` can parse.
- **Task 10** (generation action) will `import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompt"`. No changes to `prompt.ts` are expected at that point.
- Vitest `globals: true` is set in `vitest.config.ts` — `describe`, `it`, and `expect` are available in test files without explicit imports.
- ESLint enforces `consistent-type-imports` with inline style; no type imports are needed in this module.

## Implementation Plan

### Phase 1: Create the Prompt Module

**Objective**: Write `app/lib/ai/prompt.ts` with the system prompt constant and user message builder.

#### Subtask 1.1: Write `app/lib/ai/prompt.ts`

- **Files to create**: `app/lib/ai/prompt.ts`
- **Code pattern**: See the _Code Patterns_ section — "Server-Only Prompt Module".
- **Key considerations**:
  - The file starts with a comment declaring it server-only — matches the intent established by `client.ts`.
  - `FURIGANA_SYSTEM_PROMPT` is a template literal with a leading newline trimmed. Using a tagged template or a plain string literal are both acceptable; a plain string literal is simpler and avoids any indentation-stripping logic.
  - Few-shot examples must use the exact `漢字{よみ}` format so they reinforce the output contract. Wrong brace placement (e.g., `漢字(よみ)` or `[漢字|よみ]`) would cause the parser to treat the entire annotated string as a plain text token.
  - `buildUserMessage` is a single-line function. Do not add sanitization, normalization, or trimming here — `sanitize` from `~/lib/ai/sanitize.ts` is called upstream (in the generation action) before `buildUserMessage` is invoked. This separation of concerns must not be collapsed.
  - Both exports are named; no default export.
- **Acceptance criteria**:
  - `pnpm type-check` passes on `app/lib/ai/prompt.ts` with no errors.
  - `pnpm exec eslint app/lib/ai/prompt.ts` reports no errors.
  - A manual import in a Node.js REPL (`import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "./app/lib/ai/prompt.ts"`) resolves both exports with the expected types.

### Phase 2: Write Unit Tests

**Objective**: Write `app/lib/ai/prompt.test.ts` with tests scoped to `buildUserMessage` only. The tests document the current pass-through contract and scaffold extension points for M4.

#### Subtask 2.1: Write `app/lib/ai/prompt.test.ts`

- **Files to create**: `app/lib/ai/prompt.test.ts`
- **Code pattern**: See the _Code Patterns_ section — "Pass-Through Contract Test".
- **Key considerations**:
  - No tests for `FURIGANA_SYSTEM_PROMPT`. The prompt is a human-authored artifact; its correctness is validated by the model's output quality in integration, not by a string-equality assertion. A snapshot test would lock in whitespace and wording changes that should be easy to iterate on without a test update ceremony.
  - `describe`/`it`/`expect` are available globally (`globals: true` in `vitest.config.ts`). Do not add `import { describe, it, expect } from "vitest"` — this would be redundant and inconsistent with `sanitize.test.ts`, which also omits the explicit import.
  - The test suite for `buildUserMessage` covers three cases: (1) plain Japanese text, (2) a string that is already annotated (idempotency in M1), and (3) an empty string. These three cases are the minimum to detect a future M4 change that accidentally preprocesses input when it should not.
  - Group tests under `describe("buildUserMessage", ...)` — matches the one-describe-per-export pattern used in `sanitize.test.ts`.
- **Acceptance criteria**:
  - `pnpm test app/lib/ai/prompt.test.ts` runs with all tests green.
  - No TypeScript errors in the test file.
  - No ESLint errors in the test file.

### Phase 3: Verify Integration Contract

**Objective**: Confirm the annotation format produced by the prompt is parseable by the existing parser, and confirm the module does not enter the client bundle.

#### Subtask 3.1: Manual format cross-check

- **Files to review**: `app/lib/furigana/parser.ts`, `app/lib/ai/prompt.ts` (new)
- **Key considerations**:
  - Open both files side by side and trace one few-shot example through `parseAnnotationString`. For `東京{とうきょう}に行{い}きました。`, the expected result is two `RubyToken` entries (`{ type: "ruby", kanji: "東京", yomi: "とうきょう" }`, `{ type: "ruby", kanji: "行", yomi: "い" }`) and two `TextToken` entries (`に` and `きました。`).
  - Verify that every few-shot example in the prompt produces only `RubyToken` and `TextToken` entries with no malformed literals falling through as text.
- **Acceptance criteria**:
  - Each few-shot example, when passed to `parseAnnotationString`, returns a token array with no unexpected text-only fallback tokens for annotated kanji.

#### Subtask 3.2: Verify server/client boundary

- **Files to review**: `app/entry.client.tsx`, any existing `app/routes/*.tsx` client-side exports
- **Key considerations**:
  - There must be no static `import` of `~/lib/ai/prompt` in client-side code at the time this task is completed. Task 10 (the generation action) will import it from a server action, which is correct.
  - Run `pnpm build` to confirm no bundler error.
- **Acceptance criteria**:
  - `pnpm build` succeeds.
  - `pnpm type-check` passes across the whole project.

## Code Patterns

### Pattern 1: Server-Only Prompt Module

```typescript
// app/lib/ai/prompt.ts
// Server-only — prompt configuration for furigana generation

/**
 * System prompt for GPT-4o-mini furigana annotation.
 * Instructs the model to wrap every kanji compound with its hiragana reading
 * in the format: 漢字{よみ}
 *
 * Few-shot examples lock in the expected output format and cover:
 * - compound kanji (日本語, 東京)
 * - consecutive kanji with trailing non-kanji (行きました)
 * - pure hiragana / katakana pass-through (こんにちは)
 * - mixed content with numbers (2024年1月1日)
 */
export const FURIGANA_SYSTEM_PROMPT = `You are a Japanese language assistant that adds furigana readings to kanji.

Your task:
1. Annotate every kanji compound with its hiragana reading in the format: 漢字{よみ}
2. Return ONLY the annotated string - no explanations, no markdown, no quotes
3. Non-kanji characters (hiragana, katakana, punctuation, numbers, latin) pass through unchanged

Examples:

Input: 日本語を勉強しています。
Output: 日本語{にほんご}を勉強{べんきょう}しています。

Input: 東京に行きました。
Output: 東京{とうきょう}に行{い}きました。

Input: こんにちは！元気ですか？
Output: こんにちは！元気{げんき}ですか？

Input: 今日は2024年1月1日です。
Output: 今日{きょう}は2024年{ねん}1月{がつ}1日{にち}です。`;

/**
 * Builds the user message for the furigana generation request.
 *
 * Currently a pass-through. M4 will add text normalization here
 * (e.g., full-width digit normalization, whitespace collapsing) without
 * changing the call-site in the generation action.
 *
 * @param text - The sanitized Japanese text to annotate
 */
export function buildUserMessage(text: string): string {
  return text;
}
```

**Where to apply**: `app/lib/ai/prompt.ts` only.

**Why this pattern**:

- Named exports match the `client.ts` convention; no default export.
- The JSDoc on `FURIGANA_SYSTEM_PROMPT` explains the few-shot coverage so future maintainers know which edge cases the examples are meant to exercise.
- `buildUserMessage` is kept as a thin wrapper so the generation action's call-site (`buildUserMessage(sanitizedText)`) remains stable across M1 and M4.
- No imports needed — the module is self-contained. This keeps the server/client boundary trivial to enforce.

### Pattern 2: Pass-Through Contract Test

```typescript
// app/lib/ai/prompt.test.ts

import { buildUserMessage } from "~/lib/ai/prompt";

describe("buildUserMessage", () => {
  it("returns plain japanese text unchanged", () => {
    const input = "日本語を勉強しています。";
    expect(buildUserMessage(input)).toBe(input);
  });

  it("returns an already-annotated string unchanged", () => {
    const input = "東京{とうきょう}に行{い}きました。";
    expect(buildUserMessage(input)).toBe(input);
  });

  it("returns an empty string unchanged", () => {
    expect(buildUserMessage("")).toBe("");
  });
});
```

**Where to apply**: `app/lib/ai/prompt.test.ts` only.

**Why this pattern**:

- No explicit `describe`/`it`/`expect` imports — `globals: true` in `vitest.config.ts` makes them available globally. Adding the import would be redundant and inconsistent with `sanitize.test.ts`.
- The "already annotated" case is the key scaffold for M4: if a future preprocessing step accidentally double-annotates or strips braces, this test will catch it.
- The empty-string case guards against a future guard clause that might throw instead of returning `""`, which would break the generation action when called with an empty input.
- No snapshot test for `FURIGANA_SYSTEM_PROMPT` — the prompt is a human-authored constant. A snapshot would make iterating on prompt wording require a `--update-snapshots` ceremony without catching any real fault.

## Test Cases

### Unit Tests

#### Test Suite: `buildUserMessage` (`app/lib/ai/prompt.test.ts`)

**Test 1**: Returns plain Japanese text unchanged

- **Given**: A plain Japanese sentence with no annotation — `"日本語を勉強しています。"`
- **When**: `buildUserMessage` is called with this string
- **Then**: The return value is strictly equal to the input
- **Coverage**: Detects any future preprocessing in M4 that unintentionally alters unannotated input

**Test 2**: Returns an already-annotated string unchanged

- **Given**: A string that already contains `{よみ}` annotations — `"東京{とうきょう}に行{い}きました。"`
- **When**: `buildUserMessage` is called with this string
- **Then**: The return value is strictly equal to the input
- **Coverage**: Detects double-annotation or brace-stripping bugs introduced during M4 preprocessing extensions

**Test 3**: Returns an empty string unchanged

- **Given**: An empty string `""`
- **When**: `buildUserMessage` is called with this string
- **Then**: The return value is `""`
- **Coverage**: Detects a guard clause that throws or returns a fallback value for empty input, which would break the generation action's empty-input path

### Integration Tests

Not applicable for this task in isolation. Integration coverage (prompt + `openaiClient` + `parseAnnotationString` forming a full round-trip) belongs to Task 10 (generation action) and the E2E suite.

### E2E Tests

Not applicable for this task. The prompt module is server-only with no UI surface. E2E coverage is provided by the generation flow tests in Task 10 and subsequent tasks.

## Notes & Considerations

**`yomi` field, not `reading`**

`RubyTokenSchema` in `app/schema/furigana.ts` and `parseAnnotationString` in `app/lib/furigana/parser.ts` both use the field name `yomi`. This naming must be consistent with the annotation format specified in the system prompt. The prompt uses `{よみ}` in its examples (hiragana placeholder), which maps to the `yomi` field after parsing. Do not use `reading` anywhere in the format specification.

**Why `buildUserMessage` is a no-op in M1**

The generation action (Task 10) calls `sanitize(rawInput)` before calling `buildUserMessage(sanitizedText)`. Sanitization is already handled upstream. `buildUserMessage` exists purely as a stable call-site for M4 additions (e.g., full-width digit normalization `２０２４ → 2024`, whitespace collapsing, or length truncation before sending to the API). Keeping it as a pass-through now means zero call-site changes when M4 extends it.

**Snapshot commitment decision**

`FURIGANA_SYSTEM_PROMPT` is not snapshot-tested. Prompt engineering is an iterative process — the wording, few-shot examples, and ordering may all need adjustment based on model output quality. A snapshot would impose a friction penalty on every prompt iteration. The prompt's correctness is validated by the model's actual output in integration and E2E tests, not by a string equality check.

**Filename is `prompt.ts`, not `prompts.ts`**

The file exports exactly one prompt constant plus one builder function, all scoped to the furigana generation domain. The singular form `prompt.ts` correctly reflects this. The task definition originally specified `prompts.ts` (plural) — this plan corrects that to `prompt.ts`.

**Task 10 forward reference**

Task 10 (generation server action) will import both symbols:

```typescript
import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompt";
```

No changes to `prompt.ts` are expected at that point. The module is complete after Task 9.

**Verification commands**

```bash
# Type-check
pnpm type-check

# Lint
pnpm exec eslint app/lib/ai/prompt.ts app/lib/ai/prompt.test.ts

# Run tests
pnpm test app/lib/ai/prompt.test.ts

# Full build (confirm no client-bundle leakage)
pnpm build
```

## Implementation Checklist

### Phase 1 — Create the Prompt Module

- [ ] Create `app/lib/ai/prompt.ts`
- [ ] Export `FURIGANA_SYSTEM_PROMPT` as a named `const` string
- [ ] Include server-only comment header
- [ ] Prompt instructs model to annotate kanji in `漢字{よみ}` format
- [ ] Prompt returns only annotated string (no markdown, no explanations)
- [ ] At least 4 few-shot examples (compound kanji, mixed content, pure hiragana, numbers)
- [ ] Export `buildUserMessage(text: string): string` as named function (pass-through)
- [ ] No default export, no imports from `openai` or `~/lib/ai/client`
- [ ] `pnpm type-check` passes on `app/lib/ai/prompt.ts`
- [ ] `pnpm exec eslint app/lib/ai/prompt.ts` reports no errors

### Phase 2 — Write Unit Tests

- [ ] Create `app/lib/ai/prompt.test.ts`
- [ ] No explicit `describe`/`it`/`expect` imports (globals)
- [ ] Test: returns plain Japanese text unchanged
- [ ] Test: returns already-annotated string unchanged
- [ ] Test: returns empty string unchanged
- [ ] `pnpm test app/lib/ai/prompt.test.ts` passes

### Phase 3 — Verify Integration Contract

- [ ] Cross-check few-shot examples against `parseAnnotationString` in `app/lib/furigana/parser.ts`
- [ ] Confirm no client-side import of `~/lib/ai/prompt`
- [ ] `pnpm build` succeeds
- [ ] `pnpm type-check` passes across whole project
