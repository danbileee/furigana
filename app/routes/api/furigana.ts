import { openaiClient } from "~/lib/ai/client";
import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompt";
import { sanitize } from "~/lib/ai/sanitize";
import { parseAnnotationString } from "~/lib/furigana/parser";
import type { FuriganaToken } from "~/schema/furigana";
import type { Route } from "./+types/furigana";

const MAX_TEXT_LENGTH = 10_000;
const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";

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

function json(body: FuriganaResponse | FuriganaError, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isFuriganaRequest(body: unknown): body is FuriganaRequest {
  if (typeof body !== "object" || body === null || !("text" in body)) {
    return false;
  }

  return typeof body.text === "string";
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON.", originalText: "" }, 400);
  }

  if (!isFuriganaRequest(body)) {
    return json({ error: "Invalid request body.", originalText: "" }, 400);
  }

  const { text } = body;

  if (text.length === 0) {
    return json({ error: "Please enter some text.", originalText: text }, 400);
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return json(
      {
        error: "Text must be 10,000 characters or fewer.",
        originalText: text,
      },
      400,
    );
  }

  const sanitizedText = sanitize(text);

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
      return json({ error: GENERIC_SERVER_ERROR, originalText: text }, 500);
    }

    const tokens = parseAnnotationString(content);

    return json({ tokens } satisfies FuriganaResponse, 200);
  } catch {
    return json({ error: GENERIC_SERVER_ERROR, originalText: text }, 500);
  }
}

export const Component = () => null;
