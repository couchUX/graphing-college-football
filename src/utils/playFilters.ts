/**
 * Matching rules for the all-plays table's per-column filters.
 *
 * Kept apart from the table itself so the grammar can be exercised on its own
 * — `npm run check:filters` builds this module and runs the cases against it.
 * Everything here is pure: a filter expression and one cell's value in, a
 * boolean out.
 */

export type PlayFilterKind = 'select' | 'text' | 'number';

/**
 * Numeric filter expressions: `15` exact, `>15`, `>=15`, `<0`, `<=3`, or
 * `10-20` for an inclusive range (also written `10..20`, `10–20` or `10 to 20`,
 * and accepted in either order). A half-typed expression (`>`, `10-`, `abc`)
 * matches everything rather than blanking the table mid-keystroke.
 */
export const matchesNumber = (expr: string, value: number): boolean => {
  const text = expr.trim();
  if (!text) return true;

  const comparison = text.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (comparison) {
    const n = Number(comparison[2]);
    switch (comparison[1]) {
      case '>': return value > n;
      case '>=': return value >= n;
      case '<': return value < n;
      case '<=': return value <= n;
      default: return value === n;
    }
  }

  const range = text.match(/^(-?\d+(?:\.\d+)?)\s*(?:\.\.|–|-|to)\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const [low, high] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
    return value >= low && value <= high;
  }

  const exact = Number(text);
  return Number.isNaN(exact) ? true : value === exact;
};

/** Case-insensitive substring, on the text the cell actually shows. */
export const matchesText = (expr: string, value: string): boolean => {
  const text = expr.trim().toLowerCase();
  return !text || value.toLowerCase().includes(text);
};

/** Dispatch on the column's filter kind. An empty expression never excludes. */
export const matchesPlayFilter = (
  kind: PlayFilterKind,
  expr: string,
  value: string | number
): boolean => {
  if (!expr) return true;
  if (kind === 'number') return matchesNumber(expr, Number(value));
  if (kind === 'select') return String(value) === expr;
  return matchesText(expr, String(value));
};
