# Task 11: Create InputArea and Form Integration in Home Route

**Project**: Furigana
**Generated**: 2026-03-20
**Updated**: 2026-03-20
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

## Overview

Implement the core furigana generation flow with:

1. **Input constants** (`app/constants/input.ts`) — Define `MAX_INPUT_LENGTH` in a dedicated constants file so the limit is a single source of truth shared between the server-side action, the client component, and tests.
2. **Service layer** (`app/services/furigana.ts`) — Move the furigana AI logic from the API endpoint into a reusable service function that accepts text and returns `FuriganaToken[]` on success.
3. **Route action** (`app/routes/home.tsx` action) — Call the furigana service from the route's action function, using React Router's form submission lifecycle.
4. **Input form** (`app/routes/home.tsx` component) — Integrate the shadcn/ui `Textarea` and `Button` directly into a React Router `<Form>` component. No separate `InputArea` component. All validation, keyboard shortcuts (Cmd+Enter), character counter, and error handling are managed inline.
5. **Conditional render** (`app/routes/home.tsx`) — Home is the primary landing page. When no tokens exist, it renders the input form. When tokens are present (after a successful action), it renders `ReadingView`.

The page flow:

- User lands on `/` (home) → sees textarea with "Generate Furigana" button directly
- User submits valid text → route action calls furigana service → tokens returned → page transitions to `ReadingView`
- On error → error message shown inline, form re-enabled with original text preserved

---

## Requirements Analysis

### Functional Requirements

#### Input Constants (`app/constants/input.ts`)

- Export `const MAX_INPUT_LENGTH = 10_000` as a named constant
- Used by both the server-side action validation and the client-side component (counter, `maxLength` attribute, button guard)
- Single source of truth — changing one value updates all references

#### Furigana Service (`app/services/furigana.ts`)

- Export an async function `generateFurigana(text: string): Promise<FuriganaToken[]>`
- Accepts raw Japanese text (already validated for length at the route level)
- Calls GPT-4o-mini via the OpenAI client with the system prompt
- Parses the AI response using the parser and returns a typed `FuriganaToken[]`
- Throws on API error; error handling is done at the route action level

#### Home Route (`app/routes/home.tsx`)

**Component (render):**

- Initially renders the input form (no tokens in action data)
- After successful action: renders `ReadingView` with returned tokens
- Display a `<Form method="post">` element from React Router
- Inside the form:
  - Placeholder text: `"Paste Japanese text here…"`
  - Maximum character limit: `MAX_INPUT_LENGTH` characters via `maxLength` attribute
  - Character counter below the textarea: `{currentCount} / {MAX_INPUT_LENGTH.toLocaleString()}`
    - Default color: `text-muted-foreground`
    - Warning color: `text-destructive` when `text.length >= MAX_INPUT_LENGTH`
  - Submit button labeled "Generate Furigana" with states:
    | Condition | Label | Icon | disabled |
    | -------------- | ----------------- | ----------------- | -------- |
    | Empty textarea | Generate Furigana | none | true |
    | Valid input | Generate Furigana | none | false |
    | Over limit | Generate Furigana | none | true |
    | Submitting | Generating… | Lucide `Loader2` | true |

  - Keyboard shortcut: `(metaKey || ctrlKey) && key === "Enter"` → form submission
  - Error message (if present) with `role="alert"` below the counter
  - Text is preserved from `useActionData()` on the error path

**Action (form POST):**

- Extract `text` from `formData.get('text')`
- Server-side validation: non-empty, ≤ `MAX_INPUT_LENGTH` characters
- Call `generateFurigana(text)` from the service
- On success: return `{ tokens: FuriganaToken[] }` → trigger client-side transition to `ReadingView`
- On error: return `{ error: string, originalText: string }` → re-render form with error and preserved text

### Non-Functional Requirements

