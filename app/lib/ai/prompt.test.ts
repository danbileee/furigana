import { buildUserMessage } from "~/lib/ai/prompt";

describe("buildUserMessage", () => {
  it("returns plain japanese text unchanged", () => {
    const input = "日本語を勉強しています。";
    expect(buildUserMessage(input)).toBe(input);
  });

  it("returns an already-annotated string unchanged", () => {
    const input = "東京{とうきょう}に行{い}きました。";
    expect(buildUserMessage(input)).toBe(input);
  });

  it("returns an empty string unchanged", () => {
    expect(buildUserMessage("")).toBe("");
  });
});
