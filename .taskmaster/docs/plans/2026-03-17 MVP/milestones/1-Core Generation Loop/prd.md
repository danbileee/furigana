# Sub-PRD: Milestone 1 — Core Generation Loop

**Project**: Furigana MVP — AI Japanese Reading Assistant
**Milestone**: 1 of 8
**Generated**: 2026-03-18
**Source PRD**: `docs/plans/2026-03-17/prd.md`
**Source Roadmap**: `docs/plans/2026-03-17/roadmap.md`
**Milestone Weight**: 0.23 (highest-weight milestone; foundational to all subsequent work)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [User Journey](#user-journey)
3. [Feature Specifications](#feature-specifications)
4. [Edge Cases and Error Handling](#edge-cases-and-error-handling)
5. [Out of Scope for This Milestone](#out-of-scope-for-this-milestone)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Dependency and Conflict Analysis](#dependency-and-conflict-analysis)

---

## Problem Statement

Japanese learners at the intermediate level regularly encounter kanji they cannot read. The friction of pausing, switching to a dictionary app, and looking up readings one by one breaks reading concentration and makes native-level content inaccessible. No fast, clean web tool currently accepts arbitrary Japanese text and instantly returns a furigana-annotated version suitable for comfortable sustained reading.

Milestone 1 delivers the product's entire core value proposition: the end-to-end loop from pasting Japanese text to seeing it rendered with furigana ruby annotations. Every subsequent milestone (persistence, history sidebar, view mode toggle, title generation, soft-delete, inline editing, mobile drawer) is an additive layer on top of this loop. If this loop is unstable, all downstream milestones inherit the instability.

The two sub-problems this milestone solves:

1. **AI generation**: Invoking GPT-4o-mini on the server, with the API key fully isolated from the client bundle, and receiving a correctly-formatted annotation string in return.
2. **Safe rendering**: Transforming the annotation string into a typed token array — never raw HTML — and rendering it as semantic `<ruby>` elements. This eliminates any XSS surface at the only point in the app where AI-generated content becomes DOM content.

---

## User Journey

This milestone covers steps 1–5 of the full product user journey. Steps 6–11 are deferred to later milestones.

### Primary Flow

```
1. User opens the app
   └── Sees: large textarea with placeholder "Paste Japanese text here..."
             Character counter showing "0 / 10,000"
             "Generate Furigana" button (disabled when textarea is empty)

2. User pastes a Japanese paragraph into the textarea
   └── Character counter updates in real time
       Submit button becomes enabled (if 1–10,000 characters)

3. User clicks "Generate Furigana" OR presses Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux)
   └── [Empty textarea guard]: if textarea is empty, nothing happens — no error, no navigation
       [Over-limit guard]: if > 10,000 characters, button is disabled and shortcut is blocked

4. Loading state begins
   └── Textarea is disabled (not cleared)
       Button shows spinner + disabled state
       User waits; no timeout message unless an actual error occurs

5a. Success path: AI returns a valid annotation string
    └── Main area transitions from InputArea to ReadingView
        Text is displayed with <ruby> elements above each annotated kanji compound
        Non-kanji characters render as plain text — no annotations, no crashes

5b. Error path: AI call fails or returns malformed output
    └── Loading state clears
        Inline error message appears below textarea: "Something went wrong. Please try again."
        Textarea content is fully preserved and re-enabled
        User can retry without re-pasting their text
```

### Alternative Flows

| Input Type                           | Expected Outcome                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Pure hiragana ("こんにちは")         | Reading view displays text as-is; no `<ruby>` elements; no crash                 |
| Pure romaji ("Hello world")          | Reading view displays text as-is; no `<ruby>` elements; no crash                 |
| Mixed kanji + hiragana + punctuation | Kanji compounds annotated; hiragana and punctuation rendered as plain `<span>`   |
| Empty textarea                       | No action; no error; button is inert                                             |
| Textarea > 10,000 characters         | Submit button disabled; character counter highlighted; keyboard shortcut blocked |

---

## Feature Specifications

### Core Features

#### F1: Text Input Area (`InputArea` component)

A large textarea occupying the main content area of the route. This is the default state of `app/routes/home.tsx` when no action data is present.

**Behaviors**:

- Placeholder text: `"Paste Japanese text here…"` (or similar; exact copy TBD)
- Maximum character limit: 10,000 characters
- Character counter renders below the textarea: `{currentCount} / 10,000`
- Counter text color changes to a warning color (e.g., `text-destructive` from shadcn/ui) when the limit is reached or exceeded
- The "Generate Furigana" button is disabled when:
  - The textarea is empty (zero characters)
  - The character count exceeds 10,000
- The "Generate Furigana" button is enabled for any input between 1 and 10,000 characters inclusive
- Keyboard shortcut: `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux) fires form submission when the textarea is focused — equivalent to clicking the button; obeys the same empty and over-limit guards
- The shortcut is implemented via `onKeyDown` on the textarea element only; it does not fire from other elements on the page

**State**:

- `text` is a controlled React state value bound to the textarea's `value` prop
- Initial value: empty string on first render; initialized from `useActionData()` on error path so content is preserved after a failed submission
- Character count is derived from `text.length` — no separate state

**UI Structure**:

```
<Form method="post">
  <InputArea
    value={text}
    onChange={setText}
    disabled={isSubmitting}
    maxLength={10000}
  />
  <!-- Character counter -->
  <!-- Submit button with spinner during submission -->
</Form>
```

---

#### F2: Furigana Generation via Server Action (`action` in `home.tsx`)

The React Router server `action` function is the single point where GPT-4o-mini is called. It reads the submitted text, calls the AI client, validates the response, and returns structured data to the client.

**Action inputs**:

- `text` — extracted from `formData.get('text')` as a string
- Validated: non-empty, not exceeding 10,000 characters (belt-and-suspenders server-side validation mirrors client guards)

**Action flow**:

```
1. Extract and validate text from formData
2. Call openai client with system prompt + user message
3. Receive annotation string from GPT-4o-mini
4. Validate that the response matches the expected annotation format
5a. Success: return { annotationString: string }
5b. Failure (API error, malformed response): return { error: string, originalText: string }
```

**Action return types**:

```typescript
type ActionSuccess = {
  annotationString: string;
};

type ActionError = {
  error: string;
  originalText: string;
};

type ActionData = ActionSuccess | ActionError;
```

**Validation rule**: The annotation string is considered valid if it is a non-empty string. Strict format validation (e.g., regex assertion that all `{...}` blocks are well-formed) is intentionally left to the parser — the action's responsibility is to confirm a response was received, not to duplicate parser logic. If the AI response is empty or the API call throws, return the error path.

---

#### F3: GPT-4o-mini Client (`app/lib/ai/client.ts`)

A server-only module that exports a pre-configured `openai` SDK client instance.

**Requirements**:

- Import `OpenAI` from the `openai` npm package
- Configure with `process.env.OPENAI_API_KEY` — no `VITE_` prefix; this module must never be imported by any client-side code
- Export a single named constant `openaiClient` of type `OpenAI`
- The module should throw at import time (startup) if `OPENAI_API_KEY` is not set, rather than failing silently at request time

**Pattern**:

```typescript
// app/lib/ai/client.ts
// Server-only — do not import from client-side modules

import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];
if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

export const openaiClient = new OpenAI({ apiKey });
```

---

#### F4: System Prompt and Few-Shot Examples (`app/lib/ai/prompts.ts`)

A server-only module that exports the system prompt and a helper to build the user message.

**System prompt requirements**:

- Instruct GPT-4o-mini to annotate every kanji compound with its hiragana reading in `漢字{よみ}` format
- Instruct the model to return **only** the annotated string — no explanations, no preamble, no markdown code blocks, no quotation marks
- Include 2–3 few-shot examples directly in the system prompt to lock in the format
- Non-kanji characters (hiragana, katakana, punctuation, numbers, latin) must pass through unchanged

**Example few-shot format** (to be included verbatim in the system prompt string):

```
Input:  日本語を勉強しています。
Output: 日本語{にほんご}を勉強{べんきょう}しています。

Input:  東京に行きました。
Output: 東京{とうきょう}に行{い}きました。

Input:  こんにちは！元気ですか？
Output: こんにちは！元気{げんき}ですか？
```

**Exports**:

```typescript
export const FURIGANA_SYSTEM_PROMPT: string;
export function buildUserMessage(text: string): string;
```

---

#### F5: Annotation String Parser (`app/lib/furigana/parser.ts`)

Transforms the AI-generated annotation string into a typed token array. This is the most critical unit in the milestone — it is the boundary between raw AI output and safe, type-checked rendering.

**Token type definition**:

```typescript
type TextToken = {
  type: "text";
  value: string;
};

type RubyToken = {
  type: "ruby";
  kanji: string;
  reading: string;
};

export type FuriganaToken = TextToken | RubyToken;
```

**Parser contract**:

```typescript
export function parseAnnotationString(input: string): FuriganaToken[];
```

**Parsing algorithm**:

The input string contains sequences of:

- Plain text characters (hiragana, katakana, punctuation, romaji, etc.)
- Annotated compounds in the form `漢字{よみ}`

The parser iterates through the string and produces tokens. The regex approach:

```
Pattern: /([^{}]+)|\{([^}]*)\}/g
```

However, the parser must account for the structure where kanji precede their `{reading}` brace. A more accurate model:

1. Split the input using the regex to identify all `{...}` brace groups and the text between them
2. When a `{reading}` group is found, look at the accumulated preceding text to extract the kanji that it annotates (all characters immediately before the brace that are not already annotated)
3. Produce a `RubyToken` from the kanji + reading pair
4. Produce `TextToken` values for all non-annotated text segments

**Exact parsing logic** (reference implementation, to be refined in unit tests):

```
State machine approach:
- Maintain a buffer of the current text segment
- On encountering '{': everything in the buffer up to the last non-annotated group becomes the kanji of the next ruby token
- On encountering '}': finalize the ruby token with the reading collected inside the braces
- Flush remaining buffer as a TextToken at end of string
```

**Edge cases the parser must handle** (all must have unit tests):

| Input                                              | Expected Output                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `"日本語{にほんご}"`                               | `[{ type: 'ruby', kanji: '日本語', reading: 'にほんご' }]`                                                                            |
| `"行{い}きました"`                                 | `[{ type: 'ruby', kanji: '行', reading: 'い' }, { type: 'text', value: 'きました' }]`                                                 |
| `"東京{とうきょう}に行{い}きました"`               | Two ruby tokens + one text token                                                                                                      |
| `"こんにちは"` (pure hiragana)                     | `[{ type: 'text', value: 'こんにちは' }]`                                                                                             |
| `"Hello world"` (pure romaji)                      | `[{ type: 'text', value: 'Hello world' }]`                                                                                            |
| `""` (empty string)                                | `[]`                                                                                                                                  |
| `"漢字{よみ}漢字{よみ}"` (consecutive ruby)        | Two adjacent ruby tokens, no text token between                                                                                       |
| `"unclosed{"` (malformed: unclosed brace)          | Treat the `{` and everything after as plain text: `[{ type: 'text', value: 'unclosed{' }]`                                            |
| `"bad{nested{braces}}"` (malformed: nested braces) | Treat outer brace content literally or skip; must not crash or produce invalid tokens                                                 |
| `"text{}"` (empty reading)                         | Either skip (produce a text token for `"text"`) or produce a ruby token with empty reading; document the chosen behavior in a comment |
| Mixed: `"東京{とうきょう}は元気{げんき}？"`        | Two ruby tokens and one text token `"は"` and `"？"`                                                                                  |

**Safety requirement**: The parser must never return any token with HTML markup in its string values. It must never be called with raw HTML input that could produce script injection. The parser is purely string-splitting — no HTML generation occurs here.

---

#### F6: Reading View (`app/components/furigana/ReadingView.tsx`)

Renders the parsed token array as semantic HTML using `<ruby>` elements. This component receives the token array (not the raw annotation string) as its prop.

**Props**:

```typescript
type ReadingViewProps = {
  tokens: FuriganaToken[];
};
```

**Rendering rules**:

- `TextToken` → `<span>{value}</span>`
- `RubyToken` → `<ruby>{kanji}<rp>(</rp><rt>{reading}</rt><rp>)</rp></ruby>`
- The `<rp>` elements provide fallback parentheses for browsers that do not support ruby — this is a semantic HTML best practice
- The component maps tokens to JSX using `Array.prototype.map` with a stable `key` (index is acceptable since the array is immutable once rendered)
- **Never** use `dangerouslySetInnerHTML` — all content is expressed as typed JSX values

**Container structure**:

```tsx
<article className="reading-view">
  {tokens.map((token, index) =>
    token.type === "ruby" ? (
      <ruby key={index}>
        {token.kanji}
        <rp>(</rp>
        <rt>{token.reading}</rt>
        <rp>)</rp>
      </ruby>
    ) : (
      <span key={index}>{token.value}</span>
    ),
  )}
</article>
```

**Note on future compatibility**: Milestone 3 will add a `viewMode` prop to `ReadingView`. Design the component's interface to accept optional props gracefully (or plan for a one-line prop addition in M3). No `viewMode` logic is implemented in this milestone.

---

#### F7: Ruby CSS Base Rules (`app/app.css`)

CSS rules that ensure `<ruby>`, `<rt>`, and `<rp>` elements render correctly under Tailwind v4's base reset.

**Problem**: Tailwind v4's preflight reset sets `display: block` on many elements. Without explicit overrides, `<ruby>` and `<rt>` may not render inline as expected.

**Solution**: Define ruby display rules in `@layer base` so they apply after the reset.

```css
@layer base {
  ruby {
    display: ruby;
  }

  rt {
    display: ruby-text;
    font-size: 0.5em;
    line-height: 1;
  }

  rp {
    display: none;
  }
}
```

**Reading view typography** (also in `app.css` or as Tailwind utility classes on the container):

- Font size: sufficient for comfortable reading (e.g., `1rem` or `1.125rem` base)
- Line height: generous to accommodate ruby text above base text (e.g., `2.5` or `3`)
- The ruby text must not overlap the base text or the line above

---

#### F8: Environment Configuration (`.env.example`)

A committed `.env.example` file documents all required environment variables for this milestone.

```
# Required for AI furigana generation (server-only — no VITE_ prefix)
OPENAI_API_KEY=sk-...
```

The actual `.env` file must be in `.gitignore` (verify this is already configured). The `.env.example` is safe to commit.

---

### Interactions and Behaviors

#### Submission Loading State

**Trigger**: User submits the form (button click or keyboard shortcut)

**React Router idiomatic pattern**:

```typescript
const navigation = useNavigation();
const isSubmitting = navigation.state === "submitting";
```

**Effects of `isSubmitting === true`**:

- Textarea: `disabled={true}` — prevents editing during generation
- Submit button: `disabled={true}` + shows a spinner icon (Lucide `Loader2` with `animate-spin` class)
- Button label changes from "Generate Furigana" to "Generating…" or shows spinner only

**Effects of `isSubmitting === false`**:

- If `useActionData()` returns `{ annotationString }`: render `ReadingView` instead of `InputArea`
- If `useActionData()` returns `{ error }`: render `InputArea` with error message, textarea re-enabled with original content

#### Error Display

**Location**: Below the textarea, above the submit button

**Content**: `"Something went wrong. Please try again."`

**Condition**: Rendered only when `useActionData()` returns an object containing an `error` key

**Textarea content preservation**: The `text` controlled state must be initialized from `actionData.originalText` when the error path is returned, so the user's pasted content is not lost.

```typescript
const actionData = useActionData<ActionData>();
const [text, setText] = useState(
  actionData && "originalText" in actionData ? actionData.originalText : "",
);
```

**Caution**: `useState` initializer only runs once (on mount). If the component re-mounts between submissions, this initialization is correct. If it does not re-mount, the state update must be handled via `useEffect` monitoring `actionData` — confirm behavior with React Router's SSR component lifecycle before finalizing.

#### Keyboard Shortcut

**Event**: `onKeyDown` on the textarea element

**Condition**: `(event.metaKey || event.ctrlKey) && event.key === 'Enter'`

**Guard**: Do not submit if textarea is empty or character count exceeds 10,000

**Implementation note**: The shortcut should programmatically submit the form (e.g., via `formRef.current?.requestSubmit()`) rather than dispatching a synthetic click, to correctly trigger the React Router form submission lifecycle.

#### Route-Level Layout

`home.tsx` renders either `InputArea` or `ReadingView` based on the presence and shape of `useActionData()`:

```
actionData === undefined → render InputArea (no submission yet)
actionData.annotationString exists → render ReadingView
actionData.error exists → render InputArea with error message
```

The route itself is a standard React Router route component. No `loader` is required in this milestone — the route has no server-side data to fetch at page load.

---

### UI/UX Considerations

#### Typography for Reading View

The furigana reading view is not a utility display — it is meant for sustained reading. Apply these principles:

- **Line height**: Set `line-height` high enough (e.g., `2.5rem` or `3`) that ruby text above kanji does not visually compress or overlap the line above
- **Font size**: Use a comfortable base size (`1rem` or larger) — do not shrink to fit more text
- **Ruby text size**: `0.5em` relative to the base font size is standard for furigana; smaller sizes are illegible
- **Word spacing**: Ruby elements are inline; do not add extra spacing between `<ruby>` and adjacent `<span>` elements unless visual testing shows gaps

#### Character Counter Styling

- Default: subdued color (e.g., `text-muted-foreground`)
- At or over 10,000 characters: warning color (e.g., `text-destructive`)
- Position: below the right edge of the textarea, right-aligned, to match common text editor conventions

#### Submit Button States

| State          | Label               | Icon                  | `disabled` |
| -------------- | ------------------- | --------------------- | ---------- |
| Empty textarea | "Generate Furigana" | none                  | `true`     |
| Valid input    | "Generate Furigana" | none                  | `false`    |
| Over limit     | "Generate Furigana" | none                  | `true`     |
| Submitting     | "Generating…"       | Lucide `Loader2` spin | `true`     |

#### Accessibility

- The textarea must have an accessible label (either a visible `<label>` or `aria-label`)
- The submit button's disabled state must be communicated via the `disabled` attribute (not just visual styling)
- `<ruby>`, `<rt>`, and `<rp>` are natively semantic — no additional ARIA roles required
- Error message rendered with `role="alert"` so screen readers announce it on appearance

---

## Edge Cases and Error Handling

### E1: Empty Textarea Submission

**Scenario**: User clicks "Generate Furigana" or uses keyboard shortcut with an empty textarea.

**Handling**: The submit button is `disabled` when `text.length === 0`. The keyboard shortcut checks `text.length > 0` before calling `requestSubmit()`. No form submission occurs. No error message is shown. No navigation occurs. The button remains in its default state.

**Server-side guard**: Even if the client guard is bypassed, the server `action` validates that `text` is non-empty and returns an error response rather than calling the AI.

---

### E2: Character Limit Exceeded

**Scenario**: User pastes or types more than 10,000 characters.

**Handling**:

- The textarea's `maxLength` attribute is set to `10000` to prevent typing beyond the limit
- For paste events that would exceed the limit, the textarea truncates at 10,000 characters (browser native behavior with `maxLength`)
- The character counter shows `10000 / 10000` (or the exact count) in warning color
- The submit button is `disabled`
- The keyboard shortcut is blocked

**Note**: If `maxLength` is relied upon, the controlled `text` state will never exceed 10,000 characters through normal interaction. The server-side guard still validates this in case of direct API calls.

---

### E3: AI API Call Failure

**Scenario**: The `openai` SDK call throws (network error, rate limit, invalid API key, service outage).

**Handling**:

- The `action` catches the error with a `try/catch` block
- Returns `{ error: 'Something went wrong. Please try again.', originalText: text }` with an appropriate HTTP status (200 is acceptable for React Router action error returns to keep client-side handling simple; alternatively use a thrown `Response` object)
- `useActionData()` on the client returns the error object
- `InputArea` renders with the error message and re-enabled textarea pre-filled with `originalText`

**Implementation note**: Do not expose raw error messages (e.g., OpenAI error codes) to the user. Always return the generic message. Log the raw error server-side via `console.error` for debugging.

---

### E4: Malformed AI Response

**Scenario**: GPT-4o-mini returns a response that is non-empty but does not conform to the `漢字{よみ}` format (e.g., returns a JSON object, returns the text unchanged with no annotations, returns text with incorrectly paired braces).

**Handling**:

- **Non-empty, parseable string**: Return `{ annotationString }` and let the parser handle it. The parser is designed to be resilient — malformed braces produce text tokens rather than crashes. The user sees the text with partial or no annotations, which is acceptable graceful degradation.
- **Empty string response**: Treat as a failure — return the error path.
- **Non-string response**: The `openai` SDK always returns strings in `message.content`; this case is handled by TypeScript types.

**Design rationale**: Strict validation of the annotation format in the action would create a fragile rejection of edge-case AI outputs that are technically valid (e.g., a passage with no kanji would produce an output string with no `{...}` blocks — this is correct behavior, not an error).

---

### E5: Pure Non-Kanji Input

**Scenario**: User submits text that contains no kanji (e.g., `"こんにちは"`, `"Hello world"`, `"1234567890"`).

**Handling**:

- The AI returns the text unchanged (no `{...}` annotations)
- The parser produces an array of `TextToken` values only
- `ReadingView` renders plain `<span>` elements — no `<ruby>` elements
- No error is shown; the reading view displays successfully
- This is correct, expected behavior — not a degraded state

---

### E6: Malformed Braces in Parser Input

**Scenario**: The annotation string contains unclosed `{`, nested braces `{outer{inner}}`, or mismatched pairs.

**Handling** (parser-level, not action-level):

- **Unclosed `{`**: Treat everything from the `{` to end of string as a text token
- **Nested braces**: Treat the outer content literally; the inner `{` triggers the same unclosed-brace logic
- **Empty reading `{}`**: Implementation-defined; either produce a ruby token with empty `reading` (which renders an empty `<rt>`) or skip and produce a text token for the kanji. Document the chosen behavior in the parser source code.
- The parser must **never throw** on any input — it is processing external AI output and must be defensively coded

---

### E7: Network Timeout (No Explicit Timeout in This Milestone)

**Scenario**: The AI call hangs for an extended period (e.g., 30+ seconds).

**Handling**: Per the PRD, no timeout message is shown unless an actual error occurs — the user simply waits. The loading state remains active indefinitely until the server action resolves (success or error). The `openai` SDK may impose its own default timeout; no custom timeout configuration is added in this milestone.

**Future consideration**: A timeout mechanism could be added in a later milestone if user feedback indicates it is needed.

---

## Out of Scope for This Milestone

The following features appear in the master PRD but are explicitly deferred:

| Feature                                           | Milestone    |
| ------------------------------------------------- | ------------ |
| Persisting entries to Turso DB                    | Milestone 2  |
| History sidebar                                   | Milestone 2  |
| "New" button                                      | Milestone 2  |
| View mode toggle (Always / On Hover)              | Milestone 3  |
| AI title generation                               | Milestone 4  |
| Inline title editing                              | Milestone 5  |
| Soft-delete and Trash menu                        | Milestone 6  |
| Session persistence (last-viewed entry on reload) | Milestone 7b |
| Relative timestamps                               | Milestone 7a |
| Mobile sidebar drawer                             | Milestone 8  |

In this milestone, `home.tsx` has **no loader** and **no sidebar**. The route renders either `InputArea` or `ReadingView` based solely on action data. The page has no persistent state between sessions.

---

## Implementation Roadmap

### Objective

Build the complete end-to-end furigana generation loop: textarea input → form submission → server-side GPT-4o-mini call → annotation string → parser → typed token array → ruby HTML rendering. Deliver this as a working web page with full unit and integration test coverage of the parser and action handler, and Playwright E2E tests for the primary user flow. No persistence is introduced.

**Success definition**: A developer can open `http://localhost:5173`, paste any Japanese text, click "Generate Furigana", and see a correctly annotated reading view — in a browser tab that shows no `<ruby>` rendering bugs, no TypeScript errors in the console, and a passing test suite.

---

### Key Components

| Component                                 | Type                          | Status  | Responsibility                                                                    |
| ----------------------------------------- | ----------------------------- | ------- | --------------------------------------------------------------------------------- |
| `app/routes/home.tsx`                     | Route component               | Rewrite | App shell; form with `action`; conditional render of `InputArea` vs `ReadingView` |
| `app/lib/ai/client.ts`                    | Server-only module            | New     | Configured `OpenAI` SDK instance                                                  |
| `app/lib/ai/prompts.ts`                   | Server-only module            | New     | System prompt string and `buildUserMessage` helper                                |
| `app/lib/furigana/parser.ts`              | Shared module (server+client) | New     | `parseAnnotationString` function; `FuriganaToken` types                           |
| `app/components/furigana/ReadingView.tsx` | React component               | New     | Renders `FuriganaToken[]` as `<ruby>` JSX                                         |
| `app/components/furigana/InputArea.tsx`   | React component               | New     | Controlled textarea with counter and submit button                                |
| `app/app.css`                             | CSS                           | Modify  | Add ruby base rules in `@layer base`                                              |
| `.env.example`                            | Config                        | New     | Document `OPENAI_API_KEY`                                                         |
| `package.json`                            | Config                        | Modify  | Add `openai`, `vitest`, `@playwright/test` as dependencies                        |

---

### Architectural Focus

#### Server/Client Boundary

React Router v7 with SSR enabled enforces a clear server/client boundary through file conventions and module imports. This milestone's architecture exploits that boundary deliberately:

```
CLIENT                          SERVER
───────────────────────────────────────────────────────
InputArea (controlled state)    action() in home.tsx
ReadingView (pure rendering)      └── app/lib/ai/client.ts (openaiClient)
useNavigation() for loading           └── process.env.OPENAI_API_KEY
useActionData() for results       └── app/lib/ai/prompts.ts
                                  └── app/lib/furigana/parser.ts
                                      (parser runs on server; tokens sent to client)
```

The `openai` npm package and `OPENAI_API_KEY` are accessed only inside the server `action`. The parsed token array (a plain JSON-serializable object) is the only data that crosses the server/client boundary. The client renders what the server parsed — never what the AI returned directly.

#### Data Flow

```
User input (textarea)
  → Form POST to action
    → formData.get('text')
      → openaiClient.chat.completions.create(...)
        → annotationString (raw AI output)
          → parseAnnotationString(annotationString)
            → FuriganaToken[]
              → JSON serialize in action return
                → useActionData() on client
                  → <ReadingView tokens={tokens} />
                    → <ruby> / <span> JSX → DOM
```

#### Token Array as the XSS Boundary

The AI output (`annotationString`) is an untrusted string from an external API. The parser is the single point where this string is analyzed. After parsing:

- Every `RubyToken.kanji` and `RubyToken.reading` is a plain string inserted into JSX via `{}` interpolation — React escapes it automatically
- Every `TextToken.value` is similarly escaped
- `dangerouslySetInnerHTML` is never used in this milestone

This architecture eliminates the XSS attack surface regardless of what GPT-4o-mini returns.

#### TypeScript Strict Mode Compliance

The codebase uses `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `noImplicitOverride`. Key implications for this milestone:

- Array access (`tokens[index]`) may return `undefined` under `noUncheckedIndexedAccess`; use `tokens.map()` instead of index-based access
- `formData.get('text')` returns `FormDataEntryValue | null`; narrow the type explicitly before use (e.g., `typeof value === 'string'`)
- Do not use `as` casts; use type guards or `satisfies` instead
- Do not use `any`; the `openai` SDK's response types are sufficient

#### Ruby CSS in `@layer base`

Tailwind v4 applies its preflight reset before user-defined layers. Placing ruby rules in `@layer base` ensures they are not overridden by Tailwind's reset and that they apply globally without needing utility classes on every `<ruby>` element.

---

### Implementation Approach

Implement in this order, as each step is a prerequisite for the next:

#### Phase 1: Infrastructure Setup

1. **Install dependencies**:

   ```bash
   pnpm add openai
   pnpm add -D vitest @vitest/coverage-v8 @playwright/test
   ```

2. **Configure Vitest** in `vite.config.ts` (or a separate `vitest.config.ts`):
   - Add test configuration with `globals: true`, coverage provider `v8`, include pattern for `app/**/*.test.ts`

3. **Configure Playwright** in `playwright.config.ts`:
   - Base URL: `http://localhost:5173`
   - At minimum: Chromium browser; optionally Firefox and WebKit

4. **Add `pnpm test` and `pnpm test:e2e` scripts** to `package.json`

5. **Create `.env.example`** with `OPENAI_API_KEY=`

6. **Create `.env`** locally with a valid API key for integration testing

#### Phase 2: Parser (Build First — Zero External Dependencies)

Build and fully test `app/lib/furigana/parser.ts` before any AI integration. The parser has no dependencies beyond TypeScript itself, making it the safest starting point.

1. Define `FuriganaToken`, `TextToken`, `RubyToken` types
2. Implement `parseAnnotationString`
3. Write `app/lib/furigana/parser.test.ts` with the full edge case matrix from this document
4. Run `pnpm test` and achieve 100% line coverage before proceeding

#### Phase 3: AI Client and Prompts

1. Create `app/lib/ai/client.ts` with the `OpenAI` instance and startup validation
2. Create `app/lib/ai/prompts.ts` with `FURIGANA_SYSTEM_PROMPT` and `buildUserMessage`
3. Write a snapshot unit test for `FURIGANA_SYSTEM_PROMPT` in `app/lib/ai/prompts.test.ts`
4. Manually test the prompt against the live API in a temporary test script before wiring into the route

#### Phase 4: Route Action

1. Rewrite `app/routes/home.tsx`:
   - Define `ActionData` type (`ActionSuccess | ActionError`)
   - Implement `action()` using `app/lib/ai/client.ts` and `app/lib/furigana/parser.ts`
   - Add `try/catch` for the full AI call + parse flow
2. Write `app/routes/home.test.ts` (integration test):
   - Mock `openaiClient` with `vi.mock`
   - Test: valid AI response → parser → `ActionSuccess` return
   - Test: API error → `ActionError` return with `originalText`
   - Test: empty `text` → `ActionError` return (no AI call made)

#### Phase 5: UI Components

1. Add ruby CSS rules to `app/app.css` (verify the `@layer base` syntax for Tailwind v4's CSS-first config)
2. Build `app/components/furigana/InputArea.tsx`:
   - Controlled textarea, character counter, submit button
   - Loading and error states via props
3. Build `app/components/furigana/ReadingView.tsx`:
   - Props: `tokens: FuriganaToken[]`
   - Ruby/span rendering logic
4. Wire `InputArea` and `ReadingView` into `home.tsx` with `useActionData()` and `useNavigation()`

#### Phase 6: End-to-End Tests

1. Write Playwright tests in `e2e/home.spec.ts`:
   - Test: paste Japanese text → submit → assert `<ruby>` elements in DOM with correct `<rt>` text
   - Test: paste > 10,000 chars → assert button `disabled`
   - Test: submit empty textarea → assert no navigation, no error message
2. Run `pnpm test:e2e` against the development server

#### Phase 7: Type-Check and Pre-Commit Verification

```bash
pnpm type-check
pnpm exec eslint .
pnpm exec prettier --write .
```

All commands must pass before considering the milestone complete.

---

### Test Strategy

#### Unit Tests (Vitest)

**`app/lib/furigana/parser.test.ts`**

Required test cases (exhaustive — every case must have its own `it()` block):

```typescript
describe("parseAnnotationString", () => {
  it("parses a single kanji compound with reading");
  it("parses kanji in the middle of hiragana text");
  it("parses multiple consecutive ruby tokens");
  it("parses text with mixed kanji, hiragana, and punctuation");
  it("returns a single text token for pure hiragana input");
  it("returns a single text token for pure romaji input");
  it("returns an empty array for empty string input");
  it("handles consecutive ruby tokens with no text between them");
  it("handles unclosed opening brace — treats as text");
  it("handles nested braces — does not crash");
  it("handles empty reading braces {}");
  it("handles input that is only braces {}");
  it("handles multi-character readings");
  it("produces no HTML in token values");
});
```

Coverage target: 100% line coverage (`@vitest/coverage-v8`)

**`app/lib/ai/prompts.test.ts`**

```typescript
describe("FURIGANA_SYSTEM_PROMPT", () => {
  it("matches snapshot");
});

describe("buildUserMessage", () => {
  it("wraps the input text in the expected structure");
});
```

#### Integration Tests (Vitest with mocks)

**`app/routes/home.test.ts`**

Mock strategy: `vi.mock('~/lib/ai/client', () => ({ openaiClient: { chat: { completions: { create: vi.fn() } } } }))`

```typescript
describe("home action", () => {
  it("returns annotationString on valid AI response");
  it("returns error on AI API failure");
  it("returns error on empty text input without calling AI");
  it("calls parser with the AI response string");
  it("returns originalText in the error response");
});
```

#### End-to-End Tests (Playwright)

**`e2e/home.spec.ts`**

```typescript
test("generates furigana for valid Japanese input", async ({ page }) => {
  // Navigate, paste Japanese text, submit, assert <ruby> and <rt> in DOM
});

test("disables submit button when textarea exceeds 10000 characters", async ({ page }) => {
  // Fill textarea with 10001 chars (programmatically), assert button disabled
});

test("shows no error and no navigation for empty submission attempt", async ({ page }) => {
  // Assert button disabled on empty textarea
  // Attempt keyboard shortcut, assert no navigation
});
```

---

### Deliverables

The milestone is complete when all of the following exist and pass verification:

| Deliverable                               | Verification                                          |
| ----------------------------------------- | ----------------------------------------------------- |
| `app/lib/ai/client.ts`                    | Module imports without error; TypeScript compiles     |
| `app/lib/ai/prompts.ts`                   | Snapshot test passes                                  |
| `app/lib/furigana/parser.ts`              | 100% line coverage in Vitest                          |
| `app/lib/furigana/parser.test.ts`         | All test cases pass                                   |
| `app/components/furigana/ReadingView.tsx` | Renders `<ruby>` elements correctly in browser        |
| `app/components/furigana/InputArea.tsx`   | Counter, disable logic, loading state work correctly  |
| `app/routes/home.tsx` (rewritten)         | Integration tests pass; action correctly returns data |
| `app/app.css` (modified)                  | Ruby elements render with correct display in browser  |
| `.env.example`                            | Contains `OPENAI_API_KEY=`                            |
| `e2e/home.spec.ts`                        | All three Playwright tests pass                       |
| `pnpm type-check`                         | Zero errors                                           |
| `pnpm exec eslint .`                      | Zero errors                                           |

---

### Success Criteria

| Criterion                                                                                      | How to Verify                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Submitting a standard Japanese paragraph produces a reading view with correct ruby annotations | Browser + Playwright E2E test                                 |
| Pure hiragana or romaji input produces the reading view with no `<ruby>` elements and no crash | Browser + parser unit test for pure hiragana/romaji           |
| Malformed AI response returns an inline error without losing textarea content                  | Integration test with mocked malformed AI response            |
| Parser unit tests pass at 100% line coverage                                                   | `pnpm test --coverage`                                        |
| `pnpm type-check` passes with zero errors                                                      | `pnpm type-check`                                             |
| Submit button is disabled when textarea is empty                                               | Browser + Playwright E2E test                                 |
| Submit button is disabled when character count exceeds 10,000                                  | Browser + Playwright E2E test                                 |
| `OPENAI_API_KEY` does not appear in client bundle                                              | Browser DevTools → Network → JS bundles (grep for key prefix) |
| No `dangerouslySetInnerHTML` in furigana components                                            | Code review / ESLint rule                                     |

---

## Dependency and Conflict Analysis

### External Dependencies (Must Be Complete Before Starting)

| Dependency                                               | Status              | Notes                                                                                           |
| -------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| Node.js ≥ 22                                             | Must be installed   | Verified by `node --version`                                                                    |
| pnpm ≥ 10                                                | Must be installed   | Verified by `pnpm --version`                                                                    |
| OpenAI API key with GPT-4o-mini access                   | Must be provisioned | Pay-as-you-go billing must be enabled; rate limits are unlikely to be hit at development volume |
| `openai` npm package                                     | Must be installed   | `pnpm add openai`                                                                               |
| `vitest` and `@vitest/coverage-v8`                       | Must be installed   | `pnpm add -D vitest @vitest/coverage-v8`                                                        |
| `@playwright/test`                                       | Must be installed   | `pnpm add -D @playwright/test && pnpx playwright install`                                       |
| Existing project setup (Vite, React Router, Tailwind v4) | Already in place    | Verified by `pnpm dev` running without errors                                                   |

### Internal Dependencies (Within This Milestone)

The build order within the milestone is partially constrained:

```
parser.ts (no deps)
  ↓
parser.test.ts (depends on parser.ts)
  ↓
prompts.ts (no deps)
client.ts (no deps)
  ↓
home.tsx action (depends on parser.ts, client.ts, prompts.ts)
  ↓
home.test.ts (depends on action; mocks client.ts)
  ↓
InputArea.tsx (no hard deps)
ReadingView.tsx (depends on FuriganaToken type from parser.ts)
app.css changes (no deps)
  ↓
home.tsx component (depends on InputArea.tsx, ReadingView.tsx)
  ↓
e2e/home.spec.ts (depends on full stack running)
```

Start with `parser.ts` and its tests — this validates the core algorithm before any network calls are made.

### Downstream Impacts on Future Milestones

This milestone's design decisions constrain future milestones. Do not deviate from these contracts without updating the downstream milestone specs:

| Decision                                                            | Downstream Impact                                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `FuriganaToken[]` is the canonical data type for parsed annotations | Milestone 2 stores `annotationString` (not tokens) in Turso DB; re-parses on load. Milestone 3's `ReadingView` receives the same token array. |
| `action` returns `{ annotationString: string }`                     | Milestone 2 adds `{ entryId: string }` to this same return type — design `ActionSuccess` to be extensible                                     |
| `ReadingView` accepts `tokens: FuriganaToken[]` as its only prop    | Milestone 3 adds `viewMode: 'always' \| 'on-hover'` as a second prop — leave room for this addition                                           |
| `app/lib/ai/client.ts` exports `openaiClient`                       | Milestone 4 imports the same client for title generation                                                                                      |
| `app/lib/ai/prompts.ts` contains furigana prompt                    | Milestone 4 adds a separate title prompt to this module — design the module to export multiple named constants cleanly                        |
| Ruby CSS in `@layer base`                                           | Milestone 3 adds `[data-view-mode]` CSS rules to `app.css` — the CSS architecture is already established                                      |

### Potential Conflicts

| Conflict                                                                                | Resolution                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tailwind v4's CSS-first config (no `tailwind.config.js`) vs. adding `@layer base` rules | Tailwind v4 uses `@import "tailwindcss"` in `app.css`; `@layer base {}` blocks are valid in this context. Verify by running `pnpm dev` and inspecting computed styles on `<ruby>` elements.                                                                                                                                                                |
| `noUncheckedIndexedAccess` and array indexing in parser                                 | Use `Array.prototype.map`, `for...of`, or optional chaining — never bare `array[i]` without a bounds check                                                                                                                                                                                                                                                 |
| `exactOptionalPropertyTypes` and optional props on components                           | Define optional props as `prop?: T` and handle `undefined` explicitly; never pass `undefined` to a prop typed as `T \| undefined` without checking                                                                                                                                                                                                         |
| React controlled state initialization from `useActionData`                              | `useState` initializer runs once on mount; if action data changes without unmounting the component, use a ref to track "first error received" and call `setText` in a `useEffect` watching `actionData`. Alternatively, use a `key` prop on `InputArea` tied to a submission counter to force remount on each error. Document the chosen approach clearly. |

### Risk Areas

| Risk                                                           | Likelihood                                     | Mitigation                                                                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPT-4o-mini returns annotation string in unexpected format     | Medium                                         | Build parser to be resilient to malformed input; treat any non-empty string as worth attempting to parse; add E2E test with live API to catch prompt drift |
| Prompt instability (model behavior changes over time)          | Low (for MVP)                                  | Snapshot test on `FURIGANA_SYSTEM_PROMPT` catches accidental prompt edits; use `gpt-4o-mini` with a pinned `model` parameter                               |
| Ruby CSS rendering differences across browsers                 | Low (Chromium/Firefox/Safari all support ruby) | Playwright tests across multiple browser engines; `<rp>` fallback handles non-ruby browsers                                                                |
| TypeScript strict mode rejecting patterns from online examples | Medium                                         | All patterns in this document are written with strict mode compliance in mind; run `pnpm type-check` frequently during development                         |
| `openai` package major version mismatch with this document     | Low                                            | Pin to the installed version; check SDK docs for the installed version before writing `client.ts`                                                          |
