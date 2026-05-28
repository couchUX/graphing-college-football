import type { PlayData } from '../types';

export type WaveSide = 'top' | 'bottom';
export type WaveOutcome = 'explosive' | 'success' | 'other';

export interface WavePoint {
  x: number;
  y: number;
  side: WaveSide;
  team: string;
  outcome: WaveOutcome;
  label: string | null; // scoring / turnover marker drawn inside the dot
  playText: string;
  yardsGained: number;
  down: number;
  distance: number;
  quarter: number;
}

export interface GameWaveModel {
  points: WavePoint[];
  columnLabels: string[];
  columnCount: number;
  topMax: number;
  bottomMax: number;
  hasOvertime: boolean;
}

const QUARTER_MINUTES = 15;
const SEGMENTS_PER_QUARTER = 5; // 3-minute bins
const REGULATION_QUARTERS = 4;
const SEGMENT_TICK_LABELS = ['', '12', '09', '06', '03'];

// Which 3-minute bin within a quarter a play falls into (0 = first 3 min).
const segmentIndex = (minutes: number, seconds: number): number => {
  const elapsed = QUARTER_MINUTES - (minutes + seconds / 60);
  const idx = Math.floor(elapsed / 3);
  return Math.max(0, Math.min(SEGMENTS_PER_QUARTER - 1, idx));
};

// Best-effort scoring / turnover marker from play text (special teams are
// excluded upstream, so field goals won't appear here).
const scoreLabel = (text: string): string | null => {
  const t = (text || '').toLowerCase();
  if (t.includes('touchdown')) return '7';
  if (t.includes('intercept')) return 'i';
  if (t.includes('fumble') && t.includes('recovered by')) return 'f';
  return null;
};

const outcomeOf = (play: PlayData): WaveOutcome =>
  play.explosiveness ? 'explosive' : play.success ? 'success' : 'other';

export const buildGameWave = (plays: PlayData[], topTeam: string): GameWaveModel => {
  const regulationColumns = REGULATION_QUARTERS * SEGMENTS_PER_QUARTER;
  const hasOvertime = plays.some((p) => p.quarter > REGULATION_QUARTERS);
  const otColumn = regulationColumns;
  const columnCount = regulationColumns + (hasOvertime ? 1 : 0);

  const topStacks = new Array(columnCount).fill(0);
  const bottomStacks = new Array(columnCount).fill(0);
  const points: WavePoint[] = [];

  for (const play of plays) {
    const side: WaveSide = play.offense === topTeam ? 'top' : 'bottom';

    let column: number;
    if (play.quarter > REGULATION_QUARTERS) {
      column = otColumn;
    } else {
      const q = Math.max(1, Math.min(REGULATION_QUARTERS, play.quarter));
      const seg = segmentIndex(play.clock?.minutes ?? 0, play.clock?.seconds ?? 0);
      column = (q - 1) * SEGMENTS_PER_QUARTER + seg;
    }

    const stacks = side === 'top' ? topStacks : bottomStacks;
    stacks[column] += 1;
    const stack = stacks[column];

    points.push({
      x: column,
      y: side === 'top' ? stack : -stack,
      side,
      team: play.offense,
      outcome: outcomeOf(play),
      label: scoreLabel(play.playText),
      playText: play.playText,
      yardsGained: play.yardsGained,
      down: play.down,
      distance: play.distance,
      quarter: play.quarter,
    });
  }

  const columnLabels = Array.from({ length: columnCount }, (_, c) => {
    if (hasOvertime && c === otColumn) return 'OT';
    const seg = c % SEGMENTS_PER_QUARTER;
    const quarter = Math.floor(c / SEGMENTS_PER_QUARTER) + 1;
    return seg === 0 ? `Q${quarter}` : SEGMENT_TICK_LABELS[seg];
  });

  return {
    points,
    columnLabels,
    columnCount,
    topMax: Math.max(0, ...topStacks),
    bottomMax: Math.max(0, ...bottomStacks),
    hasOvertime,
  };
};
