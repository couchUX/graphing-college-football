// Garbage time: the stretch of a blowout where the result is settled and the
// plays stop saying much about either team. Left in, a 45-7 game's fourth
// quarter of backups and clock-burning runs drags on both teams' success and
// explosiveness rates, so the filter takes those plays out of the numbers.
//
// The definition is Bill Connelly's, the one SP+ uses. A play is garbage time
// when, at the snap, the margin is strictly greater than:
//
//   Q1 38 · Q2 28 · Q3 22 · Q4 16 · overtime never
//
// A 16-point lead in the fourth still counts; 17 doesn't. It isn't sticky: if
// the trailing team closes the gap, its plays (and the leader's) count again.
//
// The margin has to be read from the score as it stood going INTO the play.
// CFBD stamps each play with the score after it, so on a touchdown the
// offenseScore already includes the six. Reading that would flag a play by
// the result it produced, so the walk below keeps its own running score and
// only folds a play's score in after judging it. That walk needs every play
// of the game — kickoffs, field goals, extra points — which is why tagging
// runs on the raw feed, before processPlayData throws all of that away.

/** The fields tagging reads. ApiPlayData and the wave's raw play type both fit. */
export interface ScoreboardPlay {
  id?: string | number;
  game_id?: number;
  gameId?: number;
  drive_number?: number;
  driveNumber?: number;
  play_number?: number;
  playNumber?: number;
  offense?: string;
  defense?: string;
  period?: number;
  quarter?: number;
  offenseScore?: number | null;
  defenseScore?: number | null;
  offense_score?: number | null;
  defense_score?: number | null;
}

/** The largest margin per regulation quarter (Q1–Q4) that's still a game. */
export const GARBAGE_TIME_THRESHOLDS: readonly number[] = [38, 28, 22, 16];

export interface GarbageTimeOptions {
  /** Q1–Q4 thresholds; a margin strictly greater than one is garbage time. */
  thresholds?: readonly number[];
  /**
   * Once a game turns to garbage time, keep every regulation play after it
   * there even if the margin comes back inside the threshold. Off by default,
   * matching SP+. Overtime is never garbage time either way.
   */
  sticky?: boolean;
}

/** Game order: drive, then play within the drive, then id. processPlayData sorts the same way. */
export const compareGameOrder = (a: ScoreboardPlay, b: ScoreboardPlay): number => {
  const aDrive = a.drive_number || a.driveNumber || 0;
  const bDrive = b.drive_number || b.driveNumber || 0;
  if (aDrive !== bDrive) return aDrive - bDrive;

  const aPlay = a.play_number || a.playNumber || 0;
  const bPlay = b.play_number || b.playNumber || 0;
  if (aPlay !== bPlay) return aPlay - bPlay;

  return String(a.id).localeCompare(String(b.id));
};

const scoreOf = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Walk one game's plays in order and collect the ones snapped in garbage time. */
const tagGame = <T extends ScoreboardPlay>(plays: T[], thresholds: readonly number[], sticky: boolean, into: Set<T>) => {
  const ordered = [...plays].sort(compareGameOrder);
  const score = new Map<string, number>();
  let settled = false;

  for (const play of ordered) {
    const offense = play.offense || '';
    const defense = play.defense || '';
    const period = play.period || play.quarter || 0;

    // Judge the play on the score before it was run.
    const margin = Math.abs((score.get(offense) ?? 0) - (score.get(defense) ?? 0));
    const threshold = period >= 1 && period <= 4 ? thresholds[period - 1] : undefined;
    let garbage = threshold !== undefined && margin > threshold;

    if (sticky && period >= 1 && period <= 4) {
      if (garbage) settled = true;
      else if (settled) garbage = true;
    }
    if (garbage) into.add(play);

    // Then fold in the score it left behind. max() so a missing, null or
    // momentarily stale field can never run a score backwards.
    const offenseScore = scoreOf(play.offenseScore ?? play.offense_score);
    const defenseScore = scoreOf(play.defenseScore ?? play.defense_score);
    if (offense && offenseScore !== null) score.set(offense, Math.max(score.get(offense) ?? 0, offenseScore));
    if (defense && defenseScore !== null) score.set(defense, Math.max(score.get(defense) ?? 0, defenseScore));
  }
};

