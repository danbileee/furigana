import * as z from "zod";

/**
 * @schema
 * Schema for a plain text segment (hiragana, katakana, punctuation, romaji).
 *
 * The value field must not contain brace-wrapped substrings of the form {…}
 * because those denote ruby annotation placeholders and belong in a RubyToken.
 */
export const TextTokenSchema = z.object({
  type: z.literal("text").readonly(),
  value: z.string().regex(/^(?:[^{}])*$/, "TextToken value must not contain {…} placeholders"),
});

/**
 * @schema
 * Schema for a kanji compound paired with its furigana reading.
 */
export const RubyTokenSchema = z.object({
  type: z.literal("ruby").readonly(),
  kanji: z.string().min(1),
  yomi: z.string().min(1),
});

export const FuriganaTokenSchema = z.discriminatedUnion("type", [TextTokenSchema, RubyTokenSchema]);

export type TextToken = z.infer<typeof TextTokenSchema>;

export type RubyToken = z.infer<typeof RubyTokenSchema>;

export type FuriganaToken = z.infer<typeof FuriganaTokenSchema>;

export function isTextToken(token: FuriganaToken): token is TextToken {
  return token.type === "text";
}

export function isRubyToken(token: FuriganaToken): token is RubyToken {
  return token.type === "ruby";
}
