import React, { useEffect, useState } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter, Radar } from 'react-chartjs-2';
import { ExternalLink, RefreshCcw, AlertCircle, ChevronDown } from 'lucide-react';
import type { Detector, DetectorFilters, DetectorResult } from '../detectors/types';
import { openStandalone } from '../utils/standaloneChartHtml';
import { initializeChartDefaults } from '../utils/chartConfig';

initializeChartDefaults();

interface Props {
  detector: Detector;
  filters: DetectorFilters;
}

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

const DiscoverCard: React.FC<Props> = ({ detector, filters }) => {
  const [result, setResult] = useState<DetectorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

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
  }, [detector, filters, reloadKey]);

  const handleOpenStandalone = () => {
    if (result) openStandalone(result);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 flex items-start justify-between gap-3">
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
            onClick={() => setReloadKey(k => k + 1)}
            disabled={loading}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Refresh"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenStandalone}
            disabled={!result || loading}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title="Open standalone chart in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open standalone</span>
          </button>
        </div>
      </div>

      <div className="p-5">
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

        {!loading && !error && result && (
          <>
            <div
              className="relative"
              style={{ height: result.chart.height ?? 360 }}
            >
              {renderChart(result)}
            </div>

            {result.rows && result.rows.length > 0 && (
              <details className="group mt-5 border-t border-neutral-100 pt-3">
                <summary className="flex items-center justify-between cursor-pointer list-none select-none py-1 text-sm font-medium text-neutral-700 hover:text-neutral-900">
                  <span className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-0 -rotate-90" />
                    Show details ({result.rows.length})
                  </span>
                </summary>
                <table className="w-full text-sm mt-3">
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
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DiscoverCard;
