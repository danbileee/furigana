// Server-only — furigana generation
import { openaiClient } from "~/lib/ai/client";
import { sanitizeUserInput } from "~/lib/furigana/sanitize";
import { parseAnnotationString } from "~/lib/furigana/parse";
import type { FuriganaToken } from "~/schema/furigana.schema";
import { GENERATION_INAVAILABLE_ERROR } from "~/constants/furigana.const";

/**
 * System prompt for GPT-4o-mini furigana annotation.
 * Instructs the model to wrap every kanji compound with its hiragana reading
 * in the format: 漢字{よみ}
 */
const FURIGANA_SYSTEM_PROMPT = `You are a Japanese language assistant that adds furigana readings to kanji.

Your task:
1. Annotate every kanji compound with its hiragana reading in the format: 漢字{よみ}
2. Return ONLY the annotated string - no explanations, no markdown, no surrounding quotes
3. Non-kanji characters (hiragana, katakana, punctuation, numbers, latin) pass through unchanged

STRICT RULES:
- EVERY kanji MUST BE annotated
- NEVER skip any kanji
- NEVER use parentheses ()
- ONLY use curly braces {}
- DO NOT add any explanations or labels like "Output:"

Examples:

Input: 日本語を勉強しています。
Output: 日本語{にほんご}を勉強{べんきょう}しています。

Input: 東京に行きました。
Output: 東京{とうきょう}に行{い}きました。

Input: こんにちは！元気ですか？
Output: こんにちは！元気{げんき}ですか？

Input: 今日は2024年1月1日です。
Output: 今日{きょう}は2024年{ねん}1月{がつ}1日{にち}です。

Invalid example:
Input: 日本語
Output: 日本語(にほんご) ❌`;

/**
 * Builds the user message for the furigana generation request.
 *
 * Currently a pass-through. M4 will add text normalization here
 * without changing the generation action call-site.
 *
 * @param text - The sanitized Japanese text to annotate
 */
function buildUserMessage(text: string): string {
  return text;
}

/**
 * Generates furigana annotations for a given Japanese text.
 *
 * @param text - The Japanese text to annotate
 * @returns The furigana annotations
 */
export async function generateFurigana(text: string): Promise<FuriganaToken[]> {
  const sanitized = sanitizeUserInput(text);

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: FURIGANA_SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(sanitized) },
    ],
    temperature: 0.2,
    max_tokens: sanitized.length * 3,
  });

  const annotationString = completion.choices[0]?.message?.content ?? "";

  if (annotationString.length === 0) {
    throw new Error(GENERATION_INAVAILABLE_ERROR);
  }

  return parseAnnotationString(annotationString);
}
