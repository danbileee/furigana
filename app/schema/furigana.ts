// app/schema/furigana.ts

import * as z from "zod";

/**
 * Schema for a plain text segment (hiragana, katakana, punctuation, romaji).
 *
 * The value field must not contain brace-wrapped substrings of the form {…}
 * because those denote ruby annotation placeholders and belong in a RubyToken.
 */
export const TextTokenSchema = z.object({
  type: z.literal("text").readonly(),
  value: z
    .string()
    .regex(/^(?:[^{}])*$/, "TextToken value must not contain {…} placeholders"),
});

/**
 * Schema for a kanji compound paired with its furigana reading.
 */
export const RubyTokenSchema = z.object({
  type: z.literal("ruby").readonly(),
  kanji: z.string().min(1),
  reading: z.string().min(1),
});

/**
 * Discriminated union schema for all token types in parsed furigana output.
 * The discriminant is the `type` field.
 */
export const FuriganaTokenSchema = z.discriminatedUnion("type", [
  TextTokenSchema,
  RubyTokenSchema,
]);

/**
 * TypeScript type for a plain text segment, derived from TextTokenSchema.
 */
export type TextToken = z.infer<typeof TextTokenSchema>;

/**
 * TypeScript type for a kanji+reading pair, derived from RubyTokenSchema.
 */
export type RubyToken = z.infer<typeof RubyTokenSchema>;

/**
 * Union type for all possible tokens in parsed furigana output,
 * derived from FuriganaTokenSchema.
 */
export type FuriganaToken = z.infer<typeof FuriganaTokenSchema>;

/**
 * Type guard for TextToken. Narrows a FuriganaToken to TextToken.
 */
export function isTextToken(token: FuriganaToken): token is TextToken {
  return token.type === "text";
}

/**
 * Type guard for RubyToken. Narrows a FuriganaToken to RubyToken.
 */
export function isRubyToken(token: FuriganaToken): token is RubyToken {
  return token.type === "ruby";
}