- **Type strictness**: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`. No `any`, no `as` casts.
- **React Router Form pattern**: Use `<Form method="post">` for progressive enhancement; keyboard shortcut works via native form submission.
- **Accessibility**: textarea has `aria-label`; error message uses `role="alert"`; button `disabled` attribute reflects form state.
- **SSR-safe**: Home route is an SSR route. The component body must not access `window` or `document` at render time.

### Dependencies & Constraints

- **Task 10 complete** — `POST /api/furigana` exists; logic will be extracted to service layer in this task
- **shadcn/ui `Textarea`** — installed via `pnpx shadcn@latest add textarea --defaults`
- **`Button` component** — use for submit button (already exists)
- **Lucide React `Loader2`** — use for submission spinner
- **`FuriganaToken` type** — imported from `~/schema/furigana`
- **`openaiClient` from `app/lib/ai/client.ts`** — pre-configured OpenAI instance
- **System prompt** — from `app/lib/ai/prompts.ts`
- **Parser** — `parseAnnotationString` from `app/lib/furigana/parser.ts`
- **React Router v7 Form** — use for form submission; `useNavigation()` provides loading state

---

## Implementation Plan

### Phase 1: Create Input Constants File

**Objective**: Establish `app/constants/input.ts` as the single source of truth for the maximum input length before any other file references the value.

#### Subtask 1.1: Create `app/constants/input.ts`

- **Files to create**: `app/constants/input.ts`
- **Code pattern**:

  ```typescript
  // app/constants/input.ts

  /**
   * Maximum number of characters accepted for furigana generation input.
   * Enforced server-side in the home route action and client-side in the textarea.
   */
  export const MAX_INPUT_LENGTH = 10_000;
  ```

- **Key considerations**:
  - The file lives under `app/constants/` — create the directory if it does not exist
  - Export as a `const` (not `enum` or `type`) so it is available at both runtime and type level
  - Do not import any framework modules here — this file must be importable from both server and client contexts
- **Acceptance criteria**:
  - `app/constants/input.ts` exists and exports `MAX_INPUT_LENGTH`
  - `pnpm type-check` passes

---

### Phase 2: Install the shadcn/ui Textarea

**Objective**: Generate `app/components/ui/textarea.tsx` via the shadcn CLI.

#### Subtask 2.1: Run the shadcn add command

- **Command**: `pnpx shadcn@latest add textarea --defaults`
- **Files created**: `app/components/ui/textarea.tsx`
- **Acceptance criteria**:
  - `app/components/ui/textarea.tsx` exists and exports a `Textarea` component
  - `pnpm type-check` passes with zero errors

---

### Phase 3: Create Furigana Service Layer

**Objective**: Extract the furigana generation logic from Task 10's API endpoint into a reusable service function.

#### Subtask 3.1: Create `app/services/furigana.ts`

- **Files to create**: `app/services/furigana.ts`
- **Key considerations**:
  - Export `async function generateFurigana(text: string): Promise<FuriganaToken[]>`
  - Import `openaiClient` from `~/lib/ai/client`
  - Import `FURIGANA_SYSTEM_PROMPT, buildUserMessage` from `~/lib/ai/prompts`
  - Import `parseAnnotationString` from `~/lib/furigana/parser`
  - Call the AI, parse response, return tokens
  - Throw on error (error handling happens at route action level)
  - No input validation — caller (route action) handles validation

- **Code pattern**:

  ```typescript
  // app/services/furigana.ts
  import { openaiClient } from "~/lib/ai/client";
  import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompts";
  import { parseAnnotationString } from "~/lib/furigana/parser";
  import type { FuriganaToken } from "~/schema/furigana";

  export async function generateFurigana(text: string): Promise<FuriganaToken[]> {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: FURIGANA_SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(text) },
      ],
      temperature: 0.3,
      max_tokens: text.length * 3,
    });

    const annotationString = completion.choices[0]?.message?.content ?? "";
    if (!annotationString) throw new Error("Empty response from AI");

    return parseAnnotationString(annotationString);
  }
  ```

- **Acceptance criteria**:
  - `app/services/furigana.ts` exists and exports `generateFurigana`
  - `pnpm type-check` passes
  - Function is testable (no React Router dependencies)

#### Subtask 3.2: Create unit tests for `app/services/furigana.test.ts`

- **Files to create**: `app/services/furigana.test.ts`
- **Key considerations**:
  - Mock `openaiClient` with `vi.mock('~/lib/ai/client')`
  - Test: valid AI response → tokens returned
  - Test: empty AI response → throws
  - Test: API error → throws

---

### Phase 4: Implement Form and Action in `home.tsx`

**Objective**: Build the furigana input form and route action directly inside the existing home route.

#### Subtask 4.1: Modify `app/routes/home.tsx`

- **Files to modify**: `app/routes/home.tsx`
- **Key considerations**:

  **Action function**:
  - Type: `export async function action({ request }: Route.ActionArgs): Promise<ActionData>`
  - Define types: `ActionSuccess = { tokens: FuriganaToken[] }`, `ActionError = { error: string, originalText: string }`
  - Extract and validate `text` from `formData.get('text')`
  - Import `MAX_INPUT_LENGTH` from `~/constants/input` — do not redeclare the constant locally
  - Call `generateFurigana(text)` from service
  - Return success or error object
  - Catch errors and return generic error message

  **Component function**:
  - Export default component
  - Import `useNavigation()` for `isSubmitting` state
  - Import `useActionData()` to read error message and preserve text
  - Import `MAX_INPUT_LENGTH` from `~/constants/input`
  - Use `<Form method="post">` for form element
  - Inline the textarea + counter + button directly (no separate InputArea component)
  - Derive `charCount`, `isOverLimit`, `isSubmitDisabled` from textarea value using `MAX_INPUT_LENGTH`
  - Keyboard shortcut: native `<form>` handles Cmd+Enter submission automatically
  - On error: `useActionData()` provides `error` and `originalText` to re-populate form
  - On success: `useActionData()` provides `tokens` to transition to `ReadingView`

- **Code pattern outline**:

  ```typescript
  // app/routes/home.tsx
  import { Form, useNavigation, useActionData } from "react-router";
  import { Textarea } from "~/components/ui/textarea";
  import { Button } from "~/components/ui/button";
  import { Loader2 } from "lucide-react";
  import { cn } from "~/lib/utils";
  import { generateFurigana } from "~/services/furigana";
  import { MAX_INPUT_LENGTH } from "~/constants/input";
  import type { FuriganaToken } from "~/schema/furigana";
  import type { Route } from "./+types/home";

  type ActionData =
    | { tokens: FuriganaToken[] }
    | { error: string; originalText: string };

  export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
    const formData = await request.formData();
    const textEntry = formData.get("text");

    // Validate
    if (typeof textEntry !== "string" || textEntry.length === 0) {
      return { error: "Please enter some Japanese text.", originalText: "" };
    }

    if (textEntry.length > MAX_INPUT_LENGTH) {
      return { error: `Text exceeds ${MAX_INPUT_LENGTH.toLocaleString()} character limit.`, originalText: textEntry };
    }

    try {
      const tokens = await generateFurigana(textEntry);
      return { tokens };
    } catch (err) {
      console.error("Furigana generation error:", err);
      return { error: "Something went wrong. Please try again.", originalText: textEntry };
    }
  }

  export function meta(_: Route.MetaArgs) {
    return [
      { title: "Furigana" },
      { name: "description", content: "Generate furigana annotations for Japanese text" },
    ];
  }

  export default function HomePage() {
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Check if we got tokens (success)
    const hasTokens = actionData && "tokens" in actionData;
    if (hasTokens) {
      return <ReadingView tokens={actionData.tokens} />;
    }

    // Form page (initial state or error state)
    const errorMessage = actionData && "error" in actionData ? actionData.error : undefined;
    const initialText = actionData && "originalText" in actionData ? actionData.originalText : "";

    const [text, setText] = useState<string>(initialText);
    const charCount = text.length;
    const isOverLimit = charCount > MAX_INPUT_LENGTH;
    const isSubmitDisabled = charCount === 0 || isOverLimit || isSubmitting;

    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold">Furigana</h1>

        <Form method="post" className="flex w-full flex-col gap-4">
          <Textarea
            aria-label="Japanese text input"
            placeholder="Paste Japanese text here…"
            name="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isSubmitting}
            maxLength={MAX_INPUT_LENGTH}
            className="min-h-48 resize-y"
          />

          <p className={cn(
            "text-right text-sm",
            isOverLimit ? "text-destructive" : "text-muted-foreground",
          )}>
            {charCount.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}
          </p>

          {errorMessage !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <Button type="submit" disabled={isSubmitDisabled} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Generating…
              </>
            ) : (
              "Generate Furigana"
            )}
          </Button>
        </Form>
      </main>
    );
  }
  ```

- **Acceptance criteria**:
  - Route compiles with `pnpm type-check`
  - `MAX_INPUT_LENGTH` is imported from `~/constants/input` — no local redeclaration of the value
  - Form submits via button click and Cmd+Enter / Ctrl+Enter
  - Character counter updates on keystroke
  - Error message appears with `role="alert"` on failed submission
  - Text is preserved from `actionData.originalText`
  - Success transitions to `ReadingView`

---

### Phase 5: Verify

**Objective**: Type-check, lint, and smoke test.

#### Subtask 5.1: Type-check and lint

- **Commands**:
  ```bash
  pnpm type-check
  pnpm exec eslint app/constants/input.ts app/services/furigana.ts app/routes/home.tsx
  ```
- **Acceptance criteria**: Zero type errors, zero lint errors

#### Subtask 5.2: Full build

- **Command**: `pnpm build`
- **Acceptance criteria**: Build succeeds

#### Subtask 5.3: Dev server smoke test

- **Command**: `pnpm dev`
- **Manual checks**:
  - Navigate to `/`
  - Counter shows `0 / 10,000` on load
  - Button is disabled on load
  - Typing updates counter
  - At 10,000 characters, counter turns red and button disables
  - Submitting valid text loads `ReadingView`
  - On error, form reappears with error message and text preserved

---

## Third-Party Integration Research

### shadcn/ui Textarea (shadcn v4.0.5, project-installed)

- **Official docs**: [https://ui.shadcn.com/docs/components/textarea](https://ui.shadcn.com/docs/components/textarea)
- **Installation command**: `pnpx shadcn@latest add textarea --defaults`
- **Generated source structure**: The Textarea component is a `React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>` wrapper. It merges Tailwind classes via `cn()` and spreads all native `<textarea>` props through. This means:
  - All standard HTML `<textarea>` attributes (`maxLength`, `placeholder`, `disabled`, `value`, `onChange`, `onKeyDown`, `aria-label`, etc.) work directly.
  - No shadcn-specific props beyond `className`.
  - The component forwards the `ref` to the underlying DOM element — useful if a parent needs to call `.focus()` or measure dimensions.
- **Recent changes (2025)**: An open issue reports that `rows={number}` has no visual effect in Chromium-based browsers (GitHub issue #7449). This is a CSS specificity issue where the shadcn default styles override `rows`. For this task, height is controlled via `min-h-48` and `resize-y` Tailwind classes — `rows` is not used, so this bug does not affect the implementation.
- **Dialog width issue**: GitHub issue #7668 notes that textarea does not abide by the dialog width in some configurations. This task does not use the textarea inside a Dialog, so it is not relevant.
- **Security advisories**: None found.
- **Performance notes**: None relevant.

> ⚠️ **Needs Review**: The `rows` attribute is visually ignored in Chromium (GitHub issue #7449). Do not use `rows` to control height — use Tailwind `min-h-*` and `resize-y` classes instead. The default shadcn styles (`min-h-16`) may need to be overridden with `min-h-48` or a project-appropriate value for the "large textarea" PRD requirement.

### lucide-react v0.577.0 (installed)

- **Official docs**: [https://lucide.dev/icons/loader-2](https://lucide.dev/icons/loader-2)
- **Usage**: `import { Loader2 } from "lucide-react"` — renders an animated spinner via `animate-spin` Tailwind class.
- **Recent changes**: No breaking changes to the `Loader2` icon between v0.4 and v0.577.
- **Security advisories**: None found.
- **Performance notes**: Lucide icons are tree-shaken per-icon import; no bundle-size concern.

### React Router v7 (installed: ^7.0.0)

- **Relevant pattern for Task 11**: The home route uses React Router's `<Form>`, `action`, and `useActionData` hooks. This is the idiomatic pattern for React Router v7 framework mode and allows progressive enhancement.
- **`useNavigation()` for loading state**: Replaces manual `isSubmitting` useState; `navigation.state === "submitting"` is set automatically when a `<Form method="post">` is submitted.
- **`useActionData()` for response**: Returns the discriminated union from the action function. Type parameter `useActionData<ActionData>()` narrows the return to the defined union.
- **SSR consideration**: `home.tsx` is an SSR route. The `useState` hooks and `handleSubmit` function are client-side-only. React Router renders the initial HTML on the server (initial state: empty `text`, `actionData === undefined`, `isSubmitting === false`) and hydrates on the client. No `window` or `document` is accessed at render time.
- **Security advisories**: None.

---

## Code Patterns

### Pattern 1: Input Constants File

```typescript
// app/constants/input.ts

