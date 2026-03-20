import { NON_JAPANESE_INPUT_ERROR } from "~/constants/furigana.const";
import { MAX_INPUT_LENGTH } from "~/constants/input.const";
import { validateJapaneseInput } from "./validate";

describe("validateJapaneseInput", () => {
  it("rejects non-Japanese input", () => {
    expect(validateJapaneseInput("This is an English paragraph only.")).toBe(
      NON_JAPANESE_INPUT_ERROR,
    );
  });

  it("allows mixed input with at least one kanji", () => {
    expect(validateJapaneseInput("I studied a lot today. 東京に行きました。")).toBe(undefined);
  });

  it("rejects kana-only input", () => {
    expect(validateJapaneseInput("こんにちは、げんきですか。")).toBe(NON_JAPANESE_INPUT_ERROR);
  });

  it("rejects mixed input when it contains no kanji", () => {
    expect(validateJapaneseInput("The weather is nice today and I know にほんご.")).toBe(
      NON_JAPANESE_INPUT_ERROR,
    );
  });

  it("rejects input over max character limit", () => {
    const overLimitText = "漢".repeat(MAX_INPUT_LENGTH + 1);

    expect(validateJapaneseInput(overLimitText)).toBe(
      `Text exceeds ${MAX_INPUT_LENGTH.toLocaleString()} character limit.`,
    );
  });

  it("allows input at max character limit", () => {
    const maxLengthText = "漢".repeat(MAX_INPUT_LENGTH);

    expect(validateJapaneseInput(maxLengthText)).toBe(undefined);
  });
});
