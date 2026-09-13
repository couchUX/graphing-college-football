import type { PlayData } from '../types';
import type { WaveEvent, WaveOutcome } from './gameWaveRuntime';

export type { WaveSide, WaveOutcome, WavePoint, WaveEvent, GameWaveModel } from './gameWaveRuntime';

export interface ScoringEvent {
  team: string;
  quarter: number;
  minutes: number;
  seconds: number;
}

const outcomeOf = (play: PlayData): WaveOutcome =>
  play.explosiveness ? 'explosive' : play.success ? 'success' : 'other';

// CFBD keeps a superseded call in the text when the ruling changes. A replay
// reversal appends "(Original Play: … TOUCHDOWN …)" after the ruling that
// stood, and a flag leaves "TOUCHDOWN nullified by penalty" in place. Neither
// happened, so both are cut before the text is read for markers — otherwise an
// overturned touchdown still gets a 6, and an overturned pick still gets an i.
// The original play nests its own parentheses ("(00:48)", "(#6 J.Crumby)"), so
// that block is removed by bracket depth rather than by pattern; an unclosed one
// runs to the end of the text.
const withoutSupersededCalls = (text: string): string => {
  let out = text;
  let start = out.search(/\(\s*original play\b/i);
  while (start !== -1) {
    let depth = 0;
    let end = out.length;
    for (let i = start; i < out.length; i += 1) {
      if (out[i] === '(') depth += 1;
      else if (out[i] === ')' && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    out = out.slice(0, start) + out.slice(end);
    start = out.search(/\(\s*original play\b/i);
  }
  return out.replace(/touchdown\s+nullified/gi, '');
};

// What a touchdown was worth once its try is counted: 7 with the extra point,
// 8 with a two-point conversion, 6 when the try failed. CFBD writes the try into
// the touchdown's own text, in one of two dialects — "#31 C.Talty kick attempt
// good" / "#3 L.Brooks pass attempt Successful", or "(Lucca Valens Kick)" /
// "(Two-Point Pass Conversion Failed)". A try redone after a flag is written
// again ("(… PAT missed) (… Kick)"), so the last mention is the one that stood.
// Text that never mentions the try falls back to the scoreboard, but only a
// change of 6–8: some feeds' running scores jump around.
const TRY_RESULTS: [RegExp, number][] = [
  [/kick attempt good|\bkick\)|\bextra point good|\bpat good/gi, 7],
  [/kick attempt (?:failed|no good|blocked|missed)|\b(?:pat|kick|extra point) (?:missed|blocked|failed|no good)/gi, 6],
  [/\b(?:pass|rush|run) attempt successful|\bfor two-point conversion|\btwo[- ]point (?:\w+ )?conversion (?:good|successful)/gi, 8],
  [/\b(?:pass|rush|run) attempt (?:failed|unsuccessful|no good)|\btwo[- ]point (?:\w+ )?conversion (?:failed|no good|unsuccessful)/gi, 6],
];

const touchdownPoints = (text: string, scoreChange?: number): number => {
  let lastAt = -1;
  let points: number | null = null;
  for (const [pattern, value] of TRY_RESULTS) {
    for (const match of text.matchAll(pattern)) {
      const at = match.index ?? -1;
      if (at > lastAt) {
        lastAt = at;
        points = value;
      }
    }
  }
  if (points !== null) return points;
  return scoreChange !== undefined && scoreChange >= 6 && scoreChange <= 8 ? scoreChange : 6;
};

// Scoring / turnover marker for an offensive play. Special teams (field goals)
// are excluded upstream, so those are supplied separately as ScoringEvents.
//
// CFBD usually carries the TD signal in play_type ("Rushing Touchdown" /
// "Passing Touchdown") rather than the word "touchdown" in the text, so we read
// both — the text only for the ruling that stood (see withoutSupersededCalls).
// A touchdown is labeled with what it was worth once its try is counted (see
// touchdownPoints). Defensive scores (pick-sixes,
// fumble-return TDs) are turnovers for the offense, not a TD for the stacked
// team, so the interception check runs first and return/opponent TDs are skipped.
const playMarker = (
  text: string,
  playType: string,
  scoreChange?: number,
): { label: string | null; isScore: boolean } => {
  const t = withoutSupersededCalls(text || '').toLowerCase();
  const pt = (playType || '').toLowerCase();

  if (pt.includes('interception') || t.includes('intercept')) return { label: 'i', isScore: false };

  const isTouchdown = pt.includes('touchdown') || t.includes('touchdown');
  const isDefensiveScore = pt.includes('return') || pt.includes('opponent');
  if (isTouchdown && !isDefensiveScore) {
    return { label: String(touchdownPoints(t, scoreChange)), isScore: true };
  }

  return { label: null, isScore: false };
};

/**
 * Turn a game's plays (plus the field goals, lost fumbles and per-play score
 * changes pulled from the raw feed) into the flat event list the runtime bins
 * and stacks.
 *
 * Classification lives here rather than in the runtime because it only has to
 * happen once: an embed bakes these events and re-bins them as it resizes.
 */
export const toWaveEvents = (
  plays: PlayData[],
  topTeam: string,
  fieldGoals: ScoringEvent[] = [],
  fumbles: ScoringEvent[] = [],
  scoreChanges: Map<string, number> = new Map(),
): WaveEvent[] => {
  const events: WaveEvent[] = [];

  for (const play of plays) {
    const marker = playMarker(play.playText, play.playType, scoreChanges.get(String(play.id)));
    events.push({
      side: play.offense === topTeam ? 'top' : 'bottom',
      quarter: play.quarter,
      minutes: play.clock?.minutes ?? 0,
      seconds: play.clock?.seconds ?? 0,
      outcome: outcomeOf(play),
      label: marker.label,
      isScore: marker.isScore,
      playText: play.playText,
      yardsGained: play.yardsGained,
      down: play.down,
      distance: play.distance,
    });
  }

  for (const fg of fieldGoals) {
    events.push({
      side: fg.team === topTeam ? 'top' : 'bottom',
      quarter: fg.quarter,
      minutes: fg.minutes,
      seconds: fg.seconds,
      outcome: 'fieldGoal',
      label: '3',
      isScore: true,
      playText: 'Field goal good',
      yardsGained: 0,
      down: 0,
      distance: 0,
    });
  }

  for (const fumble of fumbles) {
    events.push({
      side: fumble.team === topTeam ? 'top' : 'bottom',
      quarter: fumble.quarter,
      minutes: fumble.minutes,
      seconds: fumble.seconds,
      outcome: 'fumble',
      label: 'f',
      isScore: false,
      playText: 'Fumble lost',
      yardsGained: 0,
      down: 0,
      distance: 0,
    });
  }

  return events;
};

// Raw play shape from the CFBD /plays feed (field names vary by case).
export interface RawPlayLike {
  id?: string | number;
  offense?: string;
  defense?: string;
  offenseScore?: number | null;
  offense_score?: number | null;
  defenseScore?: number | null;
  defense_score?: number | null;
  play_type?: string;
  playType?: string;
  play_text?: string;
  playText?: string;
  quarter?: number;
  period?: number;
  clock?: { minutes?: number; seconds?: number };
}

export const extractFieldGoals = (rawPlays: RawPlayLike[] = []): ScoringEvent[] => {
  const events: ScoringEvent[] = [];
  for (const play of rawPlays) {
    const type = (play.play_type ?? play.playType ?? '').toLowerCase();
    const text = (play.play_text ?? play.playText ?? '').toLowerCase();
    const isMade = type.includes('field goal')
      ? type.includes('good')
      : text.includes('field goal') && text.includes('good') && !text.includes('no good');
    if (!isMade || !play.offense) continue;
    events.push({
      team: play.offense,
      quarter: play.quarter ?? play.period ?? 1,
      minutes: play.clock?.minutes ?? 0,
      seconds: play.clock?.seconds ?? 0,
    });
  }
  return events;
};

// Lost fumbles (a turnover charged to the offense). CFBD classifies these with a
// dedicated play_type — "Fumble Recovery (Opponent)" or "Fumble Return
// Touchdown" — so they're filtered out of the rush/pass plays and, like field
// goals, are pulled from the raw feed instead. A "Fumble Recovery (Own)" is not
// a turnover and is intentionally excluded.
export const extractFumbles = (rawPlays: RawPlayLike[] = []): ScoringEvent[] => {
  const events: ScoringEvent[] = [];
  for (const play of rawPlays) {
    const type = (play.play_type ?? play.playType ?? '').toLowerCase();
    const isLost = type.includes('fumble') && (type.includes('opponent') || type.includes('return'));
    if (!isLost || !play.offense) continue;
    events.push({
      team: play.offense,
      quarter: play.quarter ?? play.period ?? 1,
      minutes: play.clock?.minutes ?? 0,
      seconds: play.clock?.seconds ?? 0,
    });
  }
  return events;
};

// Points the offense put on the board on each play, keyed by play id, from the
// running score CFBD stamps on every play (after the play). Only a fallback for
// a touchdown whose text never mentions its try — see touchdownPoints. Ids sort
// in game order; length first, since they're numeric strings.
export const extractScoreChanges = (rawPlays: RawPlayLike[] = []): Map<string, number> => {
  const changes = new Map<string, number>();
  const scores = new Map<string, number>();
  const ordered = rawPlays
    .filter(play => play.id !== undefined && play.id !== null && play.offense)
    .sort((a, b) => {
      const x = String(a.id);
      const y = String(b.id);
      return x.length - y.length || x.localeCompare(y);
    });

  for (const play of ordered) {
    const offense = play.offense as string;
    const offenseScore = play.offenseScore ?? play.offense_score;
    const defenseScore = play.defenseScore ?? play.defense_score;
    if (typeof offenseScore !== 'number') continue;
    changes.set(String(play.id), offenseScore - (scores.get(offense) ?? 0));
    scores.set(offense, offenseScore);
    if (play.defense && typeof defenseScore === 'number') scores.set(play.defense, defenseScore);
  }
  return changes;
};