/**
 * Maximum number of characters accepted for furigana generation input.
 * Enforced server-side in the home route action and client-side in the textarea.
 */
export const MAX_INPUT_LENGTH = 10_000;
```

**Where to apply**: `app/constants/input.ts` — created once, imported everywhere the limit is needed.

**Why this pattern**: A single constant file eliminates magic numbers scattered across the action, component, and tests. If the limit ever changes, one edit propagates everywhere. The file has no framework imports, making it importable from both server and client modules without side effects.

---

### Pattern 2: Furigana Service Function

```typescript
// app/services/furigana.ts

import { openaiClient } from "~/lib/ai/client";
import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompts";
import { parseAnnotationString } from "~/lib/furigana/parser";
import type { FuriganaToken } from "~/schema/furigana";

export async function generateFurigana(text: string): Promise<FuriganaToken[]> {
  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: FURIGANA_SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(text) },
    ],
    temperature: 0.3,
    max_tokens: text.length * 3,
  });

  const annotationString = completion.choices[0]?.message?.content ?? "";
  if (!annotationString) throw new Error("Empty response from AI");

  return parseAnnotationString(annotationString);
}
```

**Where to apply**: `app/services/furigana.ts`

**Why this pattern**: Service function has no React Router dependencies. It's pure business logic, testable, and reusable by multiple routes (M1: home action, M2: title generation). Throwing on error lets the caller (route action) decide how to handle it.

---

### Pattern 3: Route Action with Validation and Service Call

```typescript
// app/routes/home.tsx

