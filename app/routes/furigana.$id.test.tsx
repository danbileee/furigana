// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FuriganaToken } from "../schema/furigana.schema";

const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn<() => { tokens: FuriganaToken[] }>(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useLoaderData: () => mockUseLoaderData(),
    UNSAFE_withComponentProps: <T,>(component: React.ComponentType<T>) => component,
  };
});

import FuriganaById from "./furigana.$id";

describe("furigana route component", () => {
  beforeEach(() => {
    mockUseLoaderData.mockReset();
    mockUseLoaderData.mockReturnValue({ tokens: [] });
  });

  it("renders a single ruby token as a <ruby> element", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }],
    });

    const { container } = render(<FuriganaById />);

    const ruby = container.querySelector("ruby");
    const rt = container.querySelector("rt");
    const rpElements = container.querySelectorAll("rp");
    expect(ruby).not.toBeNull();
    expect(ruby?.textContent).toContain("日本語");
    expect(rt?.textContent).toBe("にほんご");
    expect(rpElements).toHaveLength(2);
    expect(rpElements[0]?.textContent).toBe("(");
    expect(rpElements[1]?.textContent).toBe(")");
  });

  it("renders a single text token as a span without ruby", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [{ type: "text", value: "こんにちは" }],
    });

    const { container } = render(<FuriganaById />);

    expect(screen.getByText("こんにちは").tagName).toBe("SPAN");
    expect(container.querySelectorAll("ruby")).toHaveLength(0);
  });

  it("renders a mixed token array in document order", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [
        { type: "text", value: "私は" },
        { type: "ruby", kanji: "東京", yomi: "とうきょう" },
        { type: "text", value: "に住んでいます。" },
      ],
    });

    const { container } = render(<FuriganaById />);
    const article = container.querySelector("article");
    const ordered = article?.querySelectorAll("span, ruby");

    expect(container.querySelectorAll("span")).toHaveLength(2);
    expect(container.querySelectorAll("ruby")).toHaveLength(1);
    expect(ordered?.[0]?.tagName).toBe("SPAN");
    expect(ordered?.[1]?.tagName).toBe("RUBY");
    expect(ordered?.[2]?.tagName).toBe("SPAN");
  });

  it("renders an empty token array without crashing (store miss/placeholder path)", () => {
    mockUseLoaderData.mockReturnValue({ tokens: [] });

    const { container } = render(<FuriganaById />);
    const article = container.querySelector("article");

    expect(article).not.toBeNull();
    expect(container.querySelectorAll("ruby")).toHaveLength(0);
    expect(article?.querySelectorAll("span")).toHaveLength(0);
  });

  it("renders pure hiragana as plain text without ruby", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [{ type: "text", value: "きょうはいいてんきです。" }],
    });

    const { container } = render(<FuriganaById />);

    expect(screen.getByText("きょうはいいてんきです。").tagName).toBe("SPAN");
    expect(container.querySelectorAll("ruby")).toHaveLength(0);
  });

  it("does not emit duplicate-key warnings for repeated kanji", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [
        { type: "ruby", kanji: "山", yomi: "やま" },
        { type: "ruby", kanji: "山", yomi: "さん" },
      ],
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<FuriganaById />);

    expect(container.querySelectorAll("ruby")).toHaveLength(2);
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).includes('Each child in a list should have a unique "key" prop'),
      ),
    ).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("applies lang=ja on article", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [{ type: "text", value: "テスト" }],
    });

    const { container } = render(<FuriganaById />);
    const article = container.querySelector("article");

    expect(article?.getAttribute("lang")).toBe("ja");
  });

  it("renders rp fallback parentheses inside each ruby token", () => {
    mockUseLoaderData.mockReturnValue({
      tokens: [{ type: "ruby", kanji: "漢字", yomi: "かんじ" }],
    });

    const { container } = render(<FuriganaById />);
    const rpElements = container.querySelectorAll("rp");

    expect(rpElements).toHaveLength(2);
    expect(rpElements[0]?.textContent).toBe("(");
    expect(rpElements[1]?.textContent).toBe(")");
  });
});
