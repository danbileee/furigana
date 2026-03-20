import { NON_JAPANESE_INPUT_ERROR } from "~/constants/furigana.const";
import { MAX_INPUT_LENGTH } from "~/constants/input.const";

const KANJI_CHARACTER_PATTERN = /[\p{Script=Han}々〆ヵヶ]/u;

/**
 * Validates that the input includes at least one Kanji character.
 * Mixed-language input is allowed when it contains Kanji.
 */
export function validateJapaneseInput(input: string): string | undefined {
  if (input.length === 0) {
    return "Please enter some Japanese text.";
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return `Text exceeds ${MAX_INPUT_LENGTH.toLocaleString()} character limit.`;
  }

  const nonWhitespaceLength = input.replace(/\s/gu, "").length;

  if (nonWhitespaceLength === 0) {
    return "Please enter some Japanese text.";
  }

  const hasKanji = KANJI_CHARACTER_PATTERN.test(input);

  if (!hasKanji) {
    return NON_JAPANESE_INPUT_ERROR;
  }

  return undefined;
}
