import type { PlayData } from '../types';

export type WaveSide = 'top' | 'bottom';
export type WaveOutcome = 'explosive' | 'success' | 'other' | 'fieldGoal';

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
const SEGMENTS_PER_QUARTER = 7; // clock tranches per quarter (~2.1 min each)
const SEGMENT_MINUTES = QUARTER_MINUTES / SEGMENTS_PER_QUARTER;
const REGULATION_QUARTERS = 4;
const OT_COLUMN = REGULATION_QUARTERS * SEGMENTS_PER_QUARTER;

const segmentIndex = (minutes: number, seconds: number): number => {
  const elapsed = QUARTER_MINUTES - (minutes + seconds / 60);
  const idx = Math.floor(elapsed / SEGMENT_MINUTES);
  return Math.max(0, Math.min(SEGMENTS_PER_QUARTER - 1, idx));
};

const columnFor = (quarter: number, minutes: number, seconds: number): number => {
  if (quarter > REGULATION_QUARTERS) return OT_COLUMN;
  const q = Math.max(1, Math.min(REGULATION_QUARTERS, quarter));
  return (q - 1) * SEGMENTS_PER_QUARTER + segmentIndex(minutes, seconds);
};

const outcomeOf = (play: PlayData): WaveOutcome =>
  play.explosiveness ? 'explosive' : play.success ? 'success' : 'other';

// Scoring / turnover marker from play text. Special teams (field goals) are
// excluded upstream, so those are supplied separately as ScoringEvents.
const playMarker = (text: string): { label: string | null; isScore: boolean } => {
  const t = (text || '').toLowerCase();
  if (t.includes('touchdown')) return { label: '7', isScore: true };
  if (t.includes('intercept')) return { label: 'i', isScore: false };
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
): GameWaveModel => {
  const entries: Entry[] = [];
  let seq = 0;

  for (const play of plays) {
    const marker = playMarker(play.playText);
    entries.push({
      side: play.offense === topTeam ? 'top' : 'bottom',
      column: columnFor(play.quarter, play.clock?.minutes ?? 0, play.clock?.seconds ?? 0),
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
      column: columnFor(fg.quarter, fg.minutes, fg.seconds),
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

  const hasOvertime = entries.some((e) => e.column === OT_COLUMN);
  const columnCount = OT_COLUMN + (hasOvertime ? 1 : 0);

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
    segmentsPerQuarter: SEGMENTS_PER_QUARTER,
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
      : text.includes('field goal') && text.includes('good');
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
