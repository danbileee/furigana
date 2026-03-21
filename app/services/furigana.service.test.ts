import { vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("~/lib/ai/client", () => ({
  openaiClient: {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  },
}));

import { GENERATION_INAVAILABLE_ERROR } from "~/constants/furigana.const";
import { generateFurigana } from "./furigana.service";

describe("generateFurigana", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("calls OpenAI and returns parsed tokens", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "日本語{にほんご}を勉強{べんきょう}しています",
          },
        },
      ],
    });

    const tokens = await generateFurigana("日本語を勉強しています");

    expect(tokens).toEqual([
      { type: "ruby", kanji: "日本語", yomi: "にほんご" },
      { type: "text", value: "を" },
      { type: "ruby", kanji: "勉強", yomi: "べんきょう" },
      { type: "text", value: "しています" },
    ]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("throws when AI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });

    await expect(generateFurigana("日本語")).rejects.toThrow(GENERATION_INAVAILABLE_ERROR);
  });

  it("propagates API errors", async () => {
    const expectedError = new Error("API error");
    mockCreate.mockRejectedValueOnce(expectedError);

    await expect(generateFurigana("日本語")).rejects.toThrow("API error");
  });
});
