import type { PlayData } from '../types';

export type WaveSide = 'top' | 'bottom';
export type WaveOutcome = 'explosive' | 'success' | 'other' | 'fieldGoal' | 'fumble';

export interface WavePoint {
  column: number; // 0-based time bin
  position: number; // stack distance from the center line, 1-based
  side: WaveSide;
  team: string;
  outcome: WaveOutcome;
  label: string | null; // text drawn inside the dot (e.g. '7', '3', 'i')
  isScore: boolean;
  playText: string;
  yardsGained: number;
  down: number;
  distance: number;
}

export interface ScoringEvent {
  team: string;
  quarter: number;
  minutes: number;
  seconds: number;
}

export interface GameWaveModel {
  points: WavePoint[];
  columnCount: number;
  segmentsPerQuarter: number;
  regulationQuarters: number;
  topMax: number;
  bottomMax: number;
  hasOvertime: boolean;
}

const QUARTER_MINUTES = 15;
// Default clock tranches per quarter (~2.1 min each). The chart picks a finer
// or coarser value at render time based on how wide its container is.
export const DEFAULT_SEGMENTS_PER_QUARTER = 7;
const REGULATION_QUARTERS = 4;

const segmentIndex = (minutes: number, seconds: number, segmentsPerQuarter: number): number => {
  const segmentMinutes = QUARTER_MINUTES / segmentsPerQuarter;
  const elapsed = QUARTER_MINUTES - (minutes + seconds / 60);
  const idx = Math.floor(elapsed / segmentMinutes);
  return Math.max(0, Math.min(segmentsPerQuarter - 1, idx));
};

const columnFor = (quarter: number, minutes: number, seconds: number, segmentsPerQuarter: number): number => {
  const otColumn = REGULATION_QUARTERS * segmentsPerQuarter;
  if (quarter > REGULATION_QUARTERS) return otColumn;
  const q = Math.max(1, Math.min(REGULATION_QUARTERS, quarter));
  return (q - 1) * segmentsPerQuarter + segmentIndex(minutes, seconds, segmentsPerQuarter);
};

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

// Lower rank sits closer to the center line: explosive/scoring, then
// successful, then unsuccessful.
const rankOf = (outcome: WaveOutcome, isScore: boolean): number => {
  if (isScore || outcome === 'explosive' || outcome === 'fieldGoal') return 0;
  if (outcome === 'success') return 1;
  return 2;
};

interface Entry {
  side: WaveSide;
  column: number;
  team: string;
  outcome: WaveOutcome;
  label: string | null;
  isScore: boolean;
  playText: string;
  yardsGained: number;
  down: number;
  distance: number;
  seq: number;
}

export const buildGameWave = (
  plays: PlayData[],
  topTeam: string,
  fieldGoals: ScoringEvent[] = [],
  segmentsPerQuarter: number = DEFAULT_SEGMENTS_PER_QUARTER,
  fumbles: ScoringEvent[] = [],
): GameWaveModel => {
  const otColumn = REGULATION_QUARTERS * segmentsPerQuarter;
  const entries: Entry[] = [];
  let seq = 0;

  for (const play of plays) {
    const marker = playMarker(play.playText, play.playType);
    entries.push({
      side: play.offense === topTeam ? 'top' : 'bottom',
      column: columnFor(play.quarter, play.clock?.minutes ?? 0, play.clock?.seconds ?? 0, segmentsPerQuarter),
      team: play.offense,
      outcome: outcomeOf(play),
      label: marker.label,
      isScore: marker.isScore,
      playText: play.playText,
      yardsGained: play.yardsGained,
      down: play.down,
      distance: play.distance,
      seq: seq++,
    });
  }

  for (const fg of fieldGoals) {
    entries.push({
      side: fg.team === topTeam ? 'top' : 'bottom',
      column: columnFor(fg.quarter, fg.minutes, fg.seconds, segmentsPerQuarter),
      team: fg.team,
      outcome: 'fieldGoal',
      label: '3',
      isScore: true,
      playText: 'Field goal good',
      yardsGained: 0,
      down: 0,
      distance: 0,
      seq: seq++,
    });
  }

  for (const fumble of fumbles) {
    entries.push({
      side: fumble.team === topTeam ? 'top' : 'bottom',
      column: columnFor(fumble.quarter, fumble.minutes, fumble.seconds, segmentsPerQuarter),
      team: fumble.team,
      outcome: 'fumble',
      label: 'f',
      isScore: false,
      playText: 'Fumble lost',
      yardsGained: 0,
      down: 0,
      distance: 0,
      seq: seq++,
    });
  }

  const hasOvertime = entries.some((e) => e.column === otColumn);
  const columnCount = otColumn + (hasOvertime ? 1 : 0);

  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${entry.side}:${entry.column}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const points: WavePoint[] = [];
  let topMax = 0;
  let bottomMax = 0;

  for (const group of groups.values()) {
    group.sort((a, b) => rankOf(a.outcome, a.isScore) - rankOf(b.outcome, b.isScore) || a.seq - b.seq);
    group.forEach((entry, index) => {
      const position = index + 1;
      if (entry.side === 'top') topMax = Math.max(topMax, position);
      else bottomMax = Math.max(bottomMax, position);
      points.push({
        column: entry.column,
        position,
        side: entry.side,
        team: entry.team,
        outcome: entry.outcome,
        label: entry.label,
        isScore: entry.isScore,
        playText: entry.playText,
        yardsGained: entry.yardsGained,
        down: entry.down,
        distance: entry.distance,
      });
    });
  }

  return {
    points,
    columnCount,
    segmentsPerQuarter,
    regulationQuarters: REGULATION_QUARTERS,
    topMax,
    bottomMax,
    hasOvertime,
  };
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
