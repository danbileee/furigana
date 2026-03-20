import { sanitizeUserInput } from "~/lib/furigana/sanitize";

describe("sanitize", () => {
  describe("html tag removal", () => {
    it("removes a script tag pair", () => {
      const input = "text<script>alert('xss')</script>more";
      expect(sanitizeUserInput(input)).toBe("textalert('xss')more");
    });

    it("removes img tags with attributes", () => {
      const input = '<img src="x" onerror="alert()">text';
      expect(sanitizeUserInput(input)).toBe("text");
    });

    it("removes iframe tags", () => {
      const input = 'before<iframe src="evil.com"></iframe>after';
      expect(sanitizeUserInput(input)).toBe("beforeafter");
    });

    it("removes tags regardless of case", () => {
      const input = "<SCRIPT>x</SCRIPT><Script>y</Script>";
      expect(sanitizeUserInput(input)).toBe("xy");
    });

    it("handles whitespace variants in tags", () => {
      const input = "< script >bad</ script >";
      expect(sanitizeUserInput(input)).toBe("bad");
    });

    it("removes closing tags", () => {
      const input = "</div></style>content";
      expect(sanitizeUserInput(input)).toBe("content");
    });
  });

  describe("event handler removal", () => {
    it("removes onclick handler pattern", () => {
      const input = 'onclick="alert()"rest';
      expect(sanitizeUserInput(input)).toBe('"alert()"rest');
    });

    it("removes onerror and onload handler patterns", () => {
      const input = "onerror=foo onload=bar";
      expect(sanitizeUserInput(input)).toBe("foo bar");
    });
  });

  describe("javascript protocol removal", () => {
    it("removes javascript protocol prefix", () => {
      const input = "javascript:alert('xss')";
      expect(sanitizeUserInput(input)).toBe("alert('xss')");
    });

    it("removes uppercase javascript protocol prefix", () => {
      const input = "JAVASCRIPT:bad";
      expect(sanitizeUserInput(input)).toBe("bad");
    });
  });

  describe("legitimate content preservation", () => {
    it("preserves plain japanese annotation strings", () => {
      const input = "東京{とうきょう}に行{い}きました";
      expect(sanitizeUserInput(input)).toBe("東京{とうきょう}に行{い}きました");
    });
  });

  describe("combined xss vectors", () => {
    it("handles multiple vectors in one input", () => {
      const input = "<script>bad</script>javascript:evil onclick=run 日本語{にほんご}";
      expect(sanitizeUserInput(input)).toBe("badevil run 日本語{にほんご}");
    });
  });
});
