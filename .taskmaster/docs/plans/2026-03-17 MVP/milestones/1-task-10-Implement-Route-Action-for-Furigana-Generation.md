# Task 10: Implement Route Action for Furigana Generation

**Project**: Furigana
**Generated**: 2026-03-20
**Source PRD**: `.taskmaster/docs/plans/2026-03-17 MVP/milestones/1-prd-Core Generation Loop.md`

## Overview

Create a dedicated API route at `app/routes/api/furigana.ts` that exposes a POST endpoint at `/api/furigana`. The route exports an `action` function (React Router's server-side POST handler) that reads a JSON request body, validates the submitted text, calls GPT-4o-mini via the `openaiClient` module, parses the annotation string via `parseAnnotationString`, and returns a typed JSON `Response` — either a 200 with `{ tokens: FuriganaToken[] }` on success, 400 for validation errors, or 500 for unexpected server errors.

This is a dedicated API route, not a modification to `home.tsx`. The home route's component will call this endpoint via `fetch("/api/furigana", { method: "POST", body: JSON.stringify({ text }) })` in a later task (Task 11). The type definitions for request and response bodies live in `app/routes/api/furigana.ts` and are importable by downstream routes.

The `annotationString` is an internal intermediate value that never leaves the server. Clients receive only `FuriganaToken[]`.

**Future M2 consideration**: In Milestone 2, this action will also persist the `annotationString` to Turso DB and return an `entryId` in the success response. The M1 contract (`{ tokens: FuriganaToken[] }`) is intentionally minimal to avoid coupling M1 to persistence concerns.

## Requirements Analysis

### Functional Requirements

- Register the route in `app/routes.ts` as `route("api/furigana", "routes/api/furigana.ts")`.
- Export an `async function action({ request }: Route.ActionArgs)` from `app/routes/api/furigana.ts`.
- Parse the request body as JSON: `await request.json()`.
- Validate the parsed body:
  - If JSON parsing fails (malformed JSON), return a 400 `Response` with `{ error: "...", originalText: "" }`.
  - If `text` is not a string or is absent, return a 400 `Response`.
  - If `text.length === 0`, return a 400 `Response` with message `"Please enter some text."`.
  - If `text.length > 10_000`, return a 400 `Response` with message `"Text must be 10,000 characters or fewer."`.
- Pass the raw text through `sanitize()` from `~/lib/ai/sanitize` before sending to the AI.
- Call `openaiClient.chat.completions.create` with:
  - `model: "gpt-4o-mini"`
  - `messages`: one system message using `FURIGANA_SYSTEM_PROMPT` and one user message using `buildUserMessage(sanitizedText)`.
- Extract `completion.choices[0]?.message.content` (optional chain required by `noUncheckedIndexedAccess`).
- If the content is `null`, `undefined`, or an empty string, return a 500 `Response`.
- Parse the valid content with `parseAnnotationString(content)` to produce `FuriganaToken[]`.
- On success, return a 200 `Response` with JSON body `{ tokens: FuriganaToken[] }`.
- On any thrown error (OpenAI API errors, network errors, unexpected exceptions), return a 500 `Response` with `{ error: "Something went wrong. Please try again.", originalText: text }`.
- Never expose raw API error messages to the client — all server-fault errors map to the generic message.
- Export a `Component` that returns `null` (required by React Router to register the route without rendering a UI).

**Request format:**

```
POST /api/furigana
Content-Type: application/json

{ "text": "日本語を勉強しています。" }
```

**Response format (success — 200):**

```json
{ "tokens": [{ "type": "ruby", "kanji": "日本語", "reading": "にほんご" }, ...] }
```

**Response format (validation error — 400):**

```json
{ "error": "Text must be 10,000 characters or fewer.", "originalText": "..." }
```

**Response format (server error — 500):**

```json
{ "error": "Something went wrong. Please try again.", "originalText": "..." }
```

### Non-Functional Requirements

- **TypeScript strict compliance**: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` are all active. Use `satisfies` instead of `as`. No `any`, no `as` casts.
- **Server/client boundary**: `app/routes/api/furigana.ts` is a server-only module. Its imports of `~/lib/ai/client`, `~/lib/ai/prompt`, `~/lib/ai/sanitize`, and `~/lib/furigana/parser` never appear in the client bundle. React Router framework mode treeshakes the `action` export automatically.
- **No Sentry in the action**: Observability is a future task. Do not add `captureException` here.
- **`originalText` fidelity**: In all error responses, `originalText` must be the raw pre-sanitization text value from the request body, so the client can restore the textarea without data loss.
- **Character counting**: The 10,000-character limit uses `text.length` (UTF-16 code units), consistent with the planned client-side counter in Task 11.
- **JSON parsing failure handling**: `request.json()` can throw if the body is not valid JSON. This must be caught and returned as a 400 response, not a 500.

### Dependencies & Constraints

- **Task 6 complete** — `app/lib/furigana/parser.ts` exports `parseAnnotationString(input: string): FuriganaToken[]`.
- **Task 8 complete** — `app/lib/ai/client.ts` exports `openaiClient: OpenAI`.
- **Task 9 complete** — `app/lib/ai/prompt.ts` exports `FURIGANA_SYSTEM_PROMPT: string` and `buildUserMessage(text: string): string`.
- **Sanitize module exists** — `app/lib/ai/sanitize.ts` exports `sanitize(input: string): string`.
- **`FuriganaToken` type** — imported from `~/schema/furigana`.
- **`Route.ActionArgs`** — generated by `@react-router/dev` typegen from `app/routes/+types/api/furigana.d.ts`. Run `pnpm type-check` once after adding the route registration to trigger typegen.
- **openai SDK `^6.32.0`** — non-streaming call; returns `Promise<OpenAI.Chat.ChatCompletion>`.
- **vitest `^4.1.0`** with `globals: true` — `describe`, `it`, `expect`, `beforeEach` available without import. `vi` requires explicit import.
- **`home.tsx` is not modified** — this task does not touch the home route. The action in `furigana.ts` is a separate file entirely.

## Implementation Plan

### Phase 1: Register the Route

**Objective**: Add the `/api/furigana` route to the React Router config so typegen generates `+types/api/furigana.d.ts` and the endpoint is reachable.

#### Subtask 1.1: Register route in `app/routes.ts`

- **Files to modify**: `app/routes.ts`
- **Code pattern**:

  ```typescript
  import { type RouteConfig, index, route } from "@react-router/dev/routes";

  export default [
    index("routes/home.tsx"),
    route("api/health", "routes/api/health.ts"),
    route("api/furigana", "routes/api/furigana.ts"),
  ] satisfies RouteConfig;
  ```

- **Key considerations**:
  - Follow the exact same pattern as the `api/health` route already in this file.
  - After adding the route, run `pnpm type-check` once to trigger `@react-router/dev` typegen and produce `app/routes/+types/api/furigana.d.ts`. The generated file provides `Route.ActionArgs`.
- **Acceptance criteria**:
  - `pnpm type-check` runs without errors related to missing type files.
  - `app/routes/+types/api/furigana.d.ts` exists after typegen.

### Phase 2: Define Request/Response Types

**Objective**: Establish the typed shapes for the API request body and JSON response bodies. These types are the M1 contract for the `/api/furigana` endpoint.

#### Subtask 2.1: Add type definitions to `app/routes/api/furigana.ts`

- **Files to create**: `app/routes/api/furigana.ts`
- **Code pattern**: See _Pattern 1_ in the Code Patterns section.
- **Key considerations**:
  - `FuriganaRequest` types the parsed JSON body (`{ text: string }`). This is validated at runtime; the type represents the post-validation shape.
  - `FuriganaResponse` holds `tokens: FuriganaToken[]`. This is the only data that crosses the server/client boundary. The raw `annotationString` stays on the server.
  - `FuriganaError` holds `error: string` and `originalText: string`. Both fields are always present (non-optional). With `exactOptionalPropertyTypes`, using `originalText?` when the value is always included would be incorrect.
  - These types are not exported from the route in M1 (they are internal to `furigana.ts`). If Task 11 needs to type the `fetch` response, it can import them then. For now, keep them unexported to minimize the public API surface.
  - Import `type { FuriganaToken }` using the inline type import style enforced by ESLint `consistent-type-imports`.
- **Acceptance criteria**:
  - `pnpm type-check` and `pnpm exec eslint app/routes/api/furigana.ts` pass with no errors after the type block is added.

### Phase 3: Implement the Action Function

**Objective**: Write the `action` export that orchestrates JSON parsing, validation, the AI call, annotation parsing, and error handling — all returning typed `Response` objects with appropriate HTTP status codes.

#### Subtask 3.1: Add server-side imports

- **Files to modify**: `app/routes/api/furigana.ts`
- **Key considerations**:
  - Import the generated type: `import type { Route } from "./+types/api/furigana";`
  - Import server-only modules:
    ```typescript
    import { openaiClient } from "~/lib/ai/client";
    import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompt";
    import { sanitize } from "~/lib/ai/sanitize";
    import { parseAnnotationString } from "~/lib/furigana/parser";
    import type { FuriganaToken } from "~/schema/furigana";
    ```
  - Do not add `"use server"` — React Router framework mode does not use that directive. The `action` export is automatically server-only.
- **Acceptance criteria**:
  - `pnpm exec eslint app/routes/api/furigana.ts` reports no import-related errors.

#### Subtask 3.2: Write the action body

- **Files to modify**: `app/routes/api/furigana.ts`
- **Code pattern**: See _Pattern 2_ in the Code Patterns section.
- **Key considerations**:

  **JSON body parsing**:
  - Use `await request.json()` to parse the body. This can throw if the body is malformed JSON or if the `Content-Type` is incompatible.
  - Wrap the `request.json()` call in a `try/catch`. On parse failure, return a 400 `Response` with `{ error: "Invalid JSON.", originalText: "" }`.
  - After parsing, narrow the body type: `typeof body === "object" && body !== null && "text" in body` and `typeof body.text === "string"`. This avoids `as` casts.

  **Input validation order**:
  1. JSON parse success (caught above).
  2. Body shape check (is `text` a string?).
  3. Empty check (`text.length === 0`).
  4. Length limit check (`text.length > 10_000`).
  - Return 400 for all validation failures with a descriptive `error` and the `originalText` (or `""` when the text cannot be extracted).

  **Sanitization**:
  - `sanitize(text)` strips HTML/JS injection vectors before the text reaches the AI. `originalText` in any error response always holds the pre-sanitization raw value.

  **OpenAI call**:
  - `openaiClient.chat.completions.create({ model: "gpt-4o-mini", messages: [...] })` — non-streaming, no `stream` parameter.
  - `completion.choices[0]?.message.content` — optional chain required by `noUncheckedIndexedAccess`. Result type is `string | null | undefined`.
  - If content is falsy, return a 500 `Response`.

  **Parsing**:
  - `parseAnnotationString(content)` returns `FuriganaToken[]`. The parser handles malformed annotation strings gracefully, degrading to `TextToken` entries. No additional validation needed.

  **Response construction**:
  - Use `new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })` for all responses. This is the same primitive used by React Router's `data()` helper internally, but here we need explicit status codes (400, 500) that `data()` does not set by default.
  - Do not use React Router's `data()` helper for this route — it abstracts away status code control and is designed for loader/action data that React Router itself serializes. For a pure JSON API endpoint, `new Response(...)` is the correct pattern.

  **Try/catch scope**:
  - Validation errors (empty, over-limit, invalid JSON shape) are returned before the `try` block — they are not exceptional conditions.
  - The `try` block wraps only the OpenAI call, content guard, and parser call.
  - The `catch` block returns a 500 `Response`. It does not inspect the error type.

- **Acceptance criteria**:
  - `pnpm type-check` passes with no errors.
  - `pnpm exec eslint app/routes/api/furigana.ts` passes with no errors.
  - The `home.tsx` file remains completely unmodified.

#### Subtask 3.3: Add the null Component export

- **Files to modify**: `app/routes/api/furigana.ts`
- **Key considerations**:
  - React Router requires a `Component` export (or default export) from every registered route file, even for API-only routes. Follow the same pattern as `health.ts`:
    ```typescript
    export const Component = () => null;
    ```
  - Without this export, the dev server will warn and the route may not register correctly.
- **Acceptance criteria**:
  - `pnpm dev` starts without warnings about missing component exports for this route.

### Phase 4: Write Integration Tests

**Objective**: Write `app/routes/api/furigana.test.ts` with tests that call the `action` function directly using real `Request` objects. This tests the actual HTTP boundary — status codes, JSON serialization, response shape — without spinning up a full server.

#### Subtask 4.1: Set up the test file with module mocking

- **Files to create**: `app/routes/api/furigana.test.ts`
- **Code pattern**: See _Pattern 3_ in the Code Patterns section.
- **Key considerations**:
  - Mock only `~/lib/ai/client` — the external dependency with side effects (`OPENAI_API_KEY` check at import time, network calls at runtime). All other modules (`~/lib/ai/prompt`, `~/lib/ai/sanitize`, `~/lib/furigana/parser`) are pure functions with no side effects and run as real implementations.
  - `vi.mock("~/lib/ai/client", factory)` is hoisted by Vitest's transform regardless of where it appears in source — place it immediately after the `vi` import for clarity.
  - The `action` function accepts `{ request: Request }`. Construct a helper `createJsonRequest(body: unknown): Request` that sets `Content-Type: application/json` and a JSON-serialized body.
  - Each test calls `await action({ request: createJsonRequest(...) })`, which returns a real `Response` object. Assert on `response.status` and `await response.json()`.
  - This approach validates: HTTP status codes at the boundary, JSON serialization correctness, response body shape, `Content-Type` header — things that function-return-value mocking would miss.
  - `vi` requires explicit import: `import { vi } from "vitest"`. Other globals (`describe`, `it`, `expect`, `beforeEach`) are available via `globals: true`.
  - Reset the mock in `beforeEach` with `mockCreate.mockReset()` to prevent cross-test contamination.

#### Subtask 4.2: Write the five core test cases

- **Files to modify**: `app/routes/api/furigana.test.ts`
- **Key considerations**:

  **Test 1 — Valid request returns 200 with tokens**:
  - Mock `create` to resolve with `{ choices: [{ message: { content: "東京{とうきょう}に行{い}きました。" } }] }`.
  - POST `{ text: "東京に行きました。" }`.
  - Assert `response.status === 200`.
  - Assert `(await response.json()).tokens` is an array with length > 0.
  - Assert `tokens[0].type === "ruby"`.

  **Test 2 — Empty text returns 400**:
  - POST `{ text: "" }`.
  - Assert `response.status === 400`.
  - Assert `(await response.json()).error` is defined.
  - Assert `create` was NOT called.

  **Test 3 — Over-limit text returns 400**:
  - POST `{ text: "あ".repeat(10_001) }`.
  - Assert `response.status === 400`.
  - Assert `(await response.json()).error` contains "10,000".
  - Assert `create` was NOT called.

  **Test 4 — AI error returns 500**:
  - Mock `create` to reject with `new Error("API error")`.
  - POST `{ text: "日本語" }`.
  - Assert `response.status === 500`.
  - Assert `(await response.json()).error === "Something went wrong. Please try again."`.
  - Assert `(await response.json()).originalText === "日本語"`.

  **Test 5 — Invalid JSON body returns 400**:
  - Construct a `Request` manually with `body: "invalid json"` and `Content-Type: application/json`.
  - Assert `response.status === 400`.

#### Subtask 4.3: Write additional edge-case tests

- **Files to modify**: `app/routes/api/furigana.test.ts`
- **Key considerations**:

  **Test 6 — Null API content returns 500**:
  - Mock `create` to resolve with `{ choices: [{ message: { content: null } }] }`.
  - Assert `response.status === 500`.
  - Catches missing `null` guard on `choices[0]?.message.content`.

  **Test 7 — Empty choices array returns 500**:
  - Mock `create` to resolve with `{ choices: [] }`.
  - Assert `response.status === 500`.
  - Catches missing optional-chain guard required by `noUncheckedIndexedAccess`.

  **Test 8 — Exactly 10,000 characters is accepted**:
  - Mock `create` to resolve with a valid response.
  - POST `{ text: "あ".repeat(10_000) }`.
  - Assert `response.status === 200`.
  - Validates that the boundary is `> 10_000` (exclusive), not `>= 10_000`.

  **Test 9 — Missing `text` field returns 400**:
  - POST `{}` (valid JSON, but no `text` key).
  - Assert `response.status === 400`.
  - Assert `create` was NOT called.

### Phase 5: Verify

**Objective**: Confirm the implementation is type-correct, lint-clean, and all tests pass.

#### Subtask 5.1: Type-check and lint

- **Files to check**: `app/routes.ts`, `app/routes/api/furigana.ts`, `app/routes/api/furigana.test.ts`
- **Commands**:
  ```bash
  pnpm type-check
  pnpm exec eslint app/routes/api/furigana.ts app/routes/api/furigana.test.ts
  ```
- **Acceptance criteria**: Zero type errors, zero lint errors.

#### Subtask 5.2: Run tests

- **Command**: `pnpm test app/routes/api/furigana.test.ts`
- **Acceptance criteria**: All 9 tests pass. No test isolation warnings.

#### Subtask 5.3: Full build verification

- **Command**: `pnpm build`
- **Acceptance criteria**: Build succeeds. No client-bundle leakage of server-only imports.

## Third-Party Integration Research

### openai Node SDK v6.32.0 (latest: ~v6.32.0 as of 2026-03-20)

- **Official docs**: [https://github.com/openai/openai-node](https://github.com/openai/openai-node)
- **Relevant API**: `openaiClient.chat.completions.create({ model, messages })` returns `Promise<OpenAI.Chat.ChatCompletion>`. The response content is at `completion.choices[0]?.message.content` typed as `string | null`.
- **Recent changes**: v6 introduced a restructured error hierarchy under `OpenAI.APIError`. All HTTP and network errors extend this base. The specific subclasses (`RateLimitError`, `AuthenticationError`, `APIConnectionError`, etc.) are exported from the top-level `openai` package. None of these changes affect the catch-all `try/catch` pattern used here.
- **Open issues / known bugs**: A known typing confusion when TypeScript resolves overloads for `chat.completions.create` (GitHub issue #639). The non-streaming overload (without `stream: true`) returns `Promise<ChatCompletion>` unambiguously. To avoid overload confusion, do not pass `stream` at all — the default is non-streaming.
- **Security advisories**: None found relevant to this usage pattern.
- **Performance notes**: `gpt-4o-mini` API latency is typically 1–5 seconds for short Japanese text inputs. The 10,000-character limit keeps inputs within the model's 128k token context window. No server-side timeout is implemented in M1.

### React Router v7 (installed: ^7.0.0)

- **Official docs**: [https://reactrouter.com/start/framework/actions](https://reactrouter.com/start/framework/actions)
- **Relevant API**: `action({ request }: Route.ActionArgs)` — `request` is a standard `Request` object. Unlike form-based routes, this action reads `await request.json()` instead of `await request.formData()`. The return value from a pure API route (one without a `Component` that reads `useActionData`) should be a `Response` object with explicit status codes, not a plain object.
- **API route pattern**: For dedicated API endpoints, return `new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })` rather than React Router's `data()` helper. The `data()` helper is designed for loader/action data that React Router itself serializes and deserializes for `useActionData`/`useLoaderData`; for pure HTTP API endpoints, raw `Response` objects give explicit control over status codes.
- **Framework mode note**: Server actions do not use a `"use server"` directive. React Router automatically treeshakes the `action` export from the client bundle.
- **Open issues / known bugs**: None relevant. Node.js ≥22 ships native `Request`, `FormData`, `Response`, and `fetch` — the `request.json()` method works in the Vitest Node environment without polyfills.
- **Security advisories**: None.
- **Performance notes**: None relevant to this task.

### vitest v4.1.0 (installed: ^4.1.0)

- **Official docs**: [https://vitest.dev](https://vitest.dev)
- **Relevant API**: `vi.mock(modulePath, factory)` for module mocking; `vi.fn()` for function mocks; `mockResolvedValueOnce` / `mockRejectedValueOnce` for async mock behavior. `vi.mock` calls are hoisted by Vitest's transform.
- **Integration test pattern**: Calling `action({ request })` with real `Request` objects (not mocks of the action itself) tests the complete function including JSON parsing, validation, AI call dispatch, and `Response` construction. This is the recommended approach for React Router action unit/integration testing — it requires no server startup and validates the real HTTP primitives.
- **Recent changes**: No breaking changes in `vi.mock` hoisting between v3 and v4.
- **Open issues**: None relevant.
- **Security advisories**: None.
- **Performance notes**: None.

## Code Patterns

### Pattern 1: Type Definitions

```typescript
// app/routes/api/furigana.ts

