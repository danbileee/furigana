import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FuriganaToken } from "~/schema/furigana.schema";

async function loadTokenStorageModule() {
  return import("./token-storage.service");
}

describe("token-storage service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("stores tokens and returns them when consumed", async () => {
    const { setTokens, consumeTokens } = await loadTokenStorageModule();
    const tokens: FuriganaToken[] = [
      { type: "ruby", kanji: "日本語", yomi: "にほんご" },
      { type: "text", value: "を勉強しています。" },
    ];

    const id = "test-id-roundtrip";
    setTokens(id, tokens);
    const consumed = consumeTokens(id);

    expect(consumed).toEqual(tokens);
  });

  it("returns stored tokens via getTokens without consuming them", async () => {
    const { setTokens, getTokens, consumeTokens } = await loadTokenStorageModule();
    const tokens: FuriganaToken[] = [{ type: "text", value: "読みます" }];
    const id = "test-id-get";

    setTokens(id, tokens);
    const peeked = getTokens(id);
    const consumed = consumeTokens(id);

    expect(peeked).toEqual(tokens);
    expect(consumed).toEqual(tokens);
  });

  it("getTokens returns null for an unknown id", async () => {
    const { getTokens } = await loadTokenStorageModule();

    expect(getTokens("missing-id")).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    const { consumeTokens } = await loadTokenStorageModule();

    expect(consumeTokens("nonexistent-id")).toBeNull();
  });

  it("returns null on miss without deleting other stored entries", async () => {
    const { setTokens, consumeTokens } = await loadTokenStorageModule();
    const existingTokens: FuriganaToken[] = [{ type: "text", value: "残るデータ" }];
    setTokens("existing-id", existingTokens);

    const missResult = consumeTokens("missing-id");
    const existingResult = consumeTokens("existing-id");

    expect(missResult).toBeNull();
    expect(existingResult).toEqual(existingTokens);
  });

  it("consumes entries only once", async () => {
    const { setTokens, consumeTokens } = await loadTokenStorageModule();
    const tokens: FuriganaToken[] = [{ type: "text", value: "こんにちは" }];
    const id = "test-id-once";
    setTokens(id, tokens);

    const first = consumeTokens(id);
    const second = consumeTokens(id);

    expect(first).toEqual(tokens);
    expect(second).toBeNull();
  });

  it("keeps entries isolated across different ids", async () => {
    const { setTokens, consumeTokens } = await loadTokenStorageModule();
    const tokensA: FuriganaToken[] = [{ type: "text", value: "A" }];
    const tokensB: FuriganaToken[] = [{ type: "ruby", kanji: "山", yomi: "やま" }];

    const idA = "test-id-A";
    const idB = "test-id-B";
    setTokens(idA, tokensA);
    setTokens(idB, tokensB);

    expect(consumeTokens(idA)).toEqual(tokensA);
    expect(consumeTokens(idB)).toEqual(tokensB);
  });
});
