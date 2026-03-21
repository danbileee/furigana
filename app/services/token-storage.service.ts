import type { FuriganaToken } from "~/schema/furigana.schema";

// Server-only in-memory store used by route loaders/actions.
const tokenStore = new Map<string, FuriganaToken[]>();

export function setTokens(id: string, tokens: FuriganaToken[]): void {
  tokenStore.set(id, tokens);
}

export function getTokens(id: string): FuriganaToken[] | null {
  return tokenStore.get(id) ?? null;
}

export function consumeTokens(id: string): FuriganaToken[] | null {
  const tokens = getTokens(id);

  if (tokens === null) {
    return null;
  }

  tokenStore.delete(id);

  return tokens;
}
