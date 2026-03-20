import { vi } from "vitest";
import { MAX_INPUT_LENGTH } from "~/constants/input";
import type { FuriganaToken } from "~/schema/furigana";

const { mockGenerateFurigana } = vi.hoisted(() => ({
  mockGenerateFurigana: vi.fn(),
}));

vi.mock("~/services/furigana", () => ({
  generateFurigana: mockGenerateFurigana,
}));

import { action } from "./home";

function createFormRequest(text: string): Request {
  const formData = new FormData();
  formData.set("text", text);
  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
  });
}

function createActionArgs(request: Request): Parameters<typeof action>[0] {
  return {
    request,
    params: {},
    context: {},
    unstable_pattern: "",
  };
}

describe("home action", () => {
  beforeEach(() => {
    mockGenerateFurigana.mockReset();
  });

  it("returns tokens for valid input", async () => {
    const tokens: FuriganaToken[] = [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }];
    mockGenerateFurigana.mockResolvedValueOnce(tokens);

    const result = await action(createActionArgs(createFormRequest("日本語")));

    expect(result).toEqual({ tokens });
    expect(mockGenerateFurigana).toHaveBeenCalledWith("日本語");
  });

  it("returns an error for empty text", async () => {
    const result = await action(createActionArgs(createFormRequest("")));

    expect(result).toEqual({
      error: "Please enter some Japanese text.",
      originalText: "",
    });
    expect(mockGenerateFurigana).not.toHaveBeenCalled();
  });

  it("returns an error for over-limit text", async () => {
    const overLimitText = "あ".repeat(MAX_INPUT_LENGTH + 1);
    const result = await action(createActionArgs(createFormRequest(overLimitText)));

    expect(result).toEqual({
      error: `Text exceeds ${MAX_INPUT_LENGTH.toLocaleString()} character limit.`,
      originalText: overLimitText,
    });
    expect(mockGenerateFurigana).not.toHaveBeenCalled();
  });

  it("returns a generic error when service throws", async () => {
    mockGenerateFurigana.mockRejectedValueOnce(new Error("OpenAI failed"));

    const result = await action(createActionArgs(createFormRequest("日本語")));

    expect(result).toEqual({
      error: "Something went wrong. Please try again.",
      originalText: "日本語",
    });
  });
});