import { MAX_INPUT_LENGTH } from "~/constants/input";

type ActionData = { tokens: FuriganaToken[] } | { error: string; originalText: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const formData = await request.formData();
  const textEntry = formData.get("text");

  if (typeof textEntry !== "string" || textEntry.length === 0) {
    return { error: "Please enter some Japanese text.", originalText: "" };
  }

  if (textEntry.length > MAX_INPUT_LENGTH) {
    return { error: `Text exceeds ${MAX_INPUT_LENGTH.toLocaleString()} characters.`, originalText: textEntry };
  }

  try {
    const tokens = await generateFurigana(textEntry);
    return { tokens };
  } catch (err) {
    console.error("Furigana generation error:", err);
    return { error: "Something went wrong. Please try again.", originalText: textEntry };
  }
}
```

**Where to apply**: `app/routes/home.tsx` action function

**Why this pattern**: `MAX_INPUT_LENGTH` is imported rather than redeclared locally. Server-side validation (belt-and-suspenders with client-side guards), service call isolation via try/catch, discriminated union return type for type-safe client handling. Error message is generic to the user; raw error is logged for debugging.

---

### Pattern 4: Derived State in Component

```typescript
// app/routes/home.tsx component

import { MAX_INPUT_LENGTH } from "~/constants/input";

