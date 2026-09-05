// Season boundaries in one place, so the site rolls into a new college football
// year on its own instead of waiting on a hardcoded bump every August.
//
// A season is named for the calendar year it kicks off in: the 2025 season runs
// from Week 0 in late August through the title game the following January. So
// anything from August onward belongs to the current calendar year's season;
// January through July still belongs to the previous one.

/** Earliest season with play-by-play good enough to chart (Games, Trends). */
export const FIRST_PLAY_BY_PLAY_SEASON = 2014;

/** Earliest season CFBD publishes SP+ for (Ratings, Discover). */
export const FIRST_RATINGS_SEASON = 2005;

/** The season currently underway (or the one just finished, in the offseason). */
export const getCurrentSeason = (now: Date = new Date()): number =>
  now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

/**
 * The most recent season that has played out end to end. During a season that's
 * still in progress this is the year before; in the offseason it's the current
 * season, which by then has finished.
 */
export const getLatestCompletedSeason = (now: Date = new Date()): number =>
  now.getMonth() >= 7 ? getCurrentSeason(now) - 1 : getCurrentSeason(now);

/** Newest season first — the order every year dropdown on the site wants. */
const seasonsDescending = (earliest: number, latest: number): number[] =>
  Array.from({ length: latest - earliest + 1 }, (_, i) => latest - i);

export const CURRENT_SEASON = getCurrentSeason();
export const LATEST_COMPLETED_SEASON = getLatestCompletedSeason();

/** Years offered wherever play-by-play drives the charts. */
export const SEASON_YEARS = seasonsDescending(
  FIRST_PLAY_BY_PLAY_SEASON,
  CURRENT_SEASON,
);

/** Years offered wherever season-level ratings and team metrics drive the charts. */
export const RATINGS_YEARS = seasonsDescending(
  FIRST_RATINGS_SEASON,
  CURRENT_SEASON,
);
