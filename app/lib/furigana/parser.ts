import type { FuriganaToken } from "~/schema/furigana";

type ParserState = "text" | "yomi";
const KANJI_CHAR_REGEX = /[\p{Script=Han}々〆ヶ]/u;

function splitTrailingKanji(value: string): { leading: string; kanji: string } {
  if (value.length === 0) return { leading: "", kanji: "" };

  const chars = Array.from(value);
  let splitIndex = chars.length;
  /* v8 ignore next -- @preserve */
  while (splitIndex > 0 && KANJI_CHAR_REGEX.test(chars[splitIndex - 1] ?? "")) {
    splitIndex -= 1;
  }

  return {
    leading: chars.slice(0, splitIndex).join(""),
    kanji: chars.slice(splitIndex).join(""),
  };
}

export function parseAnnotationString(input: string): FuriganaToken[] {
  if (input.length === 0) return [];

  const result: FuriganaToken[] = [];
  let state: ParserState = "text";
  let textBuffer = "";
  let yomiBuffer = "";
  let leadingTextBeforeRuby = "";

  for (const char of input) {
    if (char === "{") {
      if (state === "text") {
        const { leading, kanji } = splitTrailingKanji(textBuffer);
        if (kanji.length > 0) {
          leadingTextBeforeRuby = leading;
          textBuffer = kanji;
        } else {
          leadingTextBeforeRuby = "";
        }
        state = "yomi";
        yomiBuffer = "";
      } else {
        yomiBuffer += char;
      }
      continue;
    }

    if (char === "}") {
      if (state === "yomi") {
        if (textBuffer.length > 0 && yomiBuffer.length > 0) {
          if (leadingTextBeforeRuby.length > 0) {
            result.push({ type: "text", value: leadingTextBeforeRuby });
          }
          result.push({ type: "ruby", kanji: textBuffer, yomi: yomiBuffer });
        } else {
          const raw = leadingTextBeforeRuby + textBuffer + "{" + yomiBuffer + "}";
          /* v8 ignore else -- @preserve */ if (raw.length > 0) {
            result.push({ type: "text", value: raw });
          }
        }

        textBuffer = "";
        yomiBuffer = "";
        leadingTextBeforeRuby = "";
        state = "text";
      } else {
        textBuffer += char;
      }
      continue;
    }

    if (state === "text") {
      textBuffer += char;
    } else {
      yomiBuffer += char;
    }
  }

  if (state === "yomi") {
    const raw = leadingTextBeforeRuby + textBuffer + "{" + yomiBuffer;
    /* v8 ignore else -- @preserve */ if (raw.length > 0) {
      result.push({ type: "text", value: raw });
    }
  } else if (textBuffer.length > 0) {
    result.push({ type: "text", value: textBuffer });
  }

  return result;
}
