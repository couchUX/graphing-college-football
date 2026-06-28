import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter, Radar } from 'react-chartjs-2';
import { AlertCircle, ChevronDown, Copy, Check, Search } from 'lucide-react';
import type { Detector, DetectorFilters, DetectorResult } from '../detectors/types';
import { buildStandaloneHtml } from '../utils/standaloneChartHtml';
import { initializeChartDefaults } from '../utils/chartConfig';
import { useIsMobile } from '../hooks/useIsMobile';

initializeChartDefaults();

const DEFAULT_CHART_HEIGHT = 360;

/**
 * On phones, charts shouldn't sprawl vertically. Scatter/X-Y plots get the most
 * aggressive cap — they read fine as a compact square — while listing bar charts
 * keep more height so each row label stays legible (but still tighten vs desktop).
 * Desktop heights are returned unchanged so the embed/standalone export and the
 * large-screen layout are unaffected.
 */
const responsiveChartHeight = (
  type: DetectorResult['chart']['type'],
  desktopHeight: number,
  isMobile: boolean
): number => {
  if (!isMobile) return desktopHeight;
  if (type === 'bar') {
    // Listing bars: tighten ~20% but keep a floor so short lists stay readable.
    return Math.max(260, Math.round(desktopHeight * 0.8));
  }
  // Scatter and other proportional charts: a compact square is plenty on mobile.
  return Math.min(desktopHeight, 280);
};

interface Props {
  detector: Detector;
  filters: DetectorFilters;
  onCopySuccess: (message: string) => void;
  onCopyError: (message: string) => void;
}

const DIMMED = '#d1d5db'; // neutral-300 for non-matching points

/**
 * When a search term is active on a searchable chart, return a chart with
 * non-matching points dimmed. Trend/line datasets pass through unchanged.
 */
const applySearchHighlight = (
  result: DetectorResult,
  term: string
): DetectorResult => {
  if (!result.chart.searchable || !term.trim()) return result;
  const needle = term.trim().toLowerCase();
  const field = result.chart.searchable.matchField ?? 'team';

  const data = result.chart.data as any;
  if (!data?.datasets?.length) return result;

  const cloned = {
    ...result,
    chart: {
      ...result.chart,
      data: {
        ...data,
        datasets: data.datasets.map((ds: any) => {
          // Only highlight datasets whose points carry the search field.
          const points = ds.data || [];
          if (!points.length || typeof points[0] !== 'object' || !(field in points[0])) {
            return ds;
          }
          const matches = points.map((p: any) =>
            String(p[field] ?? '').toLowerCase().includes(needle)
          );
          const origBg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : null;
          const origBd = Array.isArray(ds.borderColor) ? ds.borderColor : null;
          return {
            ...ds,
            backgroundColor: points.map((_p: any, i: number) =>
              matches[i] ? origBg?.[i] ?? ds.backgroundColor : DIMMED
            ),
            borderColor: points.map((_p: any, i: number) =>
              matches[i] ? origBd?.[i] ?? ds.borderColor : DIMMED
            ),
            pointRadius: points.map((_p: any, i: number) => (matches[i] ? 7 : 3)),
            pointHoverRadius: points.map((_p: any, i: number) => (matches[i] ? 10 : 5)),
          };
        }),
      },
    },
  };
  return cloned;
};

const renderChart = (result: DetectorResult) => {
  const { type, data, options } = result.chart;
  const common = { data: data as any, options: options as any };

  switch (type) {
    case 'line':
      return <Line {...common} />;
    case 'pie':
      return <Pie {...common} />;
    case 'doughnut':
      return <Doughnut {...common} />;
    case 'scatter':
      return <Scatter {...common} />;
    case 'radar':
      return <Radar {...common} />;
    case 'bar':
    default:
      return <Bar {...common} />;
  }
};

const DiscoverCard: React.FC<Props> = ({ detector, filters, onCopySuccess, onCopyError }) => {
  const [result, setResult] = useState<DetectorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearch('');

    detector
      .run(filters)
      .then(r => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error(`Detector ${detector.id} failed:`, err);
          setError(err?.message || 'Failed to load this insight.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detector, filters]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const displayResult = useMemo(
    () => (result ? applySearchHighlight(result, search) : null),
    [result, search]
  );

  const handleCopy = async () => {
    if (!result) return;
    const html = buildStandaloneHtml(result);
    try {
      if (!navigator.clipboard?.writeText) {
        onCopyError('Clipboard not available in this browser');
        return;
      }
      await navigator.clipboard.writeText(html);
      setCopied(true);
      onCopySuccess(`Embed code copied for ${result.headline}`);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      onCopyError('Failed to copy embed code. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header — full-bleed bottom border already comes from the next div */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-neutral-100">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-900 truncate">
            {result?.headline || detector.title}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {result?.subtext || detector.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleCopy}
            disabled={!result || loading}
            aria-label={copied ? 'Embed code copied' : 'Copy embed code'}
            title={copied ? 'Copied!' : 'Copy embed code'}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 ${
              copied
                ? 'border-emerald-300 bg-emerald-500/90 text-white shadow-sm'
                : 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Body — chart area grows to fill */}
      <div className="px-5 pt-5 pb-5 flex-1 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center py-16 text-neutral-500 text-sm">
            Loading insight…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Couldn't load this insight</div>
              <div className="text-xs mt-0.5 text-red-700">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && displayResult && (
          <>
            {displayResult.chart.searchable && (
              <div className="mb-3 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={displayResult.chart.searchable.placeholder || 'Search a team to highlight'}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
                />
              </div>
            )}
            <div
              className="relative"
              style={{
                height: responsiveChartHeight(
                  displayResult.chart.type,
                  displayResult.chart.height ?? DEFAULT_CHART_HEIGHT,
                  isMobile
                ),
              }}
            >
              {renderChart(displayResult)}
            </div>
          </>
        )}
      </div>

      {/* Details drawer — full-bleed top border, sticks to bottom of card */}
      {!loading && !error && result?.rows && result.rows.length > 0 && (
        <details className="group border-t border-neutral-100 mt-auto">
          <summary className="flex items-center cursor-pointer list-none select-none px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <ChevronDown className="h-4 w-4 mr-2 transition-transform group-open:rotate-0 -rotate-90" />
            Show details ({result.rows.length})
          </summary>
          <div className="px-5 pb-4">
            <table className="w-full text-sm">
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-neutral-900">{row.label}</td>
                    <td className="py-2 pr-3 text-neutral-700">{row.value}</td>
                    {row.hint && (
                      <td className="py-2 text-xs text-neutral-500 text-right">{row.hint}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
};

export default DiscoverCard;
