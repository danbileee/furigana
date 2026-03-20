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

import { action } from "./furigana";

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/furigana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

function makeCompletionResponse(content: string | null) {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  };
}

describe("action", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns 200 with tokens for a valid request", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletionResponse("東京{とうきょう}に行{い}きました。"));

    const response = await action(createActionArgs(createJsonRequest({ text: "東京に行きました。" })));

    expect(response.status).toBe(200);
    const json = await response.json();
    if (
      typeof json !== "object" ||
      json === null ||
      !("tokens" in json) ||
      !Array.isArray(json.tokens)
    ) {
      throw new Error("Expected a token array response.");
    }
    expect(Array.isArray(json.tokens)).toBe(true);
    expect(json.tokens.length).toBeGreaterThan(0);
    expect(json.tokens[0]?.type).toBe("ruby");
  });

  it("returns 400 for empty text and does not call AI", async () => {
    const response = await action(createActionArgs(createJsonRequest({ text: "" })));

    expect(response.status).toBe(400);
    const json = await response.json();
    if (typeof json !== "object" || json === null || !("error" in json)) {
      throw new Error("Expected an error response.");
    }
    expect(json.error).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for text longer than 10,000 and does not call AI", async () => {
    const response = await action(
      createActionArgs(createJsonRequest({ text: "あ".repeat(10_001) })),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    if (typeof json !== "object" || json === null || !("error" in json)) {
      throw new Error("Expected an error response.");
    }
    expect(json.error).toContain("10,000");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 500 with originalText when AI call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));

    const response = await action(createActionArgs(createJsonRequest({ text: "日本語" })));

    expect(response.status).toBe(500);
    const json = await response.json();
    if (
      typeof json !== "object" ||
      json === null ||
      !("error" in json) ||
      !("originalText" in json)
    ) {
      throw new Error("Expected an error response with originalText.");
    }
    expect(json.error).toBe("Something went wrong. Please try again.");
    expect(json.originalText).toBe("日本語");
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("http://localhost/api/furigana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await action(createActionArgs(request));

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 500 when API response content is null", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletionResponse(null));

    const response = await action(createActionArgs(createJsonRequest({ text: "日本語" })));

    expect(response.status).toBe(500);
  });

  it("returns 500 when choices array is empty", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });

    const response = await action(createActionArgs(createJsonRequest({ text: "日本語" })));

    expect(response.status).toBe(500);
  });

  it("accepts exactly 10,000 characters", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletionResponse("日{に}"));

    const response = await action(createActionArgs(createJsonRequest({ text: "あ".repeat(10_000) })));

    expect(response.status).toBe(200);
  });

  it("returns 400 when text field is missing", async () => {
    const response = await action(createActionArgs(createJsonRequest({})));

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
