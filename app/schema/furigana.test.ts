import { describe, expect, it } from "vitest";

import {
  FuriganaTokenSchema,
  RubyTokenSchema,
  TextTokenSchema,
  isRubyToken,
  isTextToken,
  type FuriganaToken,
  type TextToken,
} from "./furigana";

describe("TextTokenSchema", () => {
  it("parses a valid text token", () => {
    const result = TextTokenSchema.parse({ type: "text", value: "こんにちは" });

    expect(result).toEqual({ type: "text", value: "こんにちは" });
  });

  it("allows empty string values", () => {
    const result = TextTokenSchema.parse({ type: "text", value: "" });

    expect(result).toEqual({ type: "text", value: "" });
  });

  it("rejects values containing annotation placeholders", () => {
    const result = TextTokenSchema.safeParse({
      type: "text",
      value: "日本語{にほんご}",
    });

    expect(result.success).toBe(false);
  });

  it("rejects values containing unmatched braces", () => {
    const result = TextTokenSchema.safeParse({
      type: "text",
      value: "text{",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a wrong type discriminant", () => {
    const result = TextTokenSchema.safeParse({ type: "ruby", value: "hi" });

    expect(result.success).toBe(false);
  });
});

describe("RubyTokenSchema", () => {
  it("parses a valid ruby token", () => {
    const result = RubyTokenSchema.parse({
      type: "ruby",
      kanji: "東京",
      yomi: "とうきょう",
    });

    expect(result).toEqual({
      type: "ruby",
      kanji: "東京",
      yomi: "とうきょう",
    });
  });

  it("rejects empty kanji", () => {
    const result = RubyTokenSchema.safeParse({
      type: "ruby",
      kanji: "",
      yomi: "とうきょう",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty yomi", () => {
    const result = RubyTokenSchema.safeParse({
      type: "ruby",
      kanji: "東京",
      yomi: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("FuriganaTokenSchema", () => {
  it("parses a text token through the union schema", () => {
    const result = FuriganaTokenSchema.parse({ type: "text", value: "きました" });

    expect(result).toEqual({ type: "text", value: "きました" });
  });

  it("parses a ruby token through the union schema", () => {
    const result = FuriganaTokenSchema.parse({
      type: "ruby",
      kanji: "行",
      yomi: "い",
    });

    expect(result).toEqual({ type: "ruby", kanji: "行", yomi: "い" });
  });

  it("rejects unknown type values", () => {
    const result = FuriganaTokenSchema.safeParse({
      type: "unknown",
      value: "x",
    });

    expect(result.success).toBe(false);
  });

  it("rejects values without type", () => {
    const result = FuriganaTokenSchema.safeParse({ value: "x" });

    expect(result.success).toBe(false);
  });
});

describe("type guards", () => {
  it("isTextToken narrows text tokens", () => {
    const token: FuriganaToken = { type: "text", value: "こんにちは" };

    expect(isTextToken(token)).toBe(true);
    expect(isRubyToken(token)).toBe(false);
  });

  it("isRubyToken narrows ruby tokens", () => {
    const token: FuriganaToken = {
      type: "ruby",
      kanji: "漢字",
      yomi: "かんじ",
    };

    expect(isRubyToken(token)).toBe(true);
    expect(isTextToken(token)).toBe(false);
  });
});

describe("readonly discriminant", () => {
  it("keeps TextToken.type readonly at compile time", () => {
    const token: TextToken = { type: "text", value: "hi" };

    // @ts-expect-error type is readonly and cannot be reassigned
    token.type = "ruby";

    expect(token).toBeDefined();
  });
});
