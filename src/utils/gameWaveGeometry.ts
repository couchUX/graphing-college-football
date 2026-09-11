import { QUARTER_MINUTES, REGULATION_QUARTERS, type GameWaveModel, type WavePoint } from './gameWave';

/**
 * Layout math for the Game Wave, shared by the on-screen SVG and the embed so
 * the copied HTML can't drift from what the page renders.
 *
 * All geometry is expressed in viewBox units where 1 unit = one dot cell; the
 * two renderers only differ in how they turn that into markup.
 */

export const DOT_R = 0.4;
export const QUARTER_GAP = 0.7;
export const LABEL_BAND = 1.9;
export const RIGHT_PAD = 0.6;
// Half-height of the central axis lane reserved for the minute labels; the two
// teams' dots stack above and below it (never into it).
export const AXIS_HALF = 0.625;
// Quarter dividers, matching the warm hairline used by card borders.
export const GRID_COLOR = '#E5E1DB';
export const MINUTE_LABEL_COLOR = '#A8A29B';
export const QUARTER_LABEL_COLOR = '#737373';
export const DOT_LABEL_COLOR = '#374151';

/** The three shades a team's dots are drawn in (from `getDisplayTeamColors`). */
export interface WaveShadeColors {
  explosive: string;
  success: string;
  light: string;
}

export interface WaveMark {
  x: number;
  label: string;
}

export interface WaveGeometry {
  xOf: (column: number) => number;
  yOf: (point: WavePoint) => number;
  vbWidth: number;
  vbHeight: number;
  centerY: number;
  labelY: number;
  minuteLabelY: number;
  quarterMarks: WaveMark[];
  minuteMarks: WaveMark[];
  dividers: number[];
}

/**
 * Width of the viewBox (in dot-cell units) for a given granularity. Mirrors the
 * xOf math in `buildWaveGeometry` so a px-per-cell estimate can be taken before
 * the model for that granularity exists.
 */
export const vbWidthUnits = (segmentsPerQuarter: number, hasOvertime: boolean): number => {
  if (!hasOvertime) {
    const lastRegColumn = REGULATION_QUARTERS * segmentsPerQuarter - 1;
    return lastRegColumn + 0.5 + (REGULATION_QUARTERS - 1) * QUARTER_GAP + RIGHT_PAD;
  }
  const otColumn = REGULATION_QUARTERS * segmentsPerQuarter;
  return otColumn + 0.5 + REGULATION_QUARTERS * QUARTER_GAP + RIGHT_PAD;
};

export const buildWaveGeometry = (model: GameWaveModel): WaveGeometry => {
  const { segmentsPerQuarter: spq, regulationQuarters: reg, columnCount, hasOvertime } = model;
  const otColumn = reg * spq;

  const xOf = (column: number) => {
    const qi = column >= otColumn ? reg : Math.floor(column / spq);
    return column + 0.5 + qi * QUARTER_GAP;
  };

  const displayTop = Math.max(model.topMax, 1);
  const displayBottom = Math.max(model.bottomMax, 1);
  // Center of the reserved axis lane; top dots stack above it, bottom below.
  const centerY = displayTop + AXIS_HALF;

  const yOf = (point: WavePoint) =>
    point.side === 'top'
      ? centerY - AXIS_HALF - point.position + 0.5
      : centerY + AXIS_HALF + point.position - 0.5;

  const vbWidth = xOf(columnCount - 1) + RIGHT_PAD;
  const contentBottom = displayTop + displayBottom + 2 * AXIS_HALF;
  const vbHeight = contentBottom + LABEL_BAND;
  const labelY = contentBottom + 1.05;
  // Minute ticks sit in the reserved central lane between the two stacks,
  // nudged below the exact center to sit optically right.
  const minuteLabelY = centerY + 0.2;

  // Quarter labels centered under each quarter's columns.
  const quarterMarks: WaveMark[] = [];
  for (let qi = 0; qi < reg; qi += 1) {
    const first = qi * spq;
    const last = first + spq - 1;
    quarterMarks.push({ x: (xOf(first) + xOf(last)) / 2, label: `Q${qi + 1}` });
  }
  if (hasOvertime) quarterMarks.push({ x: xOf(otColumn), label: 'OT' });

  // Game-clock ticks down the center lane: one per bin (segment start),
  // including each quarter's 15:00. Rounded to whole minutes; shown without a
  // colon so 3-char labels can't crowd adjacent ticks at the finest binning.
  const minuteMarks: WaveMark[] = [];
  for (let qi = 0; qi < reg; qi += 1) {
    for (let s = 0; s < spq; s += 1) {
      const remaining = Math.round((QUARTER_MINUTES * (spq - s)) / spq);
      minuteMarks.push({ x: xOf(qi * spq + s), label: `${remaining}` });
    }
  }

  // Faint dividers between quarters (and before OT).
  const dividers: number[] = [];
  for (let qi = 1; qi < reg; qi += 1) {
    dividers.push((xOf(qi * spq - 1) + xOf(qi * spq)) / 2);
  }
  if (hasOvertime) dividers.push((xOf(otColumn - 1) + xOf(otColumn)) / 2);

  return { xOf, yOf, vbWidth, vbHeight, centerY, labelY, minuteLabelY, quarterMarks, minuteMarks, dividers };
};

export const waveDotColor = (
  point: WavePoint,
  topColors: WaveShadeColors,
  bottomColors: WaveShadeColors,
): string => {
  const colors = point.side === 'top' ? topColors : bottomColors;
  if (point.isScore) return colors.explosive;
  if (point.outcome === 'explosive') return colors.explosive;
  if (point.outcome === 'success') return colors.success;
  return colors.light;
};

const OUTCOME_LABELS: Record<WavePoint['outcome'], string> = {
  explosive: 'Explosive',
  fieldGoal: 'Field goal',
  fumble: 'Fumble lost',
  success: 'Successful',
  other: 'Unsuccessful',
};

/** Hover text for a dot: who, what happened, and the play description. */
export const waveDotTooltip = (point: WavePoint): string => {
  const situation = point.down ? ` (${point.yardsGained} yds on ${point.down} & ${point.distance})` : '';
  return `${point.team} — ${OUTCOME_LABELS[point.outcome]}${situation}\n${point.playText}`;
};
