export type HistoryItem = {
  id: string;
  originalText: string;
  /** HTML with <ruby>kanji<rt>reading</rt></ruby> for kanji. */
  html: string;
  createdAt: number;
  /** Optional custom name for the history item. If not set, originalText is used for display. */
  name?: string;
};
