"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { HistorySidebar } from "@/components/HistorySidebar";
import { FuriganaDisplay } from "@/components/FuriganaDisplay";
import { useHistory } from "@/hooks/useHistory";
import { sanitizeFuriganaHtml } from "@/lib/sanitize-furigana-html";

export default function Home() {
  const {
    history,
    selectedId,
    setSelectedId,
    selectedItem,
    appendItem,
    deleteItem,
    updateItem,
  } = useHistory();

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHtml, setLastHtml] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Request failed");
        return;
      }

      const rawHtml = typeof data?.html === "string" ? data.html : "";
      const html = sanitizeFuriganaHtml(rawHtml);
      const item = {
        id: crypto.randomUUID(),
        originalText: text,
        html,
        createdAt: Date.now(),
      };

      await appendItem(item);
      setLastHtml(html);
      // Clear input after successful submission
      setInputText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, appendItem]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteItem(id);
      setLastHtml(null);
    },
    [deleteItem]
  );

  const handleUpdate = useCallback(
    async (id: string, name: string) => {
      await updateItem(id, { name: name || undefined });
    },
    [updateItem]
  );

  const handleNewInput = useCallback(() => {
    setSelectedId(null);
    setInputText("");
    setError(null);
    setLastHtml(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show input UI when no history item is selected (first entrance or after clicking "New Input")
  const showInput = selectedId === null;
  // Display HTML from selected item, or from last submission if no item selected
  const displayHtml = selectedItem?.html ?? (showInput ? null : lastHtml);

  return (
    <div className="flex min-h-screen">
      <HistorySidebar
        history={history}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onNewInput={handleNewInput}
      />
      <main className="flex min-w-0 flex-1 flex-col p-6">
        {showInput ? (
          // Input UI: shown on first entrance or when clicking "New Input"
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="japanese-input" className="sr-only">
                Japanese paragraph
              </label>
              <textarea
                id="japanese-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste or type Japanese text here..."
                className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={4}
                disabled={isLoading}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !inputText.trim()}
                >
                  {isLoading ? "Loading…" : "Get furigana"}
                </Button>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Display UI: shown when a history item is selected or after submission
          <section
            className="mx-auto min-h-[160px] max-w-[600px] rounded-md border border-border bg-muted/20 p-4"
            aria-label="Furigana result"
          >
            {isLoading && !displayHtml ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <FuriganaDisplay html={displayHtml} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
