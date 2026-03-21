import { vi } from "vitest";
import { MAX_INPUT_LENGTH } from "~/constants/input.const";
import type { FuriganaToken } from "~/schema/furigana.schema";
import { NON_JAPANESE_INPUT_ERROR } from "~/constants/furigana.const";

const { mockGenerateFurigana } = vi.hoisted(() => ({
  mockGenerateFurigana: vi.fn(),
}));

const { mockSetTokens } = vi.hoisted(() => ({
  mockSetTokens: vi.fn<(id: string, tokens: FuriganaToken[]) => void>(),
}));

vi.mock("~/services/furigana.service", () => ({
  generateFurigana: mockGenerateFurigana,
}));

vi.mock("~/services/token-storage.service", () => ({
  setTokens: mockSetTokens,
}));

import { action } from "./home";

function createFormRequestWithData(formData: FormData): Request {
  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
  });
}

function createFormRequest(text: string): Request {
  const formData = new FormData();
  formData.set("text", text);
  return createFormRequestWithData(formData);
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
    mockSetTokens.mockReset();
  });

  it("redirects to /furigana/<uuid>?storage=in-memory on successful generation", async () => {
    const tokens: FuriganaToken[] = [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }];
    mockGenerateFurigana.mockResolvedValueOnce(tokens);
    const testUuid = "123e4567-e89b-12d3-a456-426614174000";

    const randomUUIDSpy = vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(testUuid);

    const result = await action(createActionArgs(createFormRequest("日本語")));

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      throw new Error("Expected action to return a redirect response.");
    }
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe(`/furigana/${testUuid}?storage=in-memory`);
    expect(mockGenerateFurigana).toHaveBeenCalledWith("日本語");
    expect(mockSetTokens).toHaveBeenCalledWith(testUuid, tokens);
    randomUUIDSpy.mockRestore();
  });

  it("trims whitespace and forwards sanitized text to service", async () => {
    const tokens: FuriganaToken[] = [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }];
    mockGenerateFurigana.mockResolvedValueOnce(tokens);

    const rawInput = " 日本語 ";
    await action(createActionArgs(createFormRequest(rawInput)));

    expect(mockGenerateFurigana).toHaveBeenCalledWith("日本語");
  });

  it("returns an error for empty text after trimming", async () => {
    const result = await action(createActionArgs(createFormRequest("   ")));

    expect(result).toEqual({
      error: "Please enter some Japanese text.",
      originalText: "",
    });
    expect(mockGenerateFurigana).not.toHaveBeenCalled();
  });

  it("returns an error when input has no meaningful Japanese content", async () => {
    const input = "This is an English paragraph only.";

    const result = await action(createActionArgs(createFormRequest(input)));

    expect(result).toEqual({
      error: NON_JAPANESE_INPUT_ERROR,
      originalText: input,
    });
    expect(mockGenerateFurigana).not.toHaveBeenCalled();
  });

  it("returns an error for over-limit text", async () => {
    const overLimitText = "漢".repeat(MAX_INPUT_LENGTH + 1);
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

  it("returns non-Japanese error when service throws validation error", async () => {
    mockGenerateFurigana.mockRejectedValueOnce(new Error(NON_JAPANESE_INPUT_ERROR));

    const result = await action(createActionArgs(createFormRequest("hello and 日本語")));

    expect(result).toEqual({
      error: "Something went wrong. Please try again.",
      originalText: "hello and 日本語",
    });
  });

  it("returns an error when text field is missing", async () => {
    const formData = new FormData();
    const result = await action(createActionArgs(createFormRequestWithData(formData)));

    expect(result).toEqual({
      error: "Please enter some Japanese text.",
      originalText: "",
    });
    expect(mockGenerateFurigana).not.toHaveBeenCalled();
  });

  it("returns an error when text field is not a string", async () => {
    const formData = new FormData();
    formData.set("text", new File(["dummy"], "dummy.txt", { type: "text/plain" }));

    const result = await action(createActionArgs(createFormRequestWithData(formData)));

    expect(result).toEqual({
      error: NON_JAPANESE_INPUT_ERROR,
      originalText: "[object File]",
    });
    expect(mockGenerateFurigana).not.toHaveBeenCalled();
  });

  it("sanitizes potentially unsafe tags before validation and generation", async () => {
    const tokens: FuriganaToken[] = [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }];
    mockGenerateFurigana.mockResolvedValueOnce(tokens);

    await action(createActionArgs(createFormRequest("<script>日本語</script>")));

    expect(mockGenerateFurigana).toHaveBeenCalledWith("日本語");
  });
});
