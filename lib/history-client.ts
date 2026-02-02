import type { HistoryItem } from "@/lib/types";

const HISTORY_STORAGE_KEY = "furigana-history";

export async function getHistory(): Promise<HistoryItem[]> {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HistoryItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as HistoryItem).id === "string" &&
        typeof (item as HistoryItem).originalText === "string" &&
        typeof (item as HistoryItem).html === "string" &&
        typeof (item as HistoryItem).createdAt === "number" &&
        ((item as HistoryItem).name === undefined ||
          typeof (item as HistoryItem).name === "string")
    );
  } catch {
    return [];
  }
}

export async function appendHistoryItem(item: HistoryItem): Promise<void> {
  const list = await getHistory();
  list.unshift(item);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const list = await getHistory();
  const filtered = list.filter((item) => item.id !== id);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered));
  }
}

export async function updateHistoryItem(
  id: string,
  updates: Partial<Pick<HistoryItem, "name">>
): Promise<void> {
  const list = await getHistory();
  const updated = list.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  }
}
