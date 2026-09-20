import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { PlayData } from '../types';
import { classifyPlayType } from '../utils/playType';

/**
 * The all-plays list, with a filter control per column.
 *
 * Columns declare how they filter: a dropdown of the values actually present
 * (down, offense, play type...), a substring box (names, play text), or a
 * numeric expression (yards, distance, the cumulative rates). Every filter is
 * an AND, so "Offense = Texas" + "Down = 3" answers the common question —
 * show me this team's third downs — in two clicks.
 */

type FilterKind = 'select' | 'text' | 'number';

interface Column {
  key: string;
  label: string;
  filter: FilterKind;
  /** The value both shown and filtered on, so what you see is what you match. */
  value: (play: PlayData) => string | number;
  /** Optional richer cell; falls back to `value`. */
  render?: (play: PlayData) => React.ReactNode;
  cellClass?: string;
  /** Extra width for columns whose dropdown holds long values (team names). */
  filterClass?: string;
}

const pct = (n: number) => Number((n * 100).toFixed(1));

const COLUMNS: Column[] = [
  { key: 'playNumber', label: 'Play #', filter: 'number', value: p => p.playNumber },
  { key: 'teamPlayNumber', label: 'Team play #', filter: 'number', value: p => p.teamPlayNumber },
  { key: 'id', label: 'ID', filter: 'text', value: p => p.id },
  { key: 'driveNumber', label: 'Drive', filter: 'number', value: p => p.driveNumber },
  { key: 'playInDrive', label: 'Play in drive', filter: 'number', value: p => p.playInDrive },
  { key: 'quarter', label: 'Quarter', filter: 'select', value: p => p.quarter },
  { key: 'down', label: 'Down', filter: 'select', value: p => p.down },
  { key: 'distance', label: 'Distance', filter: 'number', value: p => p.distance },
  { key: 'offense', label: 'Offense', filter: 'select', value: p => p.offense, filterClass: 'min-w-[120px]' },
  { key: 'defense', label: 'Defense', filter: 'select', value: p => p.defense, filterClass: 'min-w-[120px]' },
  {
    key: 'playType',
    label: 'Play type',
    filter: 'select',
    value: p => classifyPlayType(p.playType),
    render: p => (
      <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-neutral-700">
        {classifyPlayType(p.playType)}
      </span>
    ),
  },
  { key: 'rusher', label: 'Rusher', filter: 'text', value: p => p.rusher || '—' },
  { key: 'passer', label: 'Passer', filter: 'text', value: p => p.passer || '—' },
  { key: 'receiver', label: 'Receiver', filter: 'text', value: p => p.receiver || '—' },
  { key: 'yardsGained', label: 'Yards', filter: 'number', value: p => p.yardsGained },
  { key: 'success', label: 'Success', filter: 'select', value: p => (p.success ? 'Yes' : 'No') },
  { key: 'explosiveness', label: 'Explosive', filter: 'select', value: p => (p.explosiveness ? 'Yes' : 'No') },
  { key: 'teamSR', label: 'Team SR', filter: 'number', value: p => pct(p.teamCumulativeSR), render: p => `${pct(p.teamCumulativeSR).toFixed(1)}%` },
  { key: 'teamXR', label: 'Team XR', filter: 'number', value: p => pct(p.teamCumulativeXR), render: p => `${pct(p.teamCumulativeXR).toFixed(1)}%` },
  { key: 'rushRate', label: 'Rush rate', filter: 'number', value: p => pct(p.teamCumulativeRushRate), render: p => `${pct(p.teamCumulativeRushRate).toFixed(1)}%` },
  { key: 'rushSR', label: 'Rush SR', filter: 'number', value: p => pct(p.teamRushCumulativeSR), render: p => `${pct(p.teamRushCumulativeSR).toFixed(1)}%` },
  { key: 'passSR', label: 'Pass SR', filter: 'number', value: p => pct(p.teamPassCumulativeSR), render: p => `${pct(p.teamPassCumulativeSR).toFixed(1)}%` },
  {
    key: 'playText',
    label: 'Play text',
    filter: 'text',
    value: p => p.playText,
    cellClass: 'max-w-2xl truncate',
    filterClass: 'min-w-[200px]',
  },
];

/**
 * Numeric filter expressions: `15` exact, `>15`, `>=15`, `<0`, `<=3`, or
 * `10-20` for an inclusive range. A half-typed expression (`>`, `10-`) matches
 * everything rather than blanking the table mid-keystroke.
 */
