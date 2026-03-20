// Server-only — prompt configuration for furigana generation

/**
 * System prompt for GPT-4o-mini furigana annotation.
 * Instructs the model to wrap every kanji compound with its hiragana reading
 * in the format: 漢字{よみ}
 *
 * Few-shot examples lock in the expected output format and cover:
 * - compound kanji (日本語, 勉強, 東京)
 * - consecutive kanji with trailing non-kanji (行きました)
 * - mixed non-kanji + kanji content (こんにちは！元気ですか？)
 * - mixed content with numbers (2024年1月1日)
 */
export const FURIGANA_SYSTEM_PROMPT = `You are a Japanese language assistant that adds furigana readings to kanji.

Your task:
1. Annotate every kanji compound with its hiragana reading in the format: 漢字{よみ}
2. Return ONLY the annotated string - no explanations, no markdown, no surrounding quotes
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
 * without changing the generation action call-site.
 *
 * @param text - The sanitized Japanese text to annotate
 */
export function buildUserMessage(text: string): string {
  return text;
}