const [text, setText] = useState<string>(initialText);
const charCount = text.length;
const isOverLimit = charCount > MAX_INPUT_LENGTH;
const isSubmitDisabled = charCount === 0 || isOverLimit || isSubmitting;
```

**Where to apply**: Inside the `HomePage` component body, derived from textarea state

**Why this pattern**: No separate state for counter — derived from `text.length`. Computed on every render (cheap). `isSubmitDisabled` is derived from three independent conditions for clarity. `MAX_INPUT_LENGTH` is imported, not hardcoded.

---

### Pattern 5: Form with useNavigation and useActionData

```typescript
// app/routes/home.tsx component

const actionData = useActionData<ActionData>();
const navigation = useNavigation();
const isSubmitting = navigation.state === "submitting";

const hasTokens = actionData && "tokens" in actionData;
if (hasTokens) {
  return <ReadingView tokens={actionData.tokens} />;
}

return (
  <Form method="post" className="flex w-full flex-col gap-4">
    <Textarea
      name="text"
      value={text}
      onChange={(event) => setText(event.target.value)}
      disabled={isSubmitting}
      maxLength={MAX_INPUT_LENGTH}
      // ... other props
    />
    {/* counter, error message, button */}
  </Form>
);
```

**Where to apply**: `app/routes/home.tsx` component body

**Why this pattern**: `useNavigation()` provides loading state automatically. `useActionData()` returns success or error from the action. Discriminated union in `actionData` allows `"tokens" in actionData` type narrowing. `<Form method="post">` triggers the action on submit. `maxLength={MAX_INPUT_LENGTH}` references the shared constant.

---

### Pattern 6: Conditional Error Message with Role Alert

```typescript
// app/routes/home.tsx component

