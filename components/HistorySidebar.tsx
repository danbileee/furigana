"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HistoryItem } from "@/lib/types";
import { Trash2, Pencil, Plus } from "lucide-react";

const TRUNCATE_LENGTH = 40;

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen) + "…";
}

interface HistoryItemRowProps {
  item: HistoryItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (name: string) => void;
}

function HistoryItemRow({
  item,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
}: HistoryItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayText = item.name
    ? truncate(item.name, TRUNCATE_LENGTH)
    : truncate(item.originalText, TRUNCATE_LENGTH);

  const handleSave = () => {
    const trimmed = editValue.trim();
    onUpdate(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(item.name ?? "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md",
          isSelected && "bg-primary/10 text-primary"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Enter a name..."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault();
          setIsEditing(true);
        }}
        className="min-w-0 flex-1 px-2 py-2 text-left text-sm"
        title="Double-click to edit name"
      >
        {displayText}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="shrink-0 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        aria-label="Edit name"
        title="Edit name"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="shrink-0 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete"
        title="Delete"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

interface HistorySidebarProps {
  history: HistoryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string) => void;
  onNewInput: () => void;
}

export function HistorySidebar({
  history,
  selectedId,
  onSelect,
  onDelete,
  onUpdate,
  onNewInput,
}: HistorySidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">History</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNewInput}
          className="h-7 px-2 text-xs"
          title="New input"
        >
          <Plus className="mr-1 size-3.5" />
          New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {history.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              No history yet. Submit Japanese text to see entries here.
            </p>
          ) : (
            history.map((item) => (
              <HistoryItemRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => onSelect(item.id)}
                onDelete={() => onDelete(item.id)}
                onUpdate={(name) => onUpdate(item.id, name)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