import type { FuriganaToken } from "~/schema/furigana";

type FuriganaRequest = {
  text: string;
};

type FuriganaResponse = {
  tokens: FuriganaToken[];
};

type FuriganaError = {
  error: string;
  originalText: string;
};
```

**Where to apply**: Top of `app/routes/api/furigana.ts`, immediately after imports.

**Why this pattern**:

- `FuriganaResponse` holds only `tokens` — the parsed array. The raw `annotationString` is an intermediate value that never crosses the server/client boundary. This is the M1 contract.
- `FuriganaError` has both `error` and `originalText` as required (non-optional) fields. With `exactOptionalPropertyTypes`, marking them optional when they are always present would be incorrect and confusing.
- These types are internal to the route file in M1. If Task 11 needs to type the `fetch` response, they can be exported at that point.

---

### Pattern 2: Action Function Implementation

```typescript
// app/routes/api/furigana.ts

import { openaiClient } from "~/lib/ai/client";
import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompt";
import { sanitize } from "~/lib/ai/sanitize";
import { parseAnnotationString } from "~/lib/furigana/parser";
import type { Route } from "./+types/api/furigana";
import type { FuriganaToken } from "~/schema/furigana";

const MAX_TEXT_LENGTH = 10_000;

function json(body: FuriganaResponse | FuriganaError, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  // Step 1: Parse JSON body. Wrap in try/catch — malformed JSON throws.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON.", originalText: "" }, 400);
  }

  // Step 2: Validate body shape — must be an object with a string `text` field.
  if (
    typeof body !== "object" ||
    body === null ||
    !("text" in body) ||
    typeof (body as Record<string, unknown>)["text"] !== "string"
  ) {
    return json({ error: "Invalid request body.", originalText: "" }, 400);
  }

  // Safe to narrow after the type guard above.
  const { text } = body as FuriganaRequest;

  // Step 3: Validate content.
  if (text.length === 0) {
    return json({ error: "Please enter some text.", originalText: text }, 400);
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return json(
      {
        error: `Text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.`,
        originalText: text,
      },
      400,
    );
  }

  const sanitizedText = sanitize(text);

  // Step 4: Call AI, parse, return. All exceptional errors go to the catch block.
  try {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: FURIGANA_SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(sanitizedText) },
      ],
    });

    const content = completion.choices[0]?.message.content;

    if (!content) {
      return json({ error: "Something went wrong. Please try again.", originalText: text }, 500);
    }

    const tokens = parseAnnotationString(content);

    return json({ tokens } satisfies FuriganaResponse, 200);
  } catch {
    return json({ error: "Something went wrong. Please try again.", originalText: text }, 500);
  }
}

