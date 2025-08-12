import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { PlayData } from '../types';
import { useChartData } from '../hooks/useChartData';
import Toast from './Toast';
import {
  createLineOptionsPlayNumberSRXR,
  createLineOptionsTeamPlay,
  createPlayMapOptions,
  createBarOptions,
  createDriveOptions,
  createPlayerOptions
} from '../utils/chartOptions';
import { initializeChartDefaults } from '../utils/chartConfig';

// Initialize Chart.js defaults
initializeChartDefaults();

interface ChartsGridProps {
  plays: PlayData[];
  team: string;
  overrideTeam1ToGray?: boolean;
  overrideTeam2ToGray?: boolean;
}

const ChartsGrid: React.FC<ChartsGridProps> = ({ plays, team, overrideTeam1ToGray = false, overrideTeam2ToGray = false }) => {
  const [copiedChart, setCopiedChart] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const generateEmbedCode = (_chartId: string, title: string, chartData: any, _chartOptions: any, _chartType: 'bar' | 'line') => {
    // Generate unique container ID to avoid conflicts
    const uniqueId = `cfb-chart-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Clean up chart data for embedding - remove all functions
    const cleanedChartData = {
      ...chartData,
      datasets: chartData.datasets.map((dataset: any) => {
        const cleanedDataset = { ...dataset };
        if (cleanedDataset.datalabels) {
          cleanedDataset.datalabels = {
            ...cleanedDataset.datalabels,
            formatter: undefined // Remove formatter function - we'll handle it in the embed template
          };
        }
        return cleanedDataset;
      })
    };
    
    // Serialize chart data for embedding
    const serializedData = JSON.stringify(cleanedChartData, null, 2);

    const embedCode = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f8fafc;
        }
        .chart-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .chart-header {
            padding: 16px 24px;
            border-bottom: 1px solid #e2e8f0;
            background: white;
        }
        .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin: 0;
        }
        .chart-content {
            padding: 24px;
            height: 320px;
        }
        .embed-credit {
            font-size: 12px;
            color: #64748b;
            text-align: center;
            padding: 12px;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">${title}</h3>
        </div>
        <div class="chart-content">
            <canvas id="${uniqueId}"></canvas>
        </div>
        <div class="embed-credit">
            Powered by CFB Advanced Metrics Dashboard
        </div>
    </div>

    <script>
        // WordPress-safe chart initialization with defensive checks
        (function() {
            'use strict';
            
            function initChart() {
                // Check if Chart.js is available
                if (typeof Chart === 'undefined') {
                    console.warn('Chart.js not loaded yet, retrying...');
                    setTimeout(initChart, 100);
                    return;
                }
                
                // Check if datalabels plugin is available
                if (typeof ChartDataLabels === 'undefined') {
                    console.warn('ChartDataLabels plugin not loaded yet, retrying...');
                    setTimeout(initChart, 100);
                    return;
                }
                
                // Check if canvas element exists
                const canvas = document.getElementById('${uniqueId}');
                if (!canvas) {
                    console.warn('Canvas element not found yet, retrying...');
                    setTimeout(initChart, 100);
                    return;
                }
                
                // Prevent multiple chart instances
                if (canvas.chartInstance) {
                    console.log('Chart already initialized');
                    return;
                }
                
                try {
                    // Register the datalabels plugin
                    Chart.register(ChartDataLabels);
                    
                    // Embed actual chart data directly
                    const chartData = ${serializedData};
                    
                    // Chart options (WordPress-safe)
                    const chartOptions = {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 0 // Disable animations to prevent conflicts
                        },
                        plugins: {
                            datalabels: {
                                display: function(context) {
                                    return context.dataset.datalabels && context.dataset.datalabels.display === true;
                                },
                                formatter: function(value, context) {
                                    if (context.dataset.label === 'SR') {
                                        const playCount = context.dataIndex === 0 ? 
                                            (chartData.teamPlayCount || 0) : 
                                            (chartData.opponentPlayCount || 0);
                                        return playCount;
                                    }
                                    return Math.round(value * 100) + '%';
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
                                    filter: function(legendItem, chartData) {
                                        return legendItem.text !== 'NCAA Avg SR';
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.dataset.label || '';
                                        const value = Math.round(context.raw * 100);
                                        return label + ': ' + value + '%';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                max: 1,
                                min: 0,
                                stacked: false,
                                ticks: {
                                    callback: function(value) {
                                        return Math.round(value * 100) + '%';
                                    }
                                }
                            }
                        }
                    };
                    
                    // Initialize the chart
                    const ctx = canvas.getContext('2d');
                    const chart = new Chart(ctx, {
                        type: 'bar',
                        data: chartData,
                        options: chartOptions
                    });
                    
                    // Store reference to prevent re-initialization
                    canvas.chartInstance = chart;
                    
                    console.log('CFB Chart initialized successfully');
                    
                } catch (error) {
                    console.error('Error initializing CFB chart:', error);
                    // Fallback: show error message in canvas container
                    const container = document.getElementById('${uniqueId}').parentNode;
                    if (container) {
                        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Chart failed to load. Please refresh the page.</div>';
                    }
                }
            }
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initChart);
            } else {
                initChart();
            }
            
            // Also try initialization after a short delay for WordPress compatibility
            setTimeout(initChart, 500);
            
        })();
    </script>
</body>
</html>`;

    return embedCode;
  };

  const handleCopyEmbed = async (chartId: string, title: string) => {
    let embedCode = '';
    
    // Generate embed code based on chart ID
    switch (chartId) {
      case 'overall-team-performance': {
        // Add play counts for proper datalabels
        const enhancedData = {
          ...overallTeamData,
          teamColors: chartData.teamColors,
          opponentColors: chartData.opponentColors,
          teamPlayCount: chartData.teamPlays.length,
          opponentPlayCount: chartData.opponentPlays.length
        };
        
        embedCode = generateEmbedCode(
          chartId,
          title,
          enhancedData,
          barOptions,
          'bar'
        );
        break;
      }
      default: {
        // Fallback for charts not yet implemented
        embedCode = `<div style="padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <h3>${title}</h3>
          <p>Embed code for this chart is coming soon!</p>
        </div>`;
      }
    }
    
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedChart(chartId);
      setToastMessage(`Embed code copied for ${title}`);
      setShowToast(true);
      console.log(`Embed code copied for: ${title}`);
      
      // Clear the copied state after 2 seconds
      setTimeout(() => {
        setCopiedChart(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      setToastMessage('Failed to copy embed code. Please try again.');
      setShowToast(true);
    }
  };

  const chartData = useChartData(plays, team, overrideTeam1ToGray, overrideTeam2ToGray);
  const {
    team: selectedTeam,
    opponentTeam,
    overallTeamData,
    teamLinesData,
    teamPlayTypeLinesData,
    opponentPlayTypeLinesData,
    teamRushRateData,
    opponentRushRateData,
    teamPlayMapData,
    opponentPlayMapData,
    teamDriveChartData,
    opponentDriveChartData,
    teamMinY,
    teamMaxY,
    oppMinY,
    oppMaxY,
    teamDriveData,
    opponentDriveData,
    allRushers,
    allPassers,
    allReceivers,
    createTeamVsOpponentBarData,
    createPlayerData
  } = chartData;

  // Create chart options
  const lineOptionsPlayNumberSRXR = createLineOptionsPlayNumberSRXR();
  const lineOptionsTeamPlay = createLineOptionsTeamPlay();
  const barOptions = createBarOptions();
  const teamPlayMapOptions = createPlayMapOptions(teamMinY, teamMaxY);
  const opponentPlayMapOptions = createPlayMapOptions(oppMinY, oppMaxY);
  const driveOptions = createDriveOptions(teamDriveData, opponentDriveData);
  const playerOptions = createPlayerOptions();

  const teamCharts = [
    {
      id: 'overall-team-performance',
      title: 'Overall Team Performance',
      component: <Bar data={overallTeamData as any} options={barOptions} />
    },
    {
      id: 'team-lines',
      title: 'SR and XR by Team',
      component: <Line data={teamLinesData} options={lineOptionsPlayNumberSRXR} />
    },
    {
      id: 'team-play-type-lines',
      title: `SR by Play Type: ${selectedTeam}`,
      component: <Line data={teamPlayTypeLinesData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'opponent-play-type-lines',
      title: `SR by Play Type: ${opponentTeam}`,
      component: <Line data={opponentPlayTypeLinesData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'team-rush-rate',
      title: `Rush Rate: ${selectedTeam}`,
      component: <Line data={teamRushRateData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'opponent-rush-rate',
      title: `Rush Rate: ${opponentTeam}`,
      component: <Line data={opponentRushRateData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'team-play-map',
      title: `Play Map: ${selectedTeam}`,
      component: <Line data={teamPlayMapData} options={teamPlayMapOptions} />
    },
    {
      id: 'opponent-play-map',
      title: `Play Map: ${opponentTeam}`,
      component: <Line data={opponentPlayMapData} options={opponentPlayMapOptions} />
    },
    {
      id: 'team-drive-metrics',
      title: `SR, XR, and Play Count by Drive: ${selectedTeam}`,
      component: <Bar data={teamDriveChartData} options={driveOptions} />
    },
    {
      id: 'opponent-drive-metrics',
      title: `SR, XR, and Play Count by Drive: ${opponentTeam}`,
      component: <Bar data={opponentDriveChartData} options={driveOptions} />
    },
    {
      id: 'play-type-bars',
      title: 'SR and XR by Play Type (Bar Chart)',
      component: <Bar data={createTeamVsOpponentBarData('playType') as any} options={barOptions} />
    },
    {
      id: 'quarter-bars',
      title: 'SR and XR by Quarter',
      component: <Bar data={createTeamVsOpponentBarData('quarter') as any} options={barOptions} />
    },
    {
      id: 'down-bars',
      title: 'SR and XR by Down',
      component: <Bar data={createTeamVsOpponentBarData('down') as any} options={barOptions} />
    },
    {
      id: 'red-zone-bars',
      title: 'SR and XR by Red Zone',
      component: <Bar data={createTeamVsOpponentBarData('redZone') as any} options={barOptions} />
    },
    {
      id: 'distance-bars',
      title: 'SR and XR by Distance to Go',
      component: <Bar data={createTeamVsOpponentBarData('distance') as any} options={barOptions} />
    }
  ];

  const playerCharts = [
    {
      id: 'top-rushers',
      title: 'Top rushers',
      component: <Bar data={createPlayerData(allRushers, 'rush') as any} options={playerOptions} />
    },
    {
      id: 'top-passers',
      title: 'Top passers',
      component: <Bar data={createPlayerData(allPassers, 'pass') as any} options={playerOptions} />
    },
    {
      id: 'top-receivers',
      title: 'Top receivers',
      component: <Bar data={createPlayerData(allReceivers, 'receive') as any} options={playerOptions} />
    }
  ];

  return (
    <>
      <Toast
        message={toastMessage}
        type="success"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
      <div className="space-y-8">
        {/* Team Charts Section */}
        <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Team charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {teamCharts.map((chart) => (
            <div key={chart.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {chart.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(chart.id, chart.title)}
                  className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                    copiedChart === chart.id 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  title={copiedChart === chart.id ? "Copied!" : "Copy embed code"}
                >
                  {copiedChart === chart.id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {chart.component}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player Charts Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Player charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Rushers and Passers stacked */}
          <div className="space-y-6">
            {/* Top Rushers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {playerCharts[0].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[0].id, playerCharts[0].title)}
                  className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                    copiedChart === playerCharts[0].id 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  title={copiedChart === playerCharts[0].id ? "Copied!" : "Copy embed code"}
                >
                  {copiedChart === playerCharts[0].id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {playerCharts[0].component}
                </div>
              </div>
            </div>

            {/* Top Passers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {playerCharts[1].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[1].id, playerCharts[1].title)}
                  className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                    copiedChart === playerCharts[1].id 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  title={copiedChart === playerCharts[1].id ? "Copied!" : "Copy embed code"}
                >
                  {copiedChart === playerCharts[1].id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {playerCharts[1].component}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Receivers spanning full height */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {playerCharts[2].title}
                </h3>
              </div>
              <button
                onClick={() => handleCopyEmbed(playerCharts[2].id, playerCharts[2].title)}
                className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                  copiedChart === playerCharts[2].id 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-slate-300 hover:bg-slate-50'
                }`}
                title={copiedChart === playerCharts[2].id ? "Copied!" : "Copy embed code"}
              >
                {copiedChart === playerCharts[2].id ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-slate-600" />
                )}
              </button>
            </div>
            
            <div className="p-6">
              <div className="h-[41rem]">
                {playerCharts[2].component}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ChartsGrid;