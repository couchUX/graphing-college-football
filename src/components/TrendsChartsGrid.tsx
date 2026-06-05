import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import { createBaseOptions } from '../utils/chartOptions';
import { percentCallback } from '../utils/chartConfig';
import { generateTrendsEmbedCode } from '../utils/trendsEmbedGenerator';

interface TrendsChartsGridProps {
  chartData: any; // Type from useSeasonChartData hook
  team: string;
  year: number;
  gamesCount: number;
  selectedTeamColor?: string;
  // Per-game charts (SR/XR by game, play-type, rush rate) normally render as
  // lines. Team vs. Team passes 'bar' for a one-game comparison, where a single
  // point per series reads better as grouped columns.
  perGameChartType?: 'line' | 'bar';
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
  perGameChartType = 'line'
}) => {
  const [copiedChart, setCopiedChart] = useState<string | null>(null);

  if (!chartData) return null;

  // Render a per-game chart as either a line (multi-game) or grouped bars
  // (one-game comparison). Both share the rotated-label percent axis.
  const renderPerGame = (data: any) =>
    perGameChartType === 'bar' ? (
      <Bar data={data} options={lineChartOptionsWithRotatedLabels} />
    ) : (
      <Line data={data} options={lineChartOptionsWithRotatedLabels} />
    );

  const handleCopyEmbed = async (
    chartId: string,
    title: string,
    data: any,
    chartType: 'bar' | 'line'
  ) => {
    setCopiedChart(chartId);

    try {
      const embedCode = generateTrendsEmbedCode(
        chartId,
        title,
        data,
        chartType,
        team,
        year,
        gamesCount,
        selectedTeamColor
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
              <h3 className="text-lg font-semibold text-neutral-900">
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
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                SR and XR by Team
              </h3>
              <p className="text-sm text-neutral-600">
                Performance trends (vs = home, @ = away, * = postseason)
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('sr-xr-by-game', 'SR and XR by Team', chartData.srxrByGame, 'line')}
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
            {renderPerGame(chartData.srxrByGame)}
          </div>
        </div>
      </div>

      {/* Second Row - 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rush vs Pass by Game */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                SR and XR by Play Type
              </h3>
              <p className="text-sm text-neutral-600">
                Play type effectiveness trends throughout the season
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('rush-pass-by-game', 'SR and XR by Play Type', chartData.rushPassByGame, 'line')}
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
            {renderPerGame(chartData.rushPassByGame)}
          </div>
        </div>

        {/* Rush Rate by Game */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Rush Rate
              </h3>
              <p className="text-sm text-neutral-600">
                Percentage of plays that are rushes vs passes
              </p>
            </div>
            <button
              onClick={() => handleCopyEmbed('rush-rate-by-game', 'Rush Rate', chartData.rushRateByGame, 'line')}
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
            {renderPerGame(chartData.rushRateByGame)}
          </div>
        </div>
      </div>

      {/* Bar Charts - 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Performance by Quarter */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
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
              <h3 className="text-lg font-semibold text-neutral-900">
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
              <h3 className="text-lg font-semibold text-neutral-900">
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
              <h3 className="text-lg font-semibold text-neutral-900">
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
              <h3 className="text-lg font-semibold text-neutral-900">
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
