import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FuriganaToken } from "~/schema/furigana.schema";

const { mockConsumeTokens } = vi.hoisted(() => ({
  mockConsumeTokens: vi.fn<(id: string) => FuriganaToken[] | null>(),
}));

vi.mock("~/services/token-storage.service", () => ({
  consumeTokens: mockConsumeTokens,
}));

import { loader } from "./furigana.$id";

function createLoaderArgs(id: string): Parameters<typeof loader>[0] {
  return {
    params: { id },
    request: new Request(`http://localhost/furigana/${id}`),
    context: {},
    unstable_pattern: "",
  };
}

describe("furigana loader", () => {
  beforeEach(() => {
    mockConsumeTokens.mockReset();
  });

  it("returns tokens from in-memory store for matching id", async () => {
    const tokens: FuriganaToken[] = [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }];
    mockConsumeTokens.mockReturnValueOnce(tokens);

    const result = await loader(createLoaderArgs("test-uuid"));

    expect(result.data).toEqual({ tokens });
    expect(mockConsumeTokens).toHaveBeenCalledWith("test-uuid");
  });

  it("returns empty tokens when store miss occurs", async () => {
    mockConsumeTokens.mockReturnValueOnce(null);

    const result = await loader(createLoaderArgs("expired-uuid"));

    expect(result.data).toEqual({ tokens: [] });
    expect(mockConsumeTokens).toHaveBeenCalledWith("expired-uuid");
  });

  it("always attempts consumeTokens using params.id", async () => {
    mockConsumeTokens.mockReturnValueOnce(null);
    const result = await loader(createLoaderArgs("test-uuid"));

    expect(result.data).toEqual({ tokens: [] });
    expect(mockConsumeTokens).toHaveBeenCalledWith("test-uuid");
  });
});
