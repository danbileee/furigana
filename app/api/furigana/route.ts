import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_TEXT_LENGTH = 10_000;

const FURIGANA_SYSTEM_PROMPT = `You are a Japanese language expert. Given a Japanese paragraph, return a single HTML string for furigana display using ruby tags.

CRITICAL REQUIREMENTS:
- You MUST wrap EVERY kanji character or kanji word/phrase in <ruby>KANJI<rt>READING</rt></ruby>.
- Do NOT skip any kanji—every single kanji character must have furigana.
- Even single kanji characters need ruby tags. Example: 本 → <ruby>本<rt>ほん</rt></ruby>.
- For multi-kanji words, wrap the entire word: 今日 → <ruby>今日<rt>きょう</rt></ruby>.
- For kanji mixed with kana, wrap only the kanji parts: 食べる → <ruby>食<rt>た</rt></ruby>べる (wrap the kanji 食, leave kana べる as plain text).
- Use the reading in hiragana or katakana (e.g. <rt>きょう</rt> for 今日).
- Do NOT wrap kana-only text (hiragana/katakana), punctuation, or spaces—leave them as plain text outside ruby tags.
- Preserve the exact original characters; do not normalize or change the text.
- Be thorough: check every character and ensure no kanji is left unwrapped.
- Return only the HTML string: no markdown, no code fences, no explanation.`;

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "furigana_html",
    description: "HTML string with ruby/rt tags for furigana",
    strict: true,
    schema: {
      type: "object",
      properties: {
        html: {
          type: "string",
          description:
            "HTML with <ruby>kanji<rt>reading</rt></ruby> for EVERY kanji character/word/phrase—no kanji should be skipped",
        },
      },
      required: ["html"],
      additionalProperties: false,
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Missing or empty text" },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    // Model options:
    // - "gpt-5.2" or "gpt-5.2-pro" - Latest, most accurate (recommended for best results)
    // - "gpt-5-mini" - Cost-effective GPT-5 option
    // - "gpt-4o" - Good balance of accuracy and cost
    // - "gpt-4o-mini" - Cheapest option, may skip some kanji
    // Set OPENAI_MODEL env var to override (default: "gpt-4o")
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: FURIGANA_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: responseFormat,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content) as { html?: string };
    const html = typeof parsed?.html === "string" ? parsed.html : "";

    return NextResponse.json({ html });
  } catch (err) {
    console.error("Furigana API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
