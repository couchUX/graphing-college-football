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

// Scoring / turnover marker for an offensive play. Special teams (field goals)
// are excluded upstream, so those are supplied separately as ScoringEvents.
//
// CFBD usually carries the TD signal in play_type ("Rushing Touchdown" /
// "Passing Touchdown") rather than the word "touchdown" in the text, so we read
// both. A touchdown counts as 6 here — the PAT kick isn't a rush/pass play and a
// 2-pt try comes through as its own play. Defensive scores (pick-sixes,
// fumble-return TDs) are turnovers for the offense, not a TD for the stacked
// team, so the interception check runs first and return/opponent TDs are skipped.
const playMarker = (text: string, playType: string): { label: string | null; isScore: boolean } => {
  const t = (text || '').toLowerCase();
  const pt = (playType || '').toLowerCase();

  if (pt.includes('interception') || t.includes('intercept')) return { label: 'i', isScore: false };

  const isTouchdown = pt.includes('touchdown') || t.includes('touchdown');
  const isDefensiveScore = pt.includes('return') || pt.includes('opponent');
  if (isTouchdown && !isDefensiveScore) return { label: '6', isScore: true };

  return { label: null, isScore: false };
};

/**
 * Turn a game's plays (plus the field goals and lost fumbles pulled from the
 * raw feed) into the flat event list the runtime bins and stacks.
 *
 * Classification lives here rather than in the runtime because it only has to
 * happen once: an embed bakes these events and re-bins them as it resizes.
 */
export const toWaveEvents = (
  plays: PlayData[],
  topTeam: string,
  fieldGoals: ScoringEvent[] = [],
  fumbles: ScoringEvent[] = [],
): WaveEvent[] => {
  const events: WaveEvent[] = [];

  for (const play of plays) {
    const marker = playMarker(play.playText, play.playType);
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
  offense?: string;
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
