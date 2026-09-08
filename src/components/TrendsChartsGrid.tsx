import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import { createBaseOptions } from '../utils/chartOptions';
import { percentCallback } from '../utils/chartConfig';
import { generateTrendsEmbedCode, TrendsEmbedOptions } from '../utils/trendsEmbedGenerator';
import { generateChartEmbed } from '../utils/chartEmbedGenerator';
import { CHART_HEIGHTS } from '../constants/chartDimensions';

interface TrendsChartsGridProps {
  chartData: any; // Type from useSeasonChartData hook
  team: string;
  year: number;
  gamesCount: number;
  selectedTeamColor?: string;
  // One-game Team vs. Team: Rush Rate renders as grouped columns when
  // perGameChartType is 'bar', and the SR/XR-by-game and play-type line charts
  // are hidden (a single point isn't meaningful) when hidePerGameLines is true.
  perGameChartType?: 'line' | 'bar';
  hidePerGameLines?: boolean;
  // Views that reuse this grid (Team vs. Team) pass overrides so embeds link
  // back to the right page and use the right wording.
  embedOptions?: TrendsEmbedOptions;
}

// Chart options for bar charts (XR overlaps SR, matching Games page)
const barChartOptions = {
  ...createBaseOptions(),
  scales: {
    x: {
      grid: {
        display: false
      }
    },
    y: {
      stacked: false,
      max: 1,
      min: 0,
      ticks: { callback: percentCallback }
    }
  }
};

// Chart options for line charts with rotated labels
const lineChartOptionsWithRotatedLabels = {
  ...createBaseOptions(),
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        maxRotation: 45,
        minRotation: 45,
        font: { size: 11 }
      }
    },
    y: {
      max: 100,
      min: 0,
      ticks: {
        callback: (value: number) => value + '%'
      }
    }
  },
  elements: {
    line: { tension: 0.15, borderWidth: 2.5 },
    point: { radius: 4 }
  },
  plugins: {
    ...createBaseOptions().plugins,
    tooltip: {
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          // Values are already in 0-100 range, just add % sign
          if (context.parsed.y !== null) {
            label += context.parsed.y.toFixed(1) + '%';
          }
          return label;
        }
      }
    }
  }
};

type PlayTypeFilter = 'all' | 'rush' | 'pass';

const PLAY_TYPE_OPTIONS: { value: PlayTypeFilter; label: string }[] = [
  { value: 'all', label: 'Rush & Pass' },
  { value: 'rush', label: 'Rush only' },
  { value: 'pass', label: 'Pass only' }
];

// Keep only the datasets for the selected play type. Reference series
// (NCAA average, etc.) aren't play-type specific, so they always stay.
const filterDatasetsByPlayType = (data: any, playType: PlayTypeFilter) => {
  if (!data || playType === 'all') return data;

  return {
    ...data,
    datasets: data.datasets.filter((dataset: any) => {
      const label = (dataset.label || '').toLowerCase();
      const isRush = label.endsWith('rush sr');
      const isPass = label.endsWith('pass sr');
      if (!isRush && !isPass) return true;
      return playType === 'rush' ? isRush : isPass;
    })
  };
};

// Play type filter dropdown, styled to match the team filter on the Games page
const PlayTypeDropdown: React.FC<{
  value: PlayTypeFilter;
  onChange: (value: PlayTypeFilter) => void;
}> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as PlayTypeFilter)}
    aria-label="Filter by play type"
    className="text-sm px-2.5 py-1 bg-white border border-neutral-300 rounded-md text-neutral-700 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-[length:1.2em_1.2em] bg-[position:calc(100%-0.6rem)_center] bg-no-repeat"
    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, paddingRight: '2rem' }}
  >
    {PLAY_TYPE_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ))}
  </select>
);

