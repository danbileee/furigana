"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoryItem } from "@/lib/types";
import {
  getHistory,
  appendHistoryItem,
  deleteHistoryItem,
  updateHistoryItem,
} from "@/lib/history-client";

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    const list = await getHistory();
    setHistory(list);
    setIsLoading(false);
    return list;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  const appendItem = useCallback(async (item: HistoryItem) => {
    await appendHistoryItem(item);
    setHistory((prev) => [item, ...prev]);
    setSelectedId(item.id);
  }, []);

  const deleteItem = useCallback(
    async (id: string) => {
      await deleteHistoryItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    },
    [selectedId]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<Pick<HistoryItem, "name">>) => {
      await updateHistoryItem(id, updates);
      setHistory((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const selectedItem = selectedId
    ? history.find((item) => item.id === selectedId)
    : null;

  return {
    history,
    selectedId,
    setSelectedId,
    selectedItem,
    appendItem,
    deleteItem,
    updateItem,
    loadHistory,
    isLoading,
  };
}
