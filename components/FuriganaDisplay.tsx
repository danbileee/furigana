"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sanitizeFuriganaHtml } from "@/lib/sanitize-furigana-html";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "Enter text and submit, or pick from history.";

type DisplayMode = "default" | "hover";

interface FuriganaDisplayProps {
  /** Sanitized HTML with <ruby>kanji<rt>reading</rt></ruby> for kanji. */
  html: string | null;
  className?: string;
}

/**
 * Renders furigana HTML in a container. Uses <ruby>/<rt> from AI response.
 * Internal tabs:
 * - "Always show furigana" → rt always visible
 * - "Hover to see furigana" → rt visible on hover only
 */
export function FuriganaDisplay({ html, className }: FuriganaDisplayProps) {
  const [mode, setMode] = useState<DisplayMode>("default");

  const sanitized = useMemo(
    () => (html ? sanitizeFuriganaHtml(html) : ""),
    [html]
  );

  const isEmpty = !sanitized.trim();

  return (
    <div
      className={cn(
        "furigana-display text-lg leading-relaxed [font-family:var(--font-noto-sans-jp),sans-serif]",
        mode === "hover"
          ? "furigana-display--hover"
          : "furigana-display--default",
        className
      )}
      lang="ja"
    >
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as DisplayMode)}
        className="mb-4 w-fit"
      >
        <TabsList>
          <TabsTrigger value="default">Always show furigana</TabsTrigger>
          <TabsTrigger value="hover">Hover to see furigana</TabsTrigger>
        </TabsList>
      </Tabs>

      {isEmpty ? (
        <p className="text-muted-foreground">{PLACEHOLDER}</p>
      ) : (
        <p
          className="furigana-display__content"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}
    </div>
  );
}