export const Component = () => null;
```

**Where to apply**: `app/routes/api/furigana.ts` — the complete file.

**Why this pattern**:

- `json` is a small helper that DRYs up the repetitive `new Response(JSON.stringify(...), { status, headers })` calls across the multiple return sites.
- `body as Record<string, unknown>` on the `"text" in body` narrowing path is a minimal, scoped cast that satisfies `noPropertyAccessFromIndexSignature` without widening the whole body type. The subsequent destructuring into the named `FuriganaRequest` type is safe because the type guard has already confirmed the shape.
- `completion.choices[0]?.message.content` — optional chain satisfies `noUncheckedIndexedAccess`.
- `!content` handles `null`, `undefined`, and empty string in one guard.
- `satisfies FuriganaResponse` at the success return verifies shape without widening — TypeScript reports a missing field at the `satisfies` keyword, not silently.
- Validation errors (steps 2–3) are returned before the `try` block — they are not exceptional conditions and do not belong in the catch path.
- `catch {` (argumentless) is used when the error is not inspected — cleaner than `catch (err: unknown)` when `err` is discarded.
- `Component = () => null` satisfies React Router's requirement that every registered route file exports a renderable component.

---

### Pattern 3: Integration Tests (Action Called with Real Request Objects)

```typescript
// app/routes/api/furigana.test.ts

import { vi } from "vitest";

// vi.mock is hoisted above imports by Vitest. Place it here so the factory
// runs before any module that transitively imports client.ts.
vi.mock("~/lib/ai/client", () => ({
  openaiClient: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { openaiClient } from "~/lib/ai/client";
import { action } from "./furigana";

// vi.mocked() avoids the `as` cast and gives the full Mock<...> type.
const mockCreate = vi.mocked(openaiClient.chat.completions.create);

// Helper: construct a POST request with a JSON body.
function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/furigana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCompletionResponse(content: string | null) {
  return { choices: [{ message: { content } }] };
}

describe("action", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe("success path", () => {
    it("returns 200 with tokens for a valid request", async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletionResponse("東京{とうきょう}に行{い}きました。"),
      );

      const response = await action({
        request: createJsonRequest({ text: "東京に行きました。" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json.tokens)).toBe(true);
      expect(json.tokens.length).toBeGreaterThan(0);
      expect(json.tokens[0]?.type).toBe("ruby");
    });
  });

  describe("input validation — 400 responses", () => {
    it("returns 400 for empty text without calling AI", async () => {
      const response = await action({ request: createJsonRequest({ text: "" }) });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBeDefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 for text exceeding 10,000 characters without calling AI", async () => {
      const response = await action({
        request: createJsonRequest({ text: "あ".repeat(10_001) }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("10,000");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON body", async () => {
      const request = new Request("http://localhost/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await action({ request });

      expect(response.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 when text field is missing from body", async () => {
      const response = await action({ request: createJsonRequest({}) });

      expect(response.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("accepts exactly 10,000 characters (inclusive boundary)", async () => {
      mockCreate.mockResolvedValueOnce(makeCompletionResponse("あ".repeat(10_000)));

      const response = await action({
        request: createJsonRequest({ text: "あ".repeat(10_000) }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("server errors — 500 responses", () => {
    it("returns 500 with originalText when AI call throws", async () => {
      mockCreate.mockRejectedValueOnce(new Error("API error"));

      const response = await action({ request: createJsonRequest({ text: "日本語" }) });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Something went wrong. Please try again.");
      expect(json.originalText).toBe("日本語");
    });

    it("returns 500 when API response content is null", async () => {
      mockCreate.mockResolvedValueOnce(makeCompletionResponse(null));

      const response = await action({ request: createJsonRequest({ text: "日本語" }) });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.originalText).toBe("日本語");
    });

    it("returns 500 when choices array is empty", async () => {
      mockCreate.mockResolvedValueOnce({ choices: [] });

      const response = await action({ request: createJsonRequest({ text: "日本語" }) });

      expect(response.status).toBe(500);
    });
  });
});
```

**Where to apply**: `app/routes/api/furigana.test.ts`.

**Why this pattern**:

- Tests call `action({ request })` with a real `Request` object. The return value is a real `Response`. Asserting `response.status` and `await response.json()` validates the complete HTTP boundary — status codes, JSON serialization, body shape, and `Content-Type` header.
- This approach catches bugs that return-value mocking would miss: a missing `Content-Type` header, incorrect status code on the validation branch, a `Response` body that cannot be parsed as JSON, or a missing field in the error body shape.
- `vi.mocked(openaiClient.chat.completions.create)` is preferred over `as ReturnType<typeof vi.fn>` — it is the official Vitest API for narrowing a mock to its `Mock<...>` type without an `as` cast.
- `~/lib/ai/prompt`, `~/lib/ai/sanitize`, and `~/lib/furigana/parser` are not mocked — they run as real implementations. Test failures in these utilities will surface here, pointing to the action's orchestration logic.
- `makeCompletionResponse` and `createJsonRequest` are local factory helpers that keep each test body minimal and readable.
- `mockCreate.mockReset()` in `beforeEach` clears call counts and configured return values between tests, preventing cross-test contamination.

---

### Pattern 4: Client-Side Fetch Call (for Task 11 reference)

```typescript
// app/routes/home.tsx (Task 11 — InputArea implementation)
// This pattern shows how home.tsx will call the furigana endpoint.
// It is NOT implemented in Task 10.

async function generateFurigana(text: string): Promise<FuriganaApiResponse> {
  const response = await fetch("/api/furigana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const json = await response.json();

  if (!response.ok) {
    // json is FuriganaError
    return { ok: false, error: json.error, originalText: json.originalText };
  }

  // json is FuriganaResponse
  return { ok: true, tokens: json.tokens };
}
```

**Where to apply**: This is a reference pattern for Task 11. Do not implement it in Task 10.

**Why this pattern**:

- `fetch("/api/furigana", ...)` uses the relative URL so it works in both dev (`localhost:5173`) and production without hardcoding the origin.
- The response is checked via `response.ok` (status 200–299) rather than trying to discriminate the JSON body shape. This is more robust against unexpected status codes.
- `originalText` from the error response allows the InputArea component to restore the textarea value after a failed generation.

## Test Cases

### Integration Tests

#### Test Suite: `action` (`app/routes/api/furigana.test.ts`)

**Test 1**: Valid request returns 200 with parsed tokens

- **Given**: `openaiClient.chat.completions.create` resolves with content `"東京{とうきょう}に行{い}きました。"`
- **When**: `action` is called with a POST request containing `{ text: "東京に行きました。" }`
- **Then**: `response.status === 200`; `(await response.json()).tokens` is an array with `tokens[0].type === "ruby"`
- **Coverage**: Detects regressions where the action returns the raw annotation string instead of parsed tokens, where the parser is not called, or where the response status is incorrect on the success path

**Test 2**: Empty text returns 400, AI not called

- **Given**: A POST request with `{ text: "" }`
- **When**: `action` is invoked
- **Then**: `response.status === 400`; `json.error` is defined; `mockCreate` call count is 0
- **Coverage**: Detects removal of the empty-input guard or an accidental AI call on empty input

**Test 3**: Over-limit text (10,001 chars) returns 400, AI not called

- **Given**: A POST request with `{ text: "あ".repeat(10_001) }`
- **When**: `action` is invoked
- **Then**: `response.status === 400`; `json.error` contains "10,000"; `mockCreate` call count is 0
- **Coverage**: Detects removal of the length-limit guard or an off-by-one in the comparison (`>=` vs `>`)

**Test 4**: AI error returns 500 with originalText

- **Given**: `openaiClient.chat.completions.create` rejects with `new Error("API error")`; POST body is `{ text: "日本語" }`
- **When**: `action` is invoked
- **Then**: `response.status === 500`; `json.error === "Something went wrong. Please try again."`; `json.originalText === "日本語"`
- **Coverage**: Detects a missing `try/catch` block, a bug where `originalText` is set to the sanitized value, or a missing 500 status code on the catch path

**Test 5**: Invalid JSON body returns 400

- **Given**: A POST request with body `"invalid json"` and `Content-Type: application/json`
- **When**: `action` is invoked
- **Then**: `response.status === 400`; `mockCreate` not called
- **Coverage**: Detects missing `try/catch` around `request.json()` — if unhandled, a thrown JSON parse error would propagate as an unhandled rejection

**Test 6**: Null API content returns 500

- **Given**: `create` resolves with `{ choices: [{ message: { content: null } }] }`
- **When**: `action` is invoked with valid text
- **Then**: `response.status === 500`; `json.originalText` is defined
- **Coverage**: Detects missing `null` guard on `completion.choices[0]?.message.content`

**Test 7**: Empty choices array returns 500

- **Given**: `create` resolves with `{ choices: [] }`
- **When**: `action` is invoked with valid text
- **Then**: `response.status === 500`
- **Coverage**: Detects missing optional-chain guard (`choices[0]?.message`) required by `noUncheckedIndexedAccess`

**Test 8**: Exactly 10,000 characters is accepted (boundary)

- **Given**: `create` resolves with a valid response; POST body is `{ text: "あ".repeat(10_000) }`
- **When**: `action` is invoked
- **Then**: `response.status === 200`
- **Coverage**: Detects an off-by-one where the guard incorrectly uses `>= 10_000` instead of `> 10_000`

**Test 9**: Missing `text` field returns 400

- **Given**: A POST request with body `{}` (valid JSON, no `text` key)
- **When**: `action` is invoked
- **Then**: `response.status === 400`; `mockCreate` not called
- **Coverage**: Detects missing body shape validation — without this guard, a `TypeError` on `text.length` would propagate instead of returning a clean 400

### Unit Tests

No separate unit tests are introduced in this task. The integration tests (calling `action` with real `Request` objects) cover the full function including validation, AI dispatch, parsing, and response construction. These tests run entirely within Vitest's Node environment without server startup and are fast enough to serve as the primary test suite for this route.

### E2E Tests (deferred)

E2E testing of the full generation flow (browser form submission → `/api/furigana` → `<ruby>` rendering) belongs to Task 15 or a later milestone once the InputArea (Task 11) and ReadingView (Task 12) components exist. At that point, a Playwright test can:

- Start the dev server with `pnpm dev`
- Submit text via the InputArea form
- Assert that ruby annotations appear in the ReadingView

This is out of scope for Task 10.

## Implementation Checklist

- [x] Phase 1: Add `route("api/furigana", "routes/api/furigana.ts")` to `app/routes.ts`
- [x] Phase 1: Run `pnpm type-check` to trigger typegen for `+types/api/furigana.d.ts`
- [x] Phase 2: Create `app/routes/api/furigana.ts` with `FuriganaRequest`, `FuriganaResponse`, `FuriganaError` type definitions
- [x] Phase 2: Import `type { FuriganaToken }` from `~/schema/furigana`
- [x] Phase 3: Add server-only imports (`openaiClient`, `FURIGANA_SYSTEM_PROMPT`, `buildUserMessage`, `sanitize`, `parseAnnotationString`)
- [x] Phase 3: Add `import type { Route } from "./+types/api/furigana"`
- [x] Phase 3: Implement `json` helper function
- [x] Phase 3: Implement `export async function action({ request }: Route.ActionArgs): Promise<Response>`
- [x] Phase 3: JSON body parse with `try/catch` returning 400 on parse failure
- [x] Phase 3: Body shape validation (object with string `text` field) returning 400
- [x] Phase 3: Empty-input validation returning 400
- [x] Phase 3: Over-limit validation (`> 10_000`) returning 400
- [x] Phase 3: `sanitize(text)` called before AI invocation
- [x] Phase 3: `openaiClient.chat.completions.create` called with `gpt-4o-mini`, system + user messages
- [x] Phase 3: Optional-chain guard on `choices[0]?.message.content`
- [x] Phase 3: `!content` guard returning 500
- [x] Phase 3: `parseAnnotationString(content)` called on valid content
- [x] Phase 3: Success path returns `json({ tokens } satisfies FuriganaResponse, 200)`
- [x] Phase 3: `try/catch` wraps AI call and parse; `catch` returns 500
- [x] Phase 3: Add `export const Component = () => null`
- [x] Phase 4: Create `app/routes/api/furigana.test.ts`
- [x] Phase 4: `vi.mock("~/lib/ai/client", ...)` with `create: vi.fn()` factory
- [x] Phase 4: `createJsonRequest` and `makeCompletionResponse` helpers
- [x] Phase 4: Test 1 — valid request returns 200 with tokens
- [x] Phase 4: Test 2 — empty text returns 400, AI not called
- [x] Phase 4: Test 3 — over-limit text returns 400, AI not called
- [x] Phase 4: Test 4 — AI error returns 500 with originalText
- [x] Phase 4: Test 5 — invalid JSON returns 400
- [x] Phase 4: Test 6 — null API content returns 500
- [x] Phase 4: Test 7 — empty choices array returns 500
- [x] Phase 4: Test 8 — exactly 10,000 chars accepted (boundary)
- [x] Phase 4: Test 9 — missing `text` field returns 400
- [x] Phase 5: `pnpm type-check` passes with zero errors
- [x] Phase 5: `pnpm exec eslint app/routes/api/furigana.ts app/routes/api/furigana.test.ts` passes
- [x] Phase 5: `pnpm test app/routes/api/furigana.test.ts` — all 9 tests pass
- [x] Phase 5: `pnpm build` succeeds with no client-bundle errors

## Notes & Considerations

**Why a dedicated API route instead of an action in `home.tsx`**

The original plan placed the `action` export directly in `home.tsx`. The architectural reason to use a dedicated `app/routes/api/furigana.ts` instead:

1. **Separation of concerns**: `home.tsx` is a page route that owns its component tree. Adding a JSON API handler to it conflates page rendering with API logic.
2. **Explicit HTTP boundary**: A dedicated API route returns `Response` objects with explicit status codes (200, 400, 500). A page action returns plain objects consumed by `useActionData` — React Router serializes these transparently, hiding status codes from the developer.
3. **Client flexibility**: The InputArea component (Task 11) calls this endpoint via `fetch("/api/furigana", ...)`, not via a `<Form>` submission. A page action requires `<Form>` or `useFetcher`; a plain `fetch` call against a dedicated API route has no such constraint.
4. **M2 extensibility**: In Milestone 2, this endpoint will also persist to Turso DB. Keeping that logic in a dedicated route makes it easier to add the DB call without entangling it with page rendering concerns.

**`annotationString` vs `tokens` in the response**

The `annotationString` is an internal intermediate value: GPT-4o-mini returns it, `parseAnnotationString` processes it, and `FuriganaToken[]` crosses the wire. The annotation string never appears in the `Response` body. This is the M1 contract: `{ tokens: FuriganaToken[] }`. In M2, `annotationString` will be persisted to the DB (for re-parsing on history load) but still not returned to the client.

**Body shape narrowing without `as` casts**

Parsing `request.json()` returns `unknown`. Narrowing it to `FuriganaRequest` requires:

1. `typeof body !== "object" || body === null` — rules out primitives and null.
2. `!("text" in body)` — rules out objects without the `text` key.
3. `typeof (body as Record<string, unknown>)["text"] !== "string"` — rules out non-string values.

The single `as Record<string, unknown>` cast in step 3 is scoped to the type-check expression only. It is accepted because: (a) the preceding `typeof body !== "object"` guard has already narrowed `body` to `object`, making `Record<string, unknown>` a sound widening; and (b) `noPropertyAccessFromIndexSignature` requires an explicit index signature to access `body["text"]`, which `Record<string, unknown>` satisfies. The cast is not widening an incorrect type — it is satisfying the compiler's index-access rule on an already-narrowed value.

**`vi.mocked()` vs `as ReturnType<typeof vi.fn>`**

The previous plan used `as ReturnType<typeof vi.fn>` to narrow the mock type. `vi.mocked()` is the official Vitest API for this purpose and avoids the `as` cast entirely. Use `vi.mocked(openaiClient.chat.completions.create)` to get the full `MockedFunction<...>` type with `.mockResolvedValueOnce`, `.mockReset()`, etc.

**`home.tsx` is completely unmodified**

Task 10 does not touch `home.tsx` at all. The existing `clientLoader`, `Home` component, and placeholder UI remain intact through Tasks 10 and are replaced in Tasks 11 (InputArea) and 12 (ReadingView).

**Verification commands**

```bash
# Register route and trigger typegen
pnpm type-check

# Lint
pnpm exec eslint app/routes/api/furigana.ts app/routes/api/furigana.test.ts

# Run integration tests
pnpm test app/routes/api/furigana.test.ts

# Full build
pnpm build
```
