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
// the result it produced, so each play is judged on the score the plays
// before it left. That needs every play of the game — kickoffs, field goals,
// extra points — which is why tagging runs on the raw feed, before
// processPlayData throws all of that away.
//
// Those stamps are noisy. Across a 2024 SEC/Big Ten sample, a kickoff row
// would now and then carry a touchdown that never happened, sometimes for one
// row and sometimes for a run of them before CFBD corrected it, and a scoring
// play sorted a row out of place would briefly read the old score. A running
// max() locks in every overstatement (Michigan led Minnesota 21-0, not 28-0,
// and max() kept the phantom seven all game); trusting the latest stamp trips
// on every one-row dip. So a team's score after a row is the median of its
// stamps on that row and its neighbors: a value counts once two of three
// consecutive rows agree. A play's own stamp only ever breaks a tie between
// the two before it, so a touchdown still can't count its own points.

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

/** The score going into a snap, from that play's offense's side. */
export interface ScoreAtSnap {
  offense: number;
  defense: number;
}

export interface Scoreboard<T> {
  /** Plays snapped in garbage time. */
  garbage: Set<T>;
  /** Every play's score going into the snap. */
  atSnap: Map<T, ScoreAtSnap>;
}

/** Walk one game's plays in order, recording each snap's score and whether it was garbage time. */
const tagGame = <T extends ScoreboardPlay>(
  plays: T[],
  thresholds: readonly number[],
  sticky: boolean,
  into: Scoreboard<T>
) => {
  const ordered = [...plays].sort(compareGameOrder);

  // Each team's stamped score after every row, carried past rows that don't
  // give one (a missing or null field never moves a score).
  const teams = new Set<string>();
  ordered.forEach(play => {
    if (play.offense) teams.add(play.offense);
    if (play.defense) teams.add(play.defense);
  });
  const stamps = new Map<string, number[]>([...teams].map(team => [team, []]));
  const latest = new Map<string, number>();
  for (const play of ordered) {
    const offenseScore = scoreOf(play.offenseScore ?? play.offense_score);
    const defenseScore = scoreOf(play.defenseScore ?? play.defense_score);
    if (play.offense && offenseScore !== null) latest.set(play.offense, offenseScore);
    if (play.defense && defenseScore !== null) latest.set(play.defense, defenseScore);
    teams.forEach(team => stamps.get(team)?.push(latest.get(team) ?? 0));
  }

  /** A team's score after row `i`: the median of its stamps on rows i-1, i and i+1. */
  const scoreAfter = (team: string, i: number): number => {
    const series = stamps.get(team);
    if (!series || i < 0) return 0;
    const window = [series[Math.max(0, i - 1)], series[i], series[Math.min(series.length - 1, i + 1)]];
    return window.sort((a, b) => a - b)[1];
  };

  let settled = false;
  ordered.forEach((play, i) => {
    const offense = play.offense || '';
    const defense = play.defense || '';
    const period = play.period || play.quarter || 0;

    // Judge the play on the score the rows before it left.
    const offenseBefore = scoreAfter(offense, i - 1);
    const defenseBefore = scoreAfter(defense, i - 1);
    into.atSnap.set(play, { offense: offenseBefore, defense: defenseBefore });
    const margin = Math.abs(offenseBefore - defenseBefore);
    const threshold = period >= 1 && period <= 4 ? thresholds[period - 1] : undefined;
    let garbage = threshold !== undefined && margin > threshold;

    if (sticky && period >= 1 && period <= 4) {
      if (garbage) settled = true;
      else if (settled) garbage = true;
    }
    if (garbage) into.garbage.add(play);
  });
};

/**
 * Each play's score at the snap, and which plays were snapped in garbage time.
 *
 * Takes the raw feed — every play, special teams included — for one game or
 * many (a season's worth is fine: plays are grouped by game first, so each
 * game keeps its own scoreboard). Both are keyed on the plays themselves
 * rather than their ids, so a duplicated id, or one JSON.parse rounded past
 * 2^53, can never tag the wrong play.
 */
export const readScoreboard = <T extends ScoreboardPlay>(rawPlays: T[], options: GarbageTimeOptions = {}): Scoreboard<T> => {
  const thresholds = options.thresholds ?? GARBAGE_TIME_THRESHOLDS;
  const sticky = options.sticky ?? false;

  const byGame = new Map<string, T[]>();
  for (const play of rawPlays) {
    const key = String(play.game_id ?? play.gameId ?? '');
    const game = byGame.get(key);
    if (game) game.push(play);
    else byGame.set(key, [play]);
  }

  const scoreboard: Scoreboard<T> = { garbage: new Set<T>(), atSnap: new Map<T, ScoreAtSnap>() };
  byGame.forEach(plays => tagGame(plays, thresholds, sticky, scoreboard));
  return scoreboard;
};

/** Every play snapped in garbage time, as the same objects passed in. See readScoreboard. */
export const findGarbageTimePlays = <T extends ScoreboardPlay>(rawPlays: T[], options: GarbageTimeOptions = {}): Set<T> =>
  readScoreboard(rawPlays, options).garbage;

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

/**
 * The subtitle note for a copied chart, when it leaves anything out. No count:
 * subtitles already run long, and on a phone every word wraps.
 */
export const garbageTimeNote = (exclude: boolean, garbagePlays: number): string | null =>
  exclude && garbagePlays > 0 ? 'Excludes garbage time' : null;

/**
 * The "Data definitions" bullet for a copied chart that leaves garbage time
 * out. Charts that draw plays one by one (Games) also say what the gray means.
 */
export const garbageTimeDefinition = (drawsPlays: boolean): string => {
  const [q1, q2, q3, q4] = GARBAGE_TIME_THRESHOLDS;
  return (
    `<strong>Garbage time:</strong> Plays snapped with a lead of more than ${q1}, ${q2}, ${q3} or ${q4} ` +
    `points (Q1–Q4) are left out of the numbers` +
    (drawsPlays ? '; where plays are drawn, they are gray' : '')
  );
};

// Colors for plays drawn but not counted, used only while the filter is on.
// A warm gray off the paper palette, light enough to recede behind the team
// colors and dark enough to read on the white canvas.

/** Line segments and point outlines. */
export const GARBAGE_TIME_STROKE = '#B5AFA7';
/** Point and dot fills. */
export const GARBAGE_TIME_FILL = '#DDD8D1';
