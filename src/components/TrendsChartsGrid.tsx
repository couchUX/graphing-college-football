import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import { createBaseOptions } from '../utils/chartOptions';
import { percentCallback } from '../utils/chartConfig';
import { generateTrendsEmbedCode, TrendsEmbedOptions } from '../utils/trendsEmbedGenerator';
import { generateChartEmbed } from '../utils/chartEmbedGenerator';
import { CHART_HEIGHTS } from '../constants/chartDimensions';
import ChartCard from './ChartCard';
import { createDepthYacOptions } from '../utils/passingChartOptions';
import type { ChartData } from 'chart.js';

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

  if (!chartData) return null;

  const handleCopyEmbed = async (
    chartId: string,
    title: string,
    data: any,
    chartType: 'bar' | 'line'
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
              embedOptions
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

  /** The passing charts are new, so they go through the generic embed engine
   *  rather than the older bespoke trends template. */
  const handleCopyPassingEmbed = async (
    chartId: string,
    title: string,
    data: unknown,
    options: unknown,
    definitions: string[],
    height: number
  ) => {
    setCopiedChart(chartId);
    try {
      const embedCode = generateChartEmbed({
        chartType: 'bar',
        data,
        options,
        title,
        subtitle: embedOptions?.subtitle ?? `${team} - ${year} Season (${gamesCount} games)`,
        sourceUrl:
          embedOptions?.url ??
          `https://graphingcollegefootball.com/trends?year=${year}&team=${encodeURIComponent(team)}`,
        height,
        mobileHeight: height,
        definitions,
      });
      await navigator.clipboard.writeText(embedCode);
      setTimeout(() => setCopiedChart(null), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      setCopiedChart(null);
    }
  };

  const depthYacOptions = createDepthYacOptions();

  const PASSING_DEFINITIONS = [
    '<strong>Pass attempt:</strong> A throw at a receiver. Sacks are not attempts, though the site counts them as pass plays elsewhere',
    '<strong>Charted attempts:</strong> Depth data is not available on every throw; the subtitle says how many attempts carried it',
  ];

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
            <button
              onClick={() => handleCopyEmbed('rush-pass-by-game', 'SR and XR by Play Type (each game)', chartData.rushPassByGame, 'line')}
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
          <div className="px-6 pb-6 pt-4" style={{ height: '400px' }}>
            <Line data={chartData.rushPassByGame} options={lineChartOptionsWithRotatedLabels} />
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

        {/* Pass depth — only when enough attempts carry air yards. New charts
            use the shared ChartCard rather than the hand-built markup above. */}
        {chartData.hasPassingDepth && chartData.passDepth && (
          <ChartCard
            title="SR and XR by pass depth"
            subtitle={chartData.passingCoverageNote}
            height={400}
            mobileHeight={CHART_HEIGHTS.DEFAULT_MOBILE}
            isCopied={copiedChart === 'pass-depth'}
            onCopyEmbed={() =>
              handleCopyPassingEmbed(
                'pass-depth',
                'SR and XR by pass depth',
                chartData.passDepth,
                barChartOptions,
                [
                  ...PASSING_DEFINITIONS,
                  '<strong>Short / Deep:</strong> Split at 15 air yards, the same line the site uses for explosiveness',
                ],
                400
              )
            }
          >
            <Bar data={chartData.passDepth} options={barChartOptions} />
          </ChartCard>
        )}
      </div>

      {chartData.hasPassingDepth && (chartData.passerDepthYac || chartData.receiverDepthYac) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartData.passerDepthYac && (
            <ChartCard
              title="Passer depth and YAC"
              subtitle={chartData.passingCoverageNote}
              height={CHART_HEIGHTS.PLAYER_PASSERS}
              mobileHeight={CHART_HEIGHTS.PLAYER_PASSERS}
              isCopied={copiedChart === 'passer-depth-yac'}
              onCopyEmbed={() =>
                handleCopyPassingEmbed(
                  'passer-depth-yac',
                  'Passer depth and YAC',
                  chartData.passerDepthYac,
                  depthYacOptions,
                  [
                    ...PASSING_DEFINITIONS,
                    '<strong>Air yards:</strong> Distance the ball travelled past the line of scrimmage',
                    '<strong>Yards after catch (YAC):</strong> Yards the receiver added once the ball arrived',
                  ],
                  CHART_HEIGHTS.PLAYER_PASSERS
                )
              }
            >
              <Bar data={chartData.passerDepthYac as ChartData<'bar'>} options={depthYacOptions} />
            </ChartCard>
          )}

          {chartData.receiverDepthYac && (
            <ChartCard
              title="Receiver depth and YAC"
              subtitle={chartData.passingCoverageNote}
              height={CHART_HEIGHTS.PLAYER_RECEIVERS}
              mobileHeight={CHART_HEIGHTS.PLAYER_RECEIVERS}
              isCopied={copiedChart === 'receiver-depth-yac'}
              onCopyEmbed={() =>
                handleCopyPassingEmbed(
                  'receiver-depth-yac',
                  'Receiver depth and YAC',
                  chartData.receiverDepthYac,
                  depthYacOptions,
                  [
                    ...PASSING_DEFINITIONS,
                    '<strong>Targets:</strong> Every throw aimed at the receiver, whether or not it was caught',
                    '<strong>Yards after catch (YAC):</strong> Yards the receiver added once the ball arrived',
                  ],
                  CHART_HEIGHTS.PLAYER_RECEIVERS
                )
              }
            >
              <Bar data={chartData.receiverDepthYac as ChartData<'bar'>} options={depthYacOptions} />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
};

export default TrendsChartsGrid;
