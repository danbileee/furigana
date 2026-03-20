export function sanitizeUserInput(input: string): string {
  return (
    input
      // Remove HTML tags (opening and closing, with optional whitespace around tag name)
      .replace(/\s*<\/? *[A-Za-z][^>]*>/g, "")
      // Remove javascript: protocol (case-insensitive)
      .replace(/javascript:/gi, "")
      // Remove event handler patterns (on* = patterns)
      .replace(/on\w+=/gi, "")
  );
}