const TrendsChartsGrid: React.FC<TrendsChartsGridProps> = ({
  chartData,
  team,
  year,
  gamesCount,
  selectedTeamColor = 'default',
  perGameChartType = 'line',
  hidePerGameLines = false,
  embedOptions
}) => {
  const [copiedChart, setCopiedChart] = useState<string | null>(null);

  // Play type filter for the per-game SR line chart, seeded from the URL so the
  // selection survives a reload and can be carried into an embed
  const getInitialPlayTypeFilter = (): PlayTypeFilter => {
    if (typeof window !== 'undefined') {
      const playType = new URLSearchParams(window.location.search).get('playType');
      if (playType === 'rush' || playType === 'pass') return playType;
    }
    return 'all';
  };

  const [playTypeFilter, setPlayTypeFilter] = useState<PlayTypeFilter>(getInitialPlayTypeFilter());

  // Keep the URL in sync with the play type filter. Views that hide the
  // per-game line charts (Team vs. Team) never show the dropdown, so they
  // shouldn't touch the URL.
  useEffect(() => {
    if (hidePerGameLines) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (playTypeFilter === 'all') {
      urlParams.delete('playType');
    } else {
      urlParams.set('playType', playTypeFilter);
    }
    const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [playTypeFilter, hidePerGameLines]);

  if (!chartData) return null;

  // The embed serializes whatever datasets are on screen, so filtering here
  // makes the current play type selection the embed's default view too
  const rushPassByGameFiltered = filterDatasetsByPlayType(chartData.rushPassByGame, playTypeFilter);

  const handleCopyEmbed = async (
    chartId: string,
    title: string,
    data: any,
    chartType: 'bar' | 'line',
    extraUrlParams?: Record<string, string>
  ) => {
    setCopiedChart(chartId);

    try {
      // One-game Team vs. Team renders Rush Rate as grouped percent columns
      // (0-100 scale) — the trends embed template assumes 0-1 stacked bars, so
      // serialize the chart exactly as rendered instead.
      const embedCode =
        chartId === 'rush-rate-by-game' && chartType === 'bar'
          ? generateChartEmbed({
              chartType: 'bar',
              data,
              options: lineChartOptionsWithRotatedLabels,
              title,
              subtitle: embedOptions?.subtitle ?? `${team} - ${year} Season (${gamesCount} games)`,
              sourceUrl:
                embedOptions?.url ??
                `https://graphingcollegefootball.com/trends?year=${year}&team=${encodeURIComponent(team)}`,
              height: CHART_HEIGHTS.DEFAULT_DESKTOP,
              mobileHeight: CHART_HEIGHTS.DEFAULT_MOBILE,
              definitions: [
                '<strong>Rush Rate:</strong> Percentage of offensive plays that are rushing attempts',
                'Based roughly on <a href="https://www.sbnation.com/college-football/2017/10/13/16457830/college-football-advanced-stats-analytics-rankings" target="_blank" style="color: #525252; text-decoration: underline;">the SP+ analytic system</a>'
              ],
            })
          : generateTrendsEmbedCode(
              chartId,
              title,
              data,
              chartType,
              team,
              year,
              gamesCount,
              selectedTeamColor,
              extraUrlParams ? { ...embedOptions, urlParams: extraUrlParams } : embedOptions
            );

      await navigator.clipboard.writeText(embedCode);

      setTimeout(() => {
        setCopiedChart(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      setCopiedChart(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Row - 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Performance */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                Overall Team Performance
              </h3>
              <p className="text-sm text-neutral-600">
                Aggregate performance across {gamesCount} games
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('overall-performance', 'Overall Team Performance', chartData.overallPerformance, 'bar')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'overall-performance'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'overall-performance' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'overall-performance' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Bar data={chartData.overallPerformance} options={barChartOptions} />
          </div>
        </div>
        {/* SR & XR by Game */}
        {!hidePerGameLines && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Team (each game)
              </h3>
              <p className="text-sm text-neutral-600">
                Performance trends (vs = home, @ = away, * = postseason)
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('sr-xr-by-game', 'SR and XR by Team (each game)', chartData.srxrByGame, 'line')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'sr-xr-by-game'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'sr-xr-by-game' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'sr-xr-by-game' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Line data={chartData.srxrByGame} options={lineChartOptionsWithRotatedLabels} />
          </div>
        </div>
        )}
      </div>

      {/* Second Row - 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rush vs Pass by Game */}
        {!hidePerGameLines && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Play Type (each game)
              </h3>
              <p className="text-sm text-neutral-600">
                Play type effectiveness trends throughout the season
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PlayTypeDropdown value={playTypeFilter} onChange={setPlayTypeFilter} />
              <button
                onClick={() => handleCopyEmbed(
                  'rush-pass-by-game',
                  'SR and XR by Play Type (each game)',
                  rushPassByGameFiltered,
                  'line',
                  playTypeFilter !== 'all' ? { playType: playTypeFilter } : undefined
                )}
                className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                  copiedChart === 'rush-pass-by-game'
                    ? 'border-green-300 bg-green-50'
                    : 'border-neutral-300 hover:bg-neutral-50'
                }`}
                title={copiedChart === 'rush-pass-by-game' ? "Copied!" : "Copy embed code"}
              >
                {copiedChart === 'rush-pass-by-game' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-neutral-600" />
                )}
              </button>
            </div>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Line data={rushPassByGameFiltered} options={lineChartOptionsWithRotatedLabels} />
          </div>
        </div>
        )}

        {/* Rush Rate by Game */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                Rush Rate (each game)
              </h3>
              <p className="text-sm text-neutral-600">
                Percentage of plays that are rushes vs passes
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('rush-rate-by-game', 'Rush Rate (each game)', chartData.rushRateByGame, perGameChartType)}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'rush-rate-by-game'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'rush-rate-by-game' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'rush-rate-by-game' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            {perGameChartType === 'bar' ? (
              <Bar data={chartData.rushRateByGame} options={lineChartOptionsWithRotatedLabels} />
            ) : (
              <Line data={chartData.rushRateByGame} options={lineChartOptionsWithRotatedLabels} />
            )}
          </div>
        </div>
      </div>

      {/* Bar Charts - 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Performance by Quarter */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Quarter
              </h3>
              <p className="text-sm text-neutral-600">
                Season aggregate performance by quarter
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('performance-by-quarter', 'SR and XR by Quarter', chartData.performanceByQuarter, 'bar')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'performance-by-quarter'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'performance-by-quarter' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'performance-by-quarter' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Bar data={chartData.performanceByQuarter} options={barChartOptions} />
          </div>
        </div>

        {/* Performance by Play Type */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Play Type
              </h3>
              <p className="text-sm text-neutral-600">
                Season aggregate rush and pass success rates
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('performance-by-play-type', 'SR and XR by Play Type', chartData.performanceByPlayType, 'bar')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'performance-by-play-type'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'performance-by-play-type' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'performance-by-play-type' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Bar data={chartData.performanceByPlayType} options={barChartOptions} />
          </div>
        </div>

        {/* Performance by Down */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Down
              </h3>
              <p className="text-sm text-neutral-600">
                Season aggregate performance by down
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('performance-by-down', 'SR and XR by Down', chartData.performanceByDown, 'bar')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'performance-by-down'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'performance-by-down' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'performance-by-down' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Bar data={chartData.performanceByDown} options={barChartOptions} />
          </div>
        </div>

        {/* Performance by Field Position */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Red Zone
              </h3>
              <p className="text-sm text-neutral-600">
                Red zone vs rest of field performance
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('performance-by-field-position', 'SR and XR by Red Zone', chartData.performanceByFieldPosition, 'bar')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'performance-by-field-position'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'performance-by-field-position' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'performance-by-field-position' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Bar data={chartData.performanceByFieldPosition} options={barChartOptions} />
          </div>
        </div>

        {/* Performance by Distance */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="headline relative top-px text-[17px] font-bold text-ink">
                SR and XR by Distance to Go
              </h3>
              <p className="text-sm text-neutral-600">
                Short, medium, and long yardage situations
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('performance-by-distance', 'SR and XR by Distance to Go', chartData.performanceByDistance, 'bar')}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copiedChart === 'performance-by-distance'
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copiedChart === 'performance-by-distance' ? "Copied!" : "Copy embed code"}
            >
              {copiedChart === 'performance-by-distance' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Bar data={chartData.performanceByDistance} options={barChartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsChartsGrid;