const matchesNumber = (expr: string, value: number): boolean => {
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

const matchesFilter = (column: Column, expr: string, play: PlayData): boolean => {
  if (!expr) return true;
  const value = column.value(play);
  if (column.filter === 'number') return matchesNumber(expr, Number(value));
  if (column.filter === 'select') return String(value) === expr;
  return String(value).toLowerCase().includes(expr.trim().toLowerCase());
};

const FILTER_CLASS =
  'w-full min-w-[80px] rounded border border-neutral-300 bg-surface px-1.5 py-1 text-xs font-normal ' +
  'text-ink transition-colors placeholder:text-neutral-400 hover:border-neutral-400 ' +
  'focus:border-accent focus:outline-none';

interface AllPlaysTableProps {
  plays: PlayData[];
}

const AllPlaysTable: React.FC<AllPlaysTableProps> = ({ plays }) => {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const setFilter = (key: string, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  // Dropdown options come from every play, not the filtered set, so narrowing
  // one column never strands you with a dropdown you can't back out of.
  const options = useMemo(() => {
    const byColumn: Record<string, string[]> = {};
    COLUMNS.filter(c => c.filter === 'select').forEach(column => {
      const values = new Set<string>();
      plays.forEach(play => values.add(String(column.value(play))));
      byColumn[column.key] = [...values].sort((a, b) => {
        const [na, nb] = [Number(a), Number(b)];
        return Number.isNaN(na) || Number.isNaN(nb) ? a.localeCompare(b) : na - nb;
      });
    });
    return byColumn;
  }, [plays]);

  const visiblePlays = useMemo(
    () => plays.filter(play => COLUMNS.every(column => matchesFilter(column, filters[column.key] || '', play))),
    [plays, filters]
  );

  const activeCount = COLUMNS.filter(c => filters[c.key]).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <h3 className="text-[15px] font-semibold text-ink">
          Processed plays — rush and pass only, with player names ({plays.length} total)
        </h3>
        <div className="flex items-center gap-3 text-sm text-byline">
          <span>
            {activeCount > 0
              ? `Showing ${visiblePlays.length} of ${plays.length} plays`
              : 'Filter any column below'}
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters({})}
              className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
            >
              <X className="h-3 w-3" />
              Clear {activeCount === 1 ? 'filter' : `all ${activeCount} filters`}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        <div className="max-h-[492px] overflow-auto">
          <table className="min-w-full divide-y divide-hairline text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-100">
              <tr>
                {COLUMNS.map(column => (
                  <th key={column.key} scope="col" className="whitespace-nowrap px-3 pb-1.5 pt-2 text-left text-xs font-semibold text-byline">
                    {column.label}
                  </th>
                ))}
              </tr>
              <tr>
                {COLUMNS.map(column => (
                  <td key={column.key} className="px-3 pb-2 align-top">
                    {column.filter === 'select' ? (
                      <select
                        value={filters[column.key] || ''}
                        onChange={e => setFilter(column.key, e.target.value)}
                        aria-label={`Filter by ${column.label}`}
                        className={`${FILTER_CLASS} ${column.filterClass || ''}`}
                      >
                        <option value="">All</option>
                        {(options[column.key] || []).map(value => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        inputMode={column.filter === 'number' ? 'text' : undefined}
                        value={filters[column.key] || ''}
                        onChange={e => setFilter(column.key, e.target.value)}
                        aria-label={
                          column.filter === 'number'
                            ? `Filter by ${column.label} — a number, or an expression like >15 or 10-20`
                            : `Filter by ${column.label}`
                        }
                        placeholder={column.filter === 'number' ? 'e.g. >15' : 'Contains…'}
                        title={
                          column.filter === 'number'
                            ? 'Exact (15), comparison (>15, <=3) or range (10-20)'
                            : undefined
                        }
                        className={`${FILTER_CLASS} ${column.filterClass || ''}`}
                      />
                    )}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {visiblePlays.map((play, index) => (
                <tr key={play.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-neutral-50'}>
                  {COLUMNS.map(column => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 ${column.cellClass || 'whitespace-nowrap'}`}
                      title={column.cellClass?.includes('truncate') ? String(column.value(play)) : undefined}
                    >
                      {column.render ? column.render(play) : column.value(play)}
                    </td>
                  ))}
                </tr>
              ))}
              {visiblePlays.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-sm text-byline">
                    No plays match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllPlaysTable;
