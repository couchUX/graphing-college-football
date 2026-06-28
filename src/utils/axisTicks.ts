/**
 * Evenly-spaced "nice" tick bounds for a linear axis, guaranteed to place a
 * tick at the (snapped) center of the range. This makes scatter plots read as
 * rough quadrants instead of having gridlines land on arbitrary, uneven
 * increments (e.g. 11% / 15% / 24%).
 *
 * The result is symmetric: an equal number of equally-spaced ticks on each side
 * of the center tick, with `min`/`max` extended to the outer ticks so the
 * gridlines reach the chart edges and every data point stays in view. Returned
 * values are plain numbers (`min`/`max`/`stepSize`) so they survive JSON
 * serialization for the standalone embed export — no tick callback required.
 */
export interface QuadrantTicks {
  min: number;
  max: number;
  stepSize: number;
}

// Round a positive number to a "nice" 1 / 2 / 2.5 / 5 × 10^n value.
const niceStep = (rough: number): number => {
  if (rough <= 0 || !Number.isFinite(rough)) return 1;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const frac = rough / base; // in [1, 10)
  let niceFrac: number;
  if (frac < 1.5) niceFrac = 1;
  else if (frac < 2.25) niceFrac = 2;
  else if (frac < 3.5) niceFrac = 2.5;
  else if (frac < 7.5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
};

export const buildQuadrantTicks = (
  dataMin: number,
  dataMax: number,
  targetIntervals = 4
): QuadrantTicks => {
  const span = dataMax - dataMin || Math.abs(dataMax) || 1;
  const step = niceStep(span / targetIntervals);
  const center = (dataMin + dataMax) / 2;
  // Snap the center onto the step grid so the middle tick is a clean value.
  const centerSnapped = Math.round(center / step) * step;

  // Expand symmetrically until both data extremes sit strictly inside the
  // outer ticks (floor + 1 guarantees a margin so edge points aren't clipped).
  const stepsEachSide = Math.max(
    1,
    Math.floor((centerSnapped - dataMin) / step) + 1,
    Math.floor((dataMax - centerSnapped) / step) + 1
  );

  // toPrecision tames floating-point drift (e.g. 0.30000000000000004).
  const round = (v: number) => Number(v.toPrecision(12));

  return {
    min: round(centerSnapped - stepsEachSide * step),
    max: round(centerSnapped + stepsEachSide * step),
    stepSize: round(step),
  };
};
