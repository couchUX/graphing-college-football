// Helpers for reading/writing Team Trends URL state without clobbering other
// query params (each sub-view owns its own keys; switching tabs preserves the
// rest). Game selections are encoded as sorted indices into the full games list.

export const readParams = (): URLSearchParams =>
  new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

export const writeParams = (updates: Record<string, string | null | undefined>): void => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  window.history.replaceState(
    {},
    '',
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
};

// Encode selected game ids as sorted indices into the full games list; returns
// null when all games are selected (the default) to keep URLs short. An empty
// selection uses the 'none' sentinel so it round-trips distinctly from "all".
export const encodeGameSelection = (
  selectedIds: number[],
  games: { id: number }[],
): string | null => {
  if (games.length === 0 || selectedIds.length === games.length) return null;
  if (selectedIds.length === 0) return 'none';
  const allIds = games.map((g) => g.id);
  const indices = selectedIds
    .map((id) => allIds.indexOf(id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  return indices.length ? indices.join('-') : 'none';
};

export const decodeGameSelection = (
  encoded: string | null | undefined,
  games: { id: number }[],
): number[] => {
  if (!encoded) return games.map((g) => g.id);
  if (encoded === 'none') return [];
  const ids = encoded
    .split('-')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n))
    .map((i) => games[i]?.id)
    .filter((id): id is number => id != null);
  return ids.length ? ids : games.map((g) => g.id);
};