const errorMessage = actionData && "error" in actionData ? actionData.error : undefined;

{errorMessage !== undefined && (
  <p role="alert" className="text-sm text-destructive">
    {errorMessage}
  </p>
)}
```

**Where to apply**: Inside the form JSX, between counter and submit button

**Why this pattern**: `role="alert"` announces the message to screen readers when it appears. `errorMessage !== undefined` (not `!errorMessage`) correctly narrows the optional type. Only renders when error actually exists.

---

## Test Cases

### Unit Tests

#### Test Suite: `generateFurigana` Service (`app/services/furigana.test.ts`)

**Test 1**: Calls OpenAI API and returns parsed tokens

- **Given**: `generateFurigana("日本語を勉強しています")` with mocked `openaiClient`
- **When**: Mock returns `{ choices: [{ message: { content: "日本語{にほんご}を勉強{べんきょう}しています" } }] }`
- **Then**: Function returns array with 3 tokens (2 ruby, 1 text)
- **Coverage**: Detects broken AI call or parse flow

**Test 2**: Throws on empty AI response

- **Given**: Mock returns `{ choices: [{ message: { content: "" } }] }`
- **When**: Function is called
- **Then**: Throws with message "Empty response from AI"
- **Coverage**: Detects missing empty response guard

**Test 3**: Throws on API error

- **Given**: Mock throws network error
- **When**: Function is called
- **Then**: Error propagates to caller
- **Coverage**: Detects error swallowing

---

#### Test Suite: Home Route Action (`app/routes/home.test.ts`)

**Test 1**: Valid text → calls service → returns tokens

- **Given**: Mock `generateFurigana` returns tokens
- **When**: Action receives form with valid text
- **Then**: Returns `{ tokens: [...] }`
- **Coverage**: Detects broken action flow

**Test 2**: Empty text → returns error

- **Given**: Form with empty text field
- **When**: Action processes request
- **Then**: Returns `{ error: "Please enter some Japanese text.", originalText: "" }`
- **Coverage**: Detects missing empty-text guard

**Test 3**: Over-limit text → returns error

- **Given**: Form with `MAX_INPUT_LENGTH + 1` characters (import `MAX_INPUT_LENGTH` from `~/constants/input` in the test)
- **When**: Action processes request
- **Then**: Returns error with `originalText` preserved
- **Coverage**: Detects missing limit check; test automatically stays correct if the constant changes

**Test 4**: Service throws → returns error

- **Given**: Mock `generateFurigana` throws
- **When**: Action processes valid form
- **Then**: Returns generic error with `originalText` preserved
- **Coverage**: Detects error handling failure

---

#### Test Suite: Home Route Component (`app/routes/home.test.tsx`)

These tests require React testing library. Use `environment: "jsdom"` in Vitest config.

**Test 1**: Counter updates on textarea change

- **Given**: Component renders
- **When**: User types 5 characters
- **Then**: Counter shows `5 / 10,000`
- **Coverage**: Detects missing counter update

**Test 2**: Counter turns red at `MAX_INPUT_LENGTH` characters

- **Given**: Textarea filled with exactly `MAX_INPUT_LENGTH` characters (construct via `"あ".repeat(MAX_INPUT_LENGTH)`)
- **When**: Component renders
- **Then**: Counter paragraph has `text-destructive` class
- **Coverage**: Detects off-by-one error; test stays correct if the constant changes

**Test 3**: Submit button disabled on load

- **Given**: Component renders (empty textarea)
- **When**: Initial state
- **Then**: Button has `disabled` attribute
- **Coverage**: Detects missing empty guard

**Test 4**: Submit button disabled over limit

- **Given**: Textarea with `MAX_INPUT_LENGTH + 1` characters
- **When**: Component renders
- **Then**: Button has `disabled` attribute
- **Coverage**: Detects missing over-limit guard

**Test 5**: Error message renders with `role="alert"`

- **Given**: `actionData = { error: "Something went wrong", originalText: "日本語" }`
- **When**: Component renders
- **Then**: `<p role="alert">` contains error text; textarea value is "日本語"
- **Coverage**: Detects missing error display or text restoration

**Test 6**: Success transitions to ReadingView

- **Given**: `actionData = { tokens: [...] }`
- **When**: Component renders
- **Then**: `ReadingView` is displayed, form is gone
- **Coverage**: Detects missing success transition

**Test 7**: Form submits via button click

- **Given**: Valid text in textarea
- **When**: User clicks submit button
- **Then**: Form is submitted (action called)
- **Coverage**: Detects broken button submission

**Test 8**: Form submits via Cmd+Enter

- **Given**: Valid text in textarea
- **When**: User presses Cmd+Enter
- **Then**: Form is submitted (native form behavior)
- **Coverage**: Verifies native form submission handling

**Test 9**: Button shows spinner during submission

- **Given**: `navigation.state === "submitting"`
- **When**: Component receives updated state
- **Then**: Button shows "Generating…" text and spinner icon
- **Coverage**: Detects missing loading state display

---

### Integration Tests (Manual / Smoke Test)

**Test 1**: Full flow from input to reading view

- **Setup**: Start dev server with valid `OPENAI_API_KEY`
- **Steps**:
  1. Navigate to `/`
  2. Paste "東京に行きました"
  3. Click "Generate Furigana"
  4. Wait for response
- **Expected**: `ReadingView` appears with `<ruby>` elements
- **Coverage**: End-to-end validation of service + route + UI

**Test 2**: Error handling preserves text

- **Setup**: Start dev server, block API calls (DevTools Network tab)
- **Steps**:
  1. Navigate to `/`
  2. Enter "テスト"
  3. Submit
  4. Wait for error
- **Expected**: Form reappears with error message; textarea contains "テスト"
- **Coverage**: Error handling and text preservation

---

### E2E Tests

**Status**: Not applicable for this task. E2E tests are deferred to a dedicated testing task after all components are complete. Smoke testing via `pnpm dev` is sufficient for Task 11.

---

## Implementation Checklist

**Phase 1: Input Constants**

- [x] Create `app/constants/` directory if it does not exist
- [x] Create `app/constants/input.ts`
- [x] Export `MAX_INPUT_LENGTH = 10_000`
- [x] `pnpm type-check` passes

**Phase 2: Textarea Installation**

- [x] Run `pnpx shadcn@latest add textarea --defaults`
- [x] Verify `app/components/ui/textarea.tsx` exists and exports `Textarea`
- [x] `pnpm type-check` passes

**Phase 3: Furigana Service**

- [x] Create `app/services/furigana.ts`
- [x] Import `openaiClient`, prompts, parser
- [x] Implement `generateFurigana(text: string): Promise<FuriganaToken[]>`
- [x] Create `app/services/furigana.test.ts` with unit tests
- [x] Test: valid AI response → tokens returned
- [x] Test: empty response → throws
- [x] Test: API error → throws
- [x] `pnpm test app/services/furigana.test.ts` passes

**Phase 4: Home Route Form and Action**

- [x] Modify `app/routes/home.tsx`
- [x] Import `MAX_INPUT_LENGTH` from `~/constants/input` (no local redeclaration)
- [x] Define action types: `ActionSuccess`, `ActionError`
- [x] Implement `action()` function:
  - [x] Extract and validate `text` from `formData`
  - [x] Validate against `MAX_INPUT_LENGTH`
  - [x] Call `generateFurigana(text)` from service
  - [x] Return success or error object
  - [x] Catch errors and return generic error message
- [x] Implement component:
  - [x] Use `useNavigation()` for `isSubmitting` state
  - [x] Use `useActionData()` for error and success paths
  - [x] Derive `charCount`, `isOverLimit`, `isSubmitDisabled` using `MAX_INPUT_LENGTH`
  - [x] Render `<Form method="post">` (React Router component)
  - [x] Render `<Textarea>` with `aria-label`, `placeholder`, `maxLength={MAX_INPUT_LENGTH}`, `name`, `value`, `onChange`, `disabled`
  - [x] Render counter `<p>` with `{MAX_INPUT_LENGTH.toLocaleString()}` and conditional color
  - [x] Render error `<p role="alert">` when `errorMessage !== undefined`
  - [x] Render `<Button type="submit">` with spinner during submission
  - [x] Transition to `<ReadingView>` on success
- [x] Create `app/routes/home.test.ts` and `app/routes/home.test.tsx` with unit/component tests
- [x] Tests reference `MAX_INPUT_LENGTH` from `~/constants/input` — no hardcoded `10_000` or `10001`
- [x] `pnpm type-check` passes
- [x] `pnpm exec eslint app/routes/home.tsx` passes

**Phase 5: Verification**

- [x] `pnpm type-check` passes with zero errors
- [x] `pnpm exec eslint app/constants/input.ts app/services/ app/routes/home.tsx` passes
- [x] `pnpm build` succeeds with no errors
- [x] `pnpm dev` smoke test:
  - [x] Navigate to `/`
  - [x] Counter shows `0 / 10,000` on load
  - [x] Button is disabled on load
  - [x] Typing updates counter
  - [x] At 10,000 characters, counter turns red and button disables
  - [x] Submitting valid text transitions to `ReadingView` with `<ruby>` elements
  - [x] On error, form reappears with error message and text preserved

---

## Notes & Considerations

**Why React Router `<Form>` instead of direct `fetch` or `useFetcher`**

The home route uses a React Router `action` function. This allows:

1. **Progressive enhancement**: Form works even if JavaScript hasn't loaded
2. **Automatic loading state**: `useNavigation()` provides `state === "submitting"` without manual state management
3. **Type-safe response handling**: `useActionData()` returns the exact action return type
4. **Native keyboard shortcut support**: `<Form>` submission is triggered by Cmd+Enter automatically (native HTML behavior)

This is cleaner and more idiomatic for React Router v7 than a callback-based pattern or manual fetch calls.

**Constants file placement (`app/constants/input.ts`)**

A dedicated `app/constants/` directory follows a common pattern for values that are neither utility functions nor schema definitions. Keeping it separate from `app/lib/` avoids mixing pure constants with modules that have side effects (e.g., Axios instance creation, Sentry initialization). The file contains no imports, so it can safely be imported from server modules, client modules, and test files alike.

**No hardcoded `10_000` anywhere outside the constants file**

After this task, the numeric literal `10_000` (or `10000`) must not appear outside `app/constants/input.ts`. All comparisons, `maxLength` attributes, counter displays, and test fixtures should reference `MAX_INPUT_LENGTH`. This rule is enforced at code review.

**Service layer architecture**

The `generateFurigana` service is extracted from the API endpoint (Task 10) so it can be reused by the route action. This separation provides:

- **Testability**: Service can be unit tested in isolation without an HTTP layer
- **Reusability**: Future tasks (M2 title generation, bulk operations) can call the same service
- **Clarity**: The service layer handles AI logic; the route action handles HTTP/validation

**Keyboard shortcut via native form submission**

Cmd+Enter and Ctrl+Enter trigger native form submission (`HTMLFormElement.submit()`) when the textarea is inside a `<form>`. The React Router `<Form>` component captures this submission and calls the route action. No explicit `onKeyDown` handler is needed — the browser provides this for free.

**Text preservation on error**

When the action returns an error, `useActionData()` provides `originalText`. The component's `useState` initializer reads from `actionData` to restore the textarea:

```typescript
const [text, setText] = useState(() =>
  actionData && "error" in actionData ? actionData.originalText : "",
);
```

This happens once on mount (first render after action returns). If needed, add a `useEffect` to sync subsequent action data changes to the textarea.

**Testing library setup**

Component tests for the home route require `@testing-library/react` and `jsdom`:

```bash
pnpm add -D @testing-library/react jsdom
```

Update `vitest.config.ts` to set `environment: "jsdom"` globally, or add `// @vitest-environment jsdom` to the top of component test files to limit the overhead to component tests only.

**`ReadingView` integration**

Task 12 creates `app/components/furigana/ReadingView.tsx`. Until then, Task 11 can use a temporary stub in `home.tsx` to avoid a hard blocking dependency:

```typescript
// Temporary stub — replace with real ReadingView import in Task 12
function ReadingView({ tokens: _tokens }: { tokens: FuriganaToken[] }) {
  return <div>Reading view coming soon.</div>;
}
```

Once Task 12 is complete, replace with the real import:

```typescript
import { ReadingView } from "~/components/furigana/ReadingView";
```

**No separate InputArea component**

Unlike the original plan, there is no `app/components/furigana/InputArea.tsx` component. The textarea, counter, button, and error message are implemented directly in the home route. This reduces component fragmentation when the entire form is tightly coupled to the route's state and action.
