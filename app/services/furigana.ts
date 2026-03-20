import { openaiClient } from "~/lib/ai/client";
import { FURIGANA_SYSTEM_PROMPT, buildUserMessage } from "~/lib/ai/prompt";
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
  if (annotationString.length === 0) {
    throw new Error("Empty response from AI");
  }

  return parseAnnotationString(annotationString);
}