/**
 * Every play snapped in garbage time, as the same objects passed in.
 *
 * Takes the raw feed — every play, special teams included — for one game or
 * many (a season's worth is fine: plays are grouped by game first, so each
 * game keeps its own scoreboard). The set holds the plays themselves rather
 * than their ids, so a duplicated id, or one JSON.parse rounded past 2^53,
 * can never tag the wrong play.
 */
export const findGarbageTimePlays = <T extends ScoreboardPlay>(rawPlays: T[], options: GarbageTimeOptions = {}): Set<T> => {
  const thresholds = options.thresholds ?? GARBAGE_TIME_THRESHOLDS;
  const sticky = options.sticky ?? false;

  const byGame = new Map<string, T[]>();
  for (const play of rawPlays) {
    const key = String(play.game_id ?? play.gameId ?? '');
    const game = byGame.get(key);
    if (game) game.push(play);
    else byGame.set(key, [play]);
  }

  const garbage = new Set<T>();
  byGame.forEach(plays => tagGame(plays, thresholds, sticky, garbage));
  return garbage;
};

/** The plays that count once garbage time is out, or every play when the filter is off. */
export const countedPlays = <T extends { garbageTime: boolean }>(plays: T[], excludeGarbageTime: boolean): T[] =>
  excludeGarbageTime ? plays.filter(play => !play.garbageTime) : plays;

/** countedPlays for a season's per-game map. Hands the same map back when the filter is off. */
export const countedPerGame = <T extends { garbageTime: boolean }>(
  perGame: Map<number, T[]>,
  excludeGarbageTime: boolean
): Map<number, T[]> => {
  if (!excludeGarbageTime) return perGame;
  const counted = new Map<number, T[]>();
  perGame.forEach((plays, gameId) => counted.set(gameId, plays.filter(play => !play.garbageTime)));
  return counted;
};

/** How many of these plays were snapped in garbage time. */
export const countGarbageTime = (plays: { garbageTime: boolean }[]): number =>
  plays.reduce((n, play) => n + (play.garbageTime ? 1 : 0), 0);

// ---------------------------------------------------------------------------
// The setting. One query param, written only when it departs from the default,
// so a link with no say in the matter gets the SP+ view.

export const GARBAGE_TIME_PARAM = 'garbageTime';

/** Garbage time is out of the numbers unless the page says otherwise. */
export const EXCLUDE_GARBAGE_TIME_BY_DEFAULT = true;

/** Whether a query string asks for garbage time to be excluded. */
export const readExcludeGarbageTime = (params: URLSearchParams): boolean => {
  const value = params.get(GARBAGE_TIME_PARAM);
  if (value === 'include') return false;
  if (value === 'exclude') return true;
  return EXCLUDE_GARBAGE_TIME_BY_DEFAULT;
};

/** The param's value for a setting: null (leave it out) at the default. */
export const garbageTimeParamValue = (exclude: boolean): string | null =>
  exclude === EXCLUDE_GARBAGE_TIME_BY_DEFAULT ? null : exclude ? 'exclude' : 'include';

/** One line for a chart's subtitle or an embed, saying what the numbers leave out. */
export const garbageTimeNote = (exclude: boolean, garbagePlays: number): string | null => {
  if (!exclude || garbagePlays === 0) return null;
  return `Excludes ${garbagePlays} garbage-time ${garbagePlays === 1 ? 'play' : 'plays'}`;
};

// Colors for plays drawn but not counted, used only while the filter is on.
// A warm gray off the paper palette, light enough to recede behind the team
// colors and dark enough to read on the white canvas.

/** Line segments and point outlines. */
export const GARBAGE_TIME_STROKE = '#B5AFA7';
/** Point and dot fills. */
export const GARBAGE_TIME_FILL = '#DDD8D1';
