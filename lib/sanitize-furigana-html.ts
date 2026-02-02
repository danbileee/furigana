/**
 * Escapes HTML special characters in plain text.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sanitizes raw API HTML: keeps only <ruby>base<rt>reading</rt></ruby>,
 * escapes everything else. No attributes allowed on ruby or rt.
 */
export function sanitizeFuriganaHtml(html: string): string {
  if (typeof html !== "string") return "";

  const rubyRe =
    /<ruby\s*>([\s\S]*?)<rt\s*>([\s\S]*?)<\/rt\s*>[\s\S]*?<\/ruby>/gi;
  let result = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = rubyRe.exec(html)) !== null) {
    result += escapeHtml(html.slice(lastIndex, m.index));
    const base = m[1].replace(/<[^>]+>/g, "").trim();
    const reading = m[2].trim();
    result += `<ruby>${escapeHtml(base)}<rt>${escapeHtml(reading)}</rt></ruby>`;
    lastIndex = rubyRe.lastIndex;
  }

  result += escapeHtml(html.slice(lastIndex));
  return result;
}
