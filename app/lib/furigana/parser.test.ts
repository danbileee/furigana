import { MAX_INPUT_LENGTH } from "~/constants/input";
import { parseAnnotationString } from "~/lib/furigana/parser";

describe("parseAnnotationString", () => {
  describe("base cases", () => {
    it("returns [] for empty string", () => {
      expect(parseAnnotationString("")).toEqual([]);
    });

    it("returns a single TextToken for plain hiragana", () => {
      expect(parseAnnotationString("こんにちは")).toEqual([{ type: "text", value: "こんにちは" }]);
    });

    it("returns a single TextToken for plain romaji", () => {
      expect(parseAnnotationString("Hello world")).toEqual([
        { type: "text", value: "Hello world" },
      ]);
    });
  });

  describe("single ruby token", () => {
    it("parses an annotated kanji compound with no surrounding text", () => {
      expect(parseAnnotationString("日本語{にほんご}")).toEqual([
        { type: "ruby", kanji: "日本語", yomi: "にほんご" },
      ]);
    });

    it("parses an annotated single kanji character", () => {
      expect(parseAnnotationString("行{い}")).toEqual([{ type: "ruby", kanji: "行", yomi: "い" }]);
    });

    it("parses ruby token followed by trailing text", () => {
      expect(parseAnnotationString("行{い}きました")).toEqual([
        { type: "ruby", kanji: "行", yomi: "い" },
        { type: "text", value: "きました" },
      ]);
    });

    it("parses leading text followed by a ruby token", () => {
      expect(parseAnnotationString("私は東京{とうきょう}")).toEqual([
        { type: "text", value: "私は" },
        { type: "ruby", kanji: "東京", yomi: "とうきょう" },
      ]);
    });
  });

  describe("multiple tokens", () => {
    it("parses two adjacent ruby tokens with no text between them", () => {
      expect(parseAnnotationString("漢字{かんじ}漢字{かんじ}")).toEqual([
        { type: "ruby", kanji: "漢字", yomi: "かんじ" },
        { type: "ruby", kanji: "漢字", yomi: "かんじ" },
      ]);
    });

    it("parses two ruby tokens separated by hiragana text", () => {
      expect(parseAnnotationString("東京{とうきょう}に行{い}きました")).toEqual([
        { type: "ruby", kanji: "東京", yomi: "とうきょう" },
        { type: "text", value: "に" },
        { type: "ruby", kanji: "行", yomi: "い" },
        { type: "text", value: "きました" },
      ]);
    });

    it("parses two ruby tokens with punctuation at the end", () => {
      expect(parseAnnotationString("東京{とうきょう}は元気{げんき}？")).toEqual([
        { type: "ruby", kanji: "東京", yomi: "とうきょう" },
        { type: "text", value: "は" },
        { type: "ruby", kanji: "元気", yomi: "げんき" },
        { type: "text", value: "？" },
      ]);
    });
  });

  describe("malformed input safety", () => {
    it("treats unclosed opening brace as literal text", () => {
      expect(parseAnnotationString("unclosed{")).toEqual([{ type: "text", value: "unclosed{" }]);
    });

    it("treats empty yomi braces as literal text", () => {
      expect(parseAnnotationString("text{}")).toEqual([{ type: "text", value: "text{}" }]);
    });

    it("treats empty kanji group as literal text", () => {
      expect(parseAnnotationString("{reading}")).toEqual([{ type: "text", value: "{reading}" }]);
    });

    it("handles nested braces deterministically without crashing", () => {
      expect(parseAnnotationString("bad{nested{braces}}")).toEqual([
        { type: "ruby", kanji: "bad", yomi: "nested{braces" },
        { type: "text", value: "}" },
      ]);
    });

    it("handles stray closing brace in plain text", () => {
      expect(parseAnnotationString("text}more")).toEqual([{ type: "text", value: "text}more" }]);
    });

    it("handles input that is only braces", () => {
      expect(parseAnnotationString("{}")).toEqual([{ type: "text", value: "{}" }]);
    });

    it("handles input that is only opening brace", () => {
      expect(parseAnnotationString("{")).toEqual([{ type: "text", value: "{" }]);
    });
  });

  describe("token shape integrity", () => {
    it("emits TextToken objects with the expected shape", () => {
      const result = parseAnnotationString("こんにちは");

      expect(result).toEqual([{ type: "text", value: "こんにちは" }]);
      expect(result[0]).toBeDefined();
      expect(Object.keys(result[0] ?? {}).sort()).toEqual(["type", "value"]);
    });

    it("emits RubyToken objects with the expected shape", () => {
      const result = parseAnnotationString("行{い}");

      expect(result).toEqual([{ type: "ruby", kanji: "行", yomi: "い" }]);
      expect(result[0]).toBeDefined();
      expect(Object.keys(result[0] ?? {}).sort()).toEqual(["kanji", "type", "yomi"]);
    });

    it("does not lose non-brace characters from the input", () => {
      const input = "東京{とうきょう}に行{い}きました";
      const tokens = parseAnnotationString(input);
      const reconstructed = tokens
        .map((token) => (token.type === "ruby" ? token.kanji + token.yomi : token.value))
        .join("");

      expect(reconstructed).toBe(input.replaceAll("{", "").replaceAll("}", ""));
    });
  });

  describe("paragraph-level realistic cases", () => {
    it("parses a news style sentence with punctuation", () => {
      expect(
        parseAnnotationString(
          "今日{きょう}、日本{にほん}の首相{しゅしょう}が新{あたら}しい政策{せいさく}を発表{はっぴょう}しました。",
        ),
      ).toEqual([
        { type: "ruby", kanji: "今日", yomi: "きょう" },
        { type: "text", value: "、" },
        { type: "ruby", kanji: "日本", yomi: "にほん" },
        { type: "text", value: "の" },
        { type: "ruby", kanji: "首相", yomi: "しゅしょう" },
        { type: "text", value: "が" },
        { type: "ruby", kanji: "新", yomi: "あたら" },
        { type: "text", value: "しい" },
        { type: "ruby", kanji: "政策", yomi: "せいさく" },
        { type: "text", value: "を" },
        { type: "ruby", kanji: "発表", yomi: "はっぴょう" },
        { type: "text", value: "しました。" },
      ]);
    });

    it("parses a classic literature style two-sentence input", () => {
      expect(
        parseAnnotationString("吾輩{わがはい}は猫{ねこ}である。名前{なまえ}はまだ無{な}い。"),
      ).toEqual([
        { type: "ruby", kanji: "吾輩", yomi: "わがはい" },
        { type: "text", value: "は" },
        { type: "ruby", kanji: "猫", yomi: "ねこ" },
        { type: "text", value: "である。" },
        { type: "ruby", kanji: "名前", yomi: "なまえ" },
        { type: "text", value: "はまだ" },
        { type: "ruby", kanji: "無", yomi: "な" },
        { type: "text", value: "い。" },
      ]);
    });

    it("parses a long compound sentence with many ruby alternations", () => {
      expect(
        parseAnnotationString(
          "東京{とうきょう}と大阪{おおさか}は日本{にほん}の二{ふた}つの大{おお}きな都市{とし}であり、経済{けいざい}と文化{ぶんか}の中心{ちゅうしん}として知{し}られています。",
        ),
      ).toEqual([
        { type: "ruby", kanji: "東京", yomi: "とうきょう" },
        { type: "text", value: "と" },
        { type: "ruby", kanji: "大阪", yomi: "おおさか" },
        { type: "text", value: "は" },
        { type: "ruby", kanji: "日本", yomi: "にほん" },
        { type: "text", value: "の" },
        { type: "ruby", kanji: "二", yomi: "ふた" },
        { type: "text", value: "つの" },
        { type: "ruby", kanji: "大", yomi: "おお" },
        { type: "text", value: "きな" },
        { type: "ruby", kanji: "都市", yomi: "とし" },
        { type: "text", value: "であり、" },
        { type: "ruby", kanji: "経済", yomi: "けいざい" },
        { type: "text", value: "と" },
        { type: "ruby", kanji: "文化", yomi: "ぶんか" },
        { type: "text", value: "の" },
        { type: "ruby", kanji: "中心", yomi: "ちゅうしん" },
        { type: "text", value: "として" },
        { type: "ruby", kanji: "知", yomi: "し" },
        { type: "text", value: "られています。" },
      ]);
    });
  });

  describe("splitTrailingKanji integration", () => {
    it("treats hiragana-only text before annotation as a ruby kanji field", () => {
      expect(parseAnnotationString("あいう{おん}")).toEqual([
        { type: "ruby", kanji: "あいう", yomi: "おん" },
      ]);
    });

    it("splits mixed text around the final trailing kanji before annotation", () => {
      expect(parseAnnotationString("東京は大{おお}きい")).toEqual([
        { type: "text", value: "東京は" },
        { type: "ruby", kanji: "大", yomi: "おお" },
        { type: "text", value: "きい" },
      ]);
    });

    it("treats the iteration mark 々 as part of a kanji compound", () => {
      expect(parseAnnotationString("時々{ときどき}")).toEqual([
        { type: "ruby", kanji: "時々", yomi: "ときどき" },
      ]);
    });

    it("treats ヶ as part of a kanji compound", () => {
      expect(parseAnnotationString("三ヶ月{さんかげつ}")).toEqual([
        { type: "ruby", kanji: "三ヶ月", yomi: "さんかげつ" },
      ]);
    });
  });

  describe("performance and encoding", () => {
    it("parses a max-length pure text input as one text token", () => {
      const input = "あ".repeat(MAX_INPUT_LENGTH);

      expect(parseAnnotationString(input)).toEqual([{ type: "text", value: input }]);
    });

    it("handles 1,000 consecutive ruby tokens without drift", () => {
      const input = "漢字{かんじ}".repeat(1_000);
      const result = parseAnnotationString(input);

      expect(result).toHaveLength(1_000);
      expect(
        result.every((token) => {
          return token.type === "ruby" && token.kanji === "漢字" && token.yomi === "かんじ";
        }),
      ).toBe(true);
    });

    it("handles supplementary-plane han characters correctly", () => {
      expect(parseAnnotationString("𠀋{じょう}")).toEqual([
        { type: "ruby", kanji: "𠀋", yomi: "じょう" },
      ]);
    });
  });
});
