// Team Trends URL state that isn't just a plain value: game selections are
// encoded as sorted indices into the full games list. The generic
// read/write helpers live in ./urlState.

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
