/**
 * Play-type classification, in one place.
 *
 * CFBD play_type strings vary ("Rush", "Rushing Touchdown", "Sack", ...), so
 * the app sniffs them by substring. That sniff used to be inlined in a dozen
 * spots across the hooks and the dashboard; it lives here now so rush/pass
 * splits can never drift between charts.
 *
 * Note sacks and interceptions count as PASS plays (not rushes, as traditional
 * box scores have it) — see the Data Definitions panel on the Games page.
 */

export const isRushPlayType = (playType?: string | null): boolean => {
  if (!playType) return false;
  const t = playType.toLowerCase();
  return t.includes('rush') || t.includes('run');
};

export const isRushPlay = (play: { playType?: string | null }): boolean =>
  isRushPlayType(play?.playType);

/** 'Rush' | 'Pass' | 'Other' — used by the raw play tables. */
export const classifyPlayType = (playType?: string | null): 'Rush' | 'Pass' | 'Other' => {
  if (!playType) return 'Other';
  const t = playType.toLowerCase();
  if (isRushPlayType(t)) return 'Rush';
  if (
    t.includes('pass') ||
    t.includes('completion') ||
    t.includes('incompletion') ||
    t.includes('sack') ||
    t.includes('interception')
  ) {
    return 'Pass';
  }
  return 'Other';
};
