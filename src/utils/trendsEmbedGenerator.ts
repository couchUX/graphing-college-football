import { CHART_HEIGHTS } from '../constants/chartDimensions';

export const generateTrendsEmbedCode = (
  chartId: string,
  title: string,
  chartData: any,
  chartType: 'bar' | 'line',
  team: string,
  year: number,
  gamesCount: number,
  selectedTeamColor: string
): string => {
  // Generate subtitle
  const subtitle = `${team} - ${year} Season (${gamesCount} games)`;

  // Generate URL to trends page
  const trendsUrl = (() => {
    const params = new URLSearchParams();
    params.set('year', year.toString());
    params.set('team', team);
    if (selectedTeamColor !== 'default') {
      params.set('teamColor', selectedTeamColor);
    }
    return `https://graphingcollegefootball.com/trends?${params.toString()}`;
  })();

  // Generate unique container ID to avoid conflicts
  const uniqueId = `cfb-chart-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // Detect if this is a player chart
  const isPlayerChart = chartId === 'top-rushers' || chartId === 'top-passers' || chartId === 'top-receivers';

  // Clean up chart data for embedding - remove functions and extract play counts
  const cleanedChartData = {
    ...chartData,
    datasets: chartData.datasets.map((dataset: any) => {
      const cleanedDataset = { ...dataset };

      // For player charts, data values are already play counts
      if (isPlayerChart && chartType === 'bar') {
        // Data is already in the correct format (play counts)
        // No need to extract from formatter
      }
      // Extract play counts from formatter function for non-player bar charts
      else if (chartType === 'bar' && cleanedDataset.datalabels?.formatter) {
        // Store play counts by calling the formatter for each data point
        cleanedDataset.playCountData = cleanedDataset.data.map((_value: number, index: number) => {
          try {
            return cleanedDataset.datalabels.formatter(0, { dataIndex: index });
          } catch {
            return null;
          }
        });
      }

      if (cleanedDataset.datalabels) {
        cleanedDataset.datalabels = {
          ...cleanedDataset.datalabels,
          formatter: undefined // Remove formatter function
        };
      }
      return cleanedDataset;
    })
  };

  // Serialize chart data
  const serializedData = JSON.stringify(cleanedChartData, null, 2);

  // Data definitions based on chart type
  const getDataDefinitions = (): string[] => {
    const baseDefinitions = [
      'Based roughly on <a href="https://www.sbnation.com/college-football/2017/10/13/16457830/college-football-advanced-stats-analytics-rankings" target="_blank" style="color: #525252; text-decoration: underline;">the SP+ analytic system</a>',
      '<strong>Successful play:</strong> Gains enough needed yards (50% 1st down, 70% on 2nd, 100% on 3rd/4th)',
      '<strong>Success Rate (SR):</strong> Percentage of plays that were successful',
      '<strong>Explosiveness Rate (XR):</strong> Percentage of plays gaining 15+ yards'
    ];

    if (chartType === 'bar') {
      return [
        ...baseDefinitions,
        '<strong># Plays:</strong> Numbers shown in bars represent total play counts across all games',
        '<strong>Aggregate Data:</strong> Combined statistics across all season games',
        '<strong>Opponents:</strong> Gray bars represent combined opponent performance',
        '<strong>NCAA Avg:</strong> Dashed line shows 42% (roughly NCAA average) success rate'
      ];
    } else {
      // Line charts
      return [
        ...baseDefinitions,
        '<strong>Per-Game Trends:</strong> Each point represents a single game',
        '<strong>X-Axis:</strong> Opponent names (@ = away game, * = postseason)'
      ];
    }
  };

  const dataDefinitions = getDataDefinitions();

  // Determine chart height based on chart ID
  const chartHeight = chartId === 'top-receivers'
    ? CHART_HEIGHTS.PLAYER_RECEIVERS
    : chartId === 'top-passers'
    ? CHART_HEIGHTS.PLAYER_PASSERS
    : chartId === 'top-rushers'
    ? CHART_HEIGHTS.PLAYER_RUSHERS
    : CHART_HEIGHTS.DEFAULT_DESKTOP;

  return `<!-- CFB Analytics Season Trends Chart Embed: ${title} -->
<div class="cfb-chart-embed-${uniqueId}">
    <style>
        .cfb-chart-embed-${uniqueId} {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
        }
        .cfb-chart-embed-${uniqueId} .chart-container {
            background: white;
            border-radius: 12px;
            border: 1px solid #e5e5e5;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .cfb-chart-embed-${uniqueId} .chart-header {
            padding: 18px 24px 14px;
            border-bottom: 1px solid #e5e5e5;
            background: white;
        }
        .cfb-chart-embed-${uniqueId} .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #171717;
            margin: 0;
        }
        .cfb-chart-embed-${uniqueId} .chart-subtitle {
            font-size: 11px;
            font-weight: 400;
            color: #737373;
            margin: 4px 0 0 0;
        }
        .cfb-chart-embed-${uniqueId} .chart-content {
            padding: 20px 24px 24px !important;
            height: ${chartHeight}px;
        }

        @media (max-width: 640px) {
            .cfb-chart-embed-${uniqueId} .chart-content {
                padding: 12px 16px 20px !important;
                height: ${CHART_HEIGHTS.DEFAULT_MOBILE}px !important;
            }
            .cfb-chart-embed-${uniqueId} .chart-header {
                padding: 12px 16px 12px !important;
            }
            .cfb-chart-embed-${uniqueId} .embed-footer-top {
                padding: 8px 12px !important;
            }
            .cfb-chart-embed-${uniqueId} .data-definitions {
                padding: 12px !important;
            }
        }
        .cfb-chart-embed-${uniqueId} .embed-footer {
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #737373;
        }
        .cfb-chart-embed-${uniqueId} .embed-footer-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
        }
        .cfb-chart-embed-${uniqueId} .embed-footer-link {
            color: #737373;
            text-decoration: none;
            font-weight: 500;
        }
        .cfb-chart-embed-${uniqueId} .embed-footer-link:hover {
            color: #525252;
            text-decoration: underline;
        }
        .cfb-chart-embed-${uniqueId} .data-definitions-toggle {
            background: none;
            border: none;
            color: #737373;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 0;
        }
        .cfb-chart-embed-${uniqueId} .data-definitions-toggle:hover {
            color: #525252;
        }
        .cfb-chart-embed-${uniqueId} .caret {
            transition: transform 0.2s ease;
            font-size: 10px;
        }
        .cfb-chart-embed-${uniqueId} .caret.expanded {
            transform: rotate(180deg);
        }
        .cfb-chart-embed-${uniqueId} .data-definitions {
            display: none;
            padding: 16px;
            background: #fafafa;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            line-height: 1.4;
        }
        .cfb-chart-embed-${uniqueId} .data-definitions.expanded {
            display: block;
        }
        .cfb-chart-embed-${uniqueId} .data-definitions ul {
            margin: 0;
            padding-left: 0;
            list-style: none;
        }
        .cfb-chart-embed-${uniqueId} .data-definitions li {
            margin-bottom: 4px;
        }
    </style>

    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">${title}</h3>
            <p class="chart-subtitle">${subtitle}</p>
        </div>
        <div class="chart-content">
            <canvas id="${uniqueId}"></canvas>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${trendsUrl}" class="embed-footer-link" target="_blank">See all charts</a>
                <button class="data-definitions-toggle" onclick="toggleDefinitions_${uniqueId.replace(/-/g, '_')}()">
                    Data definitions
                    <span class="caret" id="caret_${uniqueId}">▼</span>
                </button>
            </div>
            <div class="data-definitions" id="dataDefinitions_${uniqueId}">
                <ul>
                    ${dataDefinitions.map(def => `<li>${def}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"><\/script>

    <script>
        // Toggle data definitions accordion
        function toggleDefinitions_${uniqueId.replace(/-/g, '_')}() {
            const definitions = document.getElementById('dataDefinitions_${uniqueId}');
            const caret = document.getElementById('caret_${uniqueId}');

            if (definitions.classList.contains('expanded')) {
                definitions.classList.remove('expanded');
                caret.classList.remove('expanded');
            } else {
                definitions.classList.add('expanded');
                caret.classList.add('expanded');
            }
        }

        // Initialize chart
        (function() {
            'use strict';

            let retryCount = 0;
            const maxRetries = 50;

            function showError(message) {
                const canvas = document.getElementById('${uniqueId}');
                if (canvas && canvas.parentNode) {
                    canvas.parentNode.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">' + message + '</div>';
                }
            }

            function initChart() {
                retryCount++;

                if (typeof Chart === 'undefined') {
                    if (retryCount >= maxRetries) {
                        showError('Chart library failed to load. Please refresh the page.');
                        return;
                    }
                    setTimeout(initChart, 100);
                    return;
                }

                if (typeof ChartDataLabels === 'undefined') {
                    if (retryCount >= maxRetries) {
                        showError('Chart plugin failed to load. Please refresh the page.');
                        return;
                    }
                    setTimeout(initChart, 100);
                    return;
                }

                const canvas = document.getElementById('${uniqueId}');
                if (!canvas) {
                    console.warn('Canvas element not found yet, retrying...');
                    setTimeout(initChart, 100);
                    return;
                }

                if (canvas.chartInstance) {
                    console.log('Chart already initialized');
                    return;
                }

                try {
                    Chart.register(ChartDataLabels);

                    const chartData = ${serializedData};

                    const chartOptions = {
                        responsive: true,
                        maintainAspectRatio: false,
                        ${isPlayerChart ? `indexAxis: 'y',` : ''}
                        animation: {
                            duration: 1
                        },
                        ${chartType === 'line' ? `
                        elements: {
                            line: {
                                tension: 0.15,
                                borderWidth: 2.5
                            },
                            point: {
                                radius: 4
                            }
                        },
                        ` : ''}
                        plugins: {
                            datalabels: {
                                display: ${chartType === 'bar'},
                                formatter: function(value, context) {
                                    ${isPlayerChart ? `
                                    // For player charts, value is already the play count
                                    // Hide labels for zero or negative values
                                    return value > 0 ? value : null;
                                    ` : `
                                    // Use play count data if available (for bar charts)
                                    if (context.dataset.playCountData && context.dataset.playCountData[context.dataIndex] != null) {
                                        return context.dataset.playCountData[context.dataIndex];
                                    }

                                    // Fallback for other cases
                                    if (typeof value === 'number') {
                                        if (value >= 0 && value <= 1) {
                                            return Math.round(value * 100) + '%';
                                        }
                                        return value % 1 === 0 ? value : Math.round(value * 100) / 100;
                                    }
                                    return value;
                                    `}
                                },
                                color: 'white',
                                font: {
                                    weight: 'normal',
                                    size: 12
                                },
                                padding: 4,
                                backgroundColor: function(context) {
                                    const value = context.dataset.data[context.dataIndex];
                                    return value > 0 ? '#26262660' : 'transparent';
                                },
                                borderColor: function(context) {
                                    const value = context.dataset.data[context.dataIndex];
                                    return value > 0 ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
                                },
                                borderRadius: 4,
                                align: 'center',
                                anchor: 'center'
                            },
                            legend: {
                                position: 'top',
                                align: 'start',
                                labels: {
                                    usePointStyle: false,
                                    boxWidth: 12,
                                    boxHeight: 12,
                                    padding: 12,
                                    filter: function(legendItem) {
                                        return !legendItem.text.includes('NCAA Avg SR');
                                    }
                                }
                            },
                            tooltip: {
                                enabled: true,
                                mode: 'index',
                                intersect: false
                            }
                        },
                        scales: {
                            ${isPlayerChart ? `
                            // For horizontal player charts: x is value axis, y is category axis
                            x: {
                                stacked: true,
                                beginAtZero: true,
                                grid: {
                                    display: true
                                },
                                ticks: {
                                    callback: function(value) {
                                        return value; // Show raw play counts
                                    }
                                }
                            },
                            y: {
                                stacked: true,
                                grid: {
                                    display: false
                                }
                            }
                            ` : `
                            // For vertical bar charts and line charts
                            x: {
                                ${chartType === 'bar' ? 'stacked: true,' : ''}
                                grid: {
                                    display: false
                                }${chartType === 'line' ? `,
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45,
                                    font: { size: 11 }
                                }` : ''}
                            },
                            y: {
                                ${chartType === 'bar' ? 'stacked: true,' : ''}
                                max: ${chartType === 'bar' ? '1' : '100'},
                                min: 0,
                                ticks: {
                                    callback: function(value) {
                                        return ${chartType === 'bar' ? '(value * 100)' : 'value'} + '%';
                                    }
                                }
                            }
                            `}
                        }
                    };

                    const chart = new Chart(canvas, {
                        type: '${chartType}',
                        data: chartData,
                        options: chartOptions
                    });

                    canvas.chartInstance = chart;

                } catch (error) {
                    console.error('Error initializing chart:', error);
                    showError('Failed to initialize chart: ' + error.message);
                }
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initChart);
            } else {
                initChart();
            }
        })();
    <\/script>
</div>`;
};
