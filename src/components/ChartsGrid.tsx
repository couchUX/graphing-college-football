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
  selectedTeamColor?: string;
  selectedOpponentColor?: string;
  currentParams?: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
    gameId?: string;
  } | null;
}

const ChartsGrid: React.FC<ChartsGridProps> = ({ plays, team, selectedTeamColor = 'default', selectedOpponentColor = 'default', currentParams = null }) => {
  const [copiedChart, setCopiedChart] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Helper function to extract count data from bar chart datasets
  const enhanceBarDataWithCounts = (barData: any) => {
    const enhanced = { ...barData };
    
    // Extract count arrays from the formatter functions in SR datasets
    const teamSRDataset = enhanced.datasets.find((d: any) => d.label?.includes(' SR') && !d.label?.includes('NCAA'));
    const oppSRDataset = enhanced.datasets.find((d: any) => d.label?.includes(' SR') && d.label !== teamSRDataset?.label && !d.label?.includes('NCAA'));
    
    if (teamSRDataset?.datalabels?.formatter && oppSRDataset?.datalabels?.formatter) {
      // Create mock context to extract counts
      const teamCounts = enhanced.labels.map((_: any, index: number) => {
        try {
          return teamSRDataset.datalabels.formatter(0, { dataIndex: index });
        } catch {
          return 0;
        }
      });
      
      const oppCounts = enhanced.labels.map((_: any, index: number) => {
        try {
          return oppSRDataset.datalabels.formatter(0, { dataIndex: index });
        } catch {
          return 0;
        }
      });
      
      // Add count arrays to the enhanced data
      enhanced.teamCounts = teamCounts;
      enhanced.oppCounts = oppCounts;
    }
    
    return enhanced;
  };
  const generateEmbedCode = (_chartId: string, title: string, chartData: any, _chartOptions: any, _chartType: 'bar' | 'line') => {
    // Generate the game URL using chart data parameters - only include necessary params
    const gameUrl = chartData.currentParams ? (() => {
      const params = new URLSearchParams();
      // Only include the essential parameters that the GameSelector expects
      params.set('year', chartData.currentParams.year.toString());
      params.set('team', chartData.currentParams.team);
      if (chartData.currentParams.gameId) {
        params.set('gameId', chartData.currentParams.gameId.toString());
      }
      // Note: Do NOT include week, seasonType as they're not needed for the main app URL
      
      // Add color parameters if they're not default
      if (selectedTeamColor !== 'default') {
        params.set('teamColor', selectedTeamColor);
      }
      if (selectedOpponentColor !== 'default') {
        params.set('opponentColor', selectedOpponentColor);
      }
      
      return `https://graphingcollegefootball.com/?${params.toString()}`;
    })() : 'https://graphingcollegefootball.com';
    
    // Generate chart-specific data definitions
    const getDataDefinitions = (chartType: 'bar' | 'line', title: string) => {
      const baseDefinitions = [
        'Based roughly on <a href="https://www.sbnation.com/college-football/2017/10/13/16457830/college-football-advanced-stats-analytics-rankings" target="_blank" style="color: #525252; text-decoration: underline;">the SP+ analytic system</a>',
        '<strong>Successful play:</strong> Gains enough needed yards (50% 1st down, 70% on 2nd, 100% on 3rd/4th)',
        '<strong>Success Rate (SR):</strong> Percentage of plays that were successful',
        '<strong>Explosiveness Rate (XR):</strong> Percentage of plays gaining 15+ yards'
      ];

      // Chart-specific definitions
      if (chartType === 'bar' && (title.includes('Overall Team Performance') || title.includes('by Quarter') || title.includes('by Down') || title.includes('by Play Type') || title.includes('Red Zone') || title.includes('by Distance'))) {
        // Team vs opponent bar charts (including Overall) with play counts and NCAA average
        return [
          ...baseDefinitions,
          '<strong># Plays:</strong> Numbers shown in bars represent total play counts',
          '<strong>NCAA Avg:</strong> Dashed line shows 42% (roughly NCAA average) success rate'
        ];
      } else if (chartType === 'bar' && (title.includes('Rushers') || title.includes('Passers') || title.includes('Receivers'))) {
        // Player charts - horizontal bar charts without NCAA average or play count labels
        return baseDefinitions;
      } else if (chartType === 'line' && title.includes('SR')) {
        // Line charts showing success rate
        return [
          ...baseDefinitions,
          '<strong>Gray area:</strong> Represents 42% (roughly NCAA average) success rate'
        ];
      } else if (chartType === 'line' && title.includes('Rush Rate')) {
        // Rush rate line charts
        return [
          ...baseDefinitions,
          '<strong>Rush Rate:</strong> Percentage of offensive plays that are rushing attempts',
          '<strong>Gray area:</strong> Represents 50/50 balanced offense'
        ];
      } else if (title.includes('Play Map')) {
        // Play map charts
        return [
          ...baseDefinitions,
          '<strong>Play Map:</strong> Each point represents yards gained on a single play',
          '<strong>Circles:</strong> Rushing plays, <strong>Triangles:</strong> Passing plays'
        ];
      } else if (title.includes('Drive')) {
        // Drive charts
        return [
          ...baseDefinitions,
          '<strong>Drive Metrics:</strong> Success and explosiveness rates calculated per drive',
          '<strong>Play counts:</strong> Gray bars show number of plays in each drive'
        ];
      }

      // Default for other chart types
      return baseDefinitions;
    };

    const dataDefinitions = getDataDefinitions(_chartType, title);
    
    // Generate unique container ID to avoid conflicts
    const uniqueId = `cfb-chart-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Clean up chart data for embedding - remove all functions except for specific cases
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
        
        // Special handling for Overall Team Performance chart - preserve play count data
        if (_chartId === 'overall-team-performance' && dataset.label === 'Success Rate (SR)') {
          // Store the play counts directly in the dataset for the embed
          cleanedDataset.playCountData = dataset.data.map((value: number, index: number) => {
            // Extract play counts using the correct property names
            if (index === 0) {
              // Team data - use teamPlayCount from enhanced data
              return chartData.teamPlayCount || Math.round(value * 100);
            } else {
              // Opponent data - use opponentPlayCount from enhanced data
              return chartData.opponentPlayCount || Math.round(value * 100);
            }
          });
        }
        
        // Keep yAxisID for proper scaling, we'll handle axis visibility in the options
        
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
            border: 1px solid #e5e5e5;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .chart-header {
            padding: 18px 24px 16px;
            border-bottom: 1px solid #e5e5e5;
            background: white;
        }
        .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #171717;
            margin: 0;
        }
        .chart-content {
            padding: 20px 24px 24px !important;
        }
        
        @media (max-width: 640px) {
            .chart-content {
                padding: 12px 16px 20px !important;
            }
            .chart-header {
                padding: 12px 16px 12px !important;
            }
            .embed-footer-top {
                padding: 8px 12px !important;
            }
            .data-definitions {
                padding: 12px !important;
            }
            body {
                padding: 12px !important;
            }
        }
        .chart-content.top-receivers {
            height: 624px;
        }
        .chart-content.top-passers {
            height: 280px !important;
        }
        .chart-content.top-rushers {
            height: 372px;
        }
        .chart-content:not(.top-receivers):not(.top-passers):not(.top-rushers) {
            height: 372px;
        }
        .embed-footer {
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #737373;
        }
        .embed-footer-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
        }
        .embed-footer-link {
            color: #737373;
            text-decoration: none;
            font-weight: 500;
        }
        .embed-footer-link:hover {
            color: #525252;
            text-decoration: underline;
        }
        .data-definitions-toggle {
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
        .data-definitions-toggle:hover {
            color: #525252;
        }
        .caret {
            transition: transform 0.2s ease;
            font-size: 10px;
        }
        .caret.expanded {
            transform: rotate(180deg);
        }
        .data-definitions {
            display: none;
            padding: 16px;
            background: #fafafa;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            line-height: 1.4;
        }
        .data-definitions.expanded {
            display: block;
        }
        .data-definitions ul {
            margin: 0;
            padding-left: 0;
            list-style: none;
        }
        .data-definitions li {
            margin-bottom: 4px;
        }
    </style>
</head>
<body>
    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">${title}</h3>
        </div>
        <div class="chart-content ${_chartId}">
            <canvas id="${uniqueId}"></canvas>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${gameUrl}" class="embed-footer-link" target="_blank">See all charts</a>
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

    <script>
        // Toggle data definitions accordion - unique function per embed
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
                        elements: '${_chartType}' === 'line' ? '${_chartId}'.includes('play-map') ? {
                            line: { 
                                tension: 0, 
                                borderWidth: 0 
                            }
                        } : {
                            line: { 
                                tension: 0.25, 
                                borderWidth: 2.2 
                            },
                            point: { 
                                pointRadius: '${_chartId}'.includes('team-lines') ? 0 : undefined
                            }
                        } : {},
                        plugins: {
                            datalabels: {
                                display: function(context) {
                                    // Suppress data labels on line charts
                                    if ('${_chartType}' === 'line') {
                                        return false;
                                    }
                                    return context.dataset.datalabels && context.dataset.datalabels.display === true;
                                },
                                formatter: function(value, context) {
                                    // Special handling for Overall Team Performance chart
                                    if ('${_chartId}' === 'overall-team-performance' && context.dataset.label === 'Success Rate (SR)') {
                                        // Use the stored play count data
                                        if (context.dataset.playCountData && context.dataset.playCountData[context.dataIndex]) {
                                            return context.dataset.playCountData[context.dataIndex];
                                        }
                                        // Fallback to percentage if play count data not available
                                        return Math.round(value * 100) + '%';
                                    }
                                    
                                    // Handle bar charts with count data (play-type, quarter, down, etc.)
                                    if (context.dataset.label && context.dataset.label.includes(' SR') && 
                                        (chartData.teamCounts || chartData.oppCounts)) {
                                        
                                        // Find the first team SR dataset in the chart to determine team order
                                        const allDatasets = context.chart.data.datasets;
                                        const teamSRDataset = allDatasets.find(d => d.label && d.label.includes(' SR') && !d.label.includes('NCAA'));
                                        
                                        // If this is the first team's SR dataset, use teamCounts
                                        if (teamSRDataset && context.dataset.label === teamSRDataset.label && chartData.teamCounts) {
                                            return chartData.teamCounts[context.dataIndex] || 0;
                                        } 
                                        // Otherwise, use oppCounts for the second team
                                        else if (chartData.oppCounts) {
                                            return chartData.oppCounts[context.dataIndex] || 0;
                                        }
                                    }
                                    
                                    // For player charts, show value only if > 0 (matches non-embedded behavior)
                                    if ('${_chartId}'.includes('top-rushers') || '${_chartId}'.includes('top-passers') || '${_chartId}'.includes('top-receivers')) {
                                        // Hide data labels for zero or negative values, show actual value for positive values
                                        return value > 0 ? value : null;
                                    }
                                    
                                    // For other charts, show values based on type
                                    if (typeof value === 'number') {
                                        // If value is between 0 and 1, treat as percentage
                                        if (value >= 0 && value <= 1) {
                                            const percentage = Math.round(value * 100);
                                            // Special case: if it's 100%, show "1" for single plays
                                            if (percentage === 100) {
                                                return '1';
                                            }
                                            return percentage + '%';
                                        }
                                        // Otherwise show as number (rounded if decimal)
                                        return value % 1 === 0 ? value : Math.round(value * 100) / 100;
                                    }
                                    return value;
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
                            legend: '${_chartType}' === 'line' ? {
                                position: 'top',
                                align: 'start',
                                labels: '${_chartId}'.includes('play-map') ? {
                                    usePointStyle: true,
                                    generateLabels: function(chart) {
                                        // Call the original generateLabels to get default styling
                                        const original = Chart.defaults.plugins.legend.labels.generateLabels;
                                        const labels = original.call(this, chart);
                                        
                                        // Filter and customize each label
                                        const filteredLabels = labels.filter(label => {
                                            return !label.text.includes('< 0') &&
                                                   !label.text.includes('Quarters') &&
                                                   !label.text.includes('Drive');
                                        });
                                        
                                        filteredLabels.forEach((label, index) => {
                                            const dataset = chart.data.datasets[label.datasetIndex];
                                            if (dataset && dataset.label) {
                                                if (dataset.label.includes('Rush')) {
                                                    label.pointStyle = 'circle';
                                                    label.pointStyleWidth = 4;
                                                    label.fillStyle = 'white';
                                                } else if (dataset.label.includes('Pass')) {
                                                    label.pointStyle = 'triangle';
                                                    label.pointStyleWidth = 4;
                                                    label.fillStyle = 'white';
                                                } else {
                                                    label.pointStyle = 'rect';
                                                    label.pointStyleWidth = 4;
                                                    label.fillStyle = 'white';
                                                }
                                            }
                                        });
                                        
                                        return filteredLabels;
                                    },
                                    boxWidth: 20,
                                    padding: 12
                                } : {
                                    usePointStyle: false,
                                    boxWidth: 12,
                                    boxHeight: 12,
                                    padding: 12,
                                    generateLabels: function(chart) {
                                        const original = Chart.defaults.plugins.legend.labels.generateLabels;
                                        const labels = original.call(this, chart);
                                        
                                        // Filter out reference areas and ensure white fill
                                        const filteredLabels = labels.filter(label => {
                                            return !label.text.includes('NCAA Avg SR') &&
                                                   !label.text.includes('50/50') &&
                                                   !label.text.includes('Quarters');
                                        });
                                        
                                        // Ensure white fill for all line chart legend boxes
                                        filteredLabels.forEach((label) => {
                                            label.fillStyle = 'white';
                                        });
                                        
                                        return filteredLabels;
                                    }
                                }
                            } : {
                                position: 'top',
                                align: 'start',
                                labels: {
                                    usePointStyle: false,
                                    boxWidth: 12,
                                    boxHeight: 12,
                                    padding: 12,
                                    filter: function(legendItem, chartData) {
                                        return !legendItem.text.includes('NCAA Avg SR') &&
                                               !legendItem.text.includes('Quarters') &&
                                               !legendItem.text.includes('50/50');
                                    },
                                    generateLabels: function(chart) {
                                        const data = chart.data;
                                        if (data.datasets.length) {
                                            return data.datasets.map((dataset, i) => {
                                                // Handle backgroundColor arrays (like in Overall Team Performance chart)
                                                let fillColor = dataset.backgroundColor;
                                                if (dataset.label === '# Plays') {
                                                    fillColor = 'white';
                                                } else if (Array.isArray(dataset.backgroundColor)) {
                                                    // For datasets with backgroundColor arrays, use the first color for legend
                                                    fillColor = dataset.backgroundColor[0];
                                                }

                                                return {
                                                    text: dataset.label,
                                                    fillStyle: fillColor,
                                                    strokeStyle: dataset.label === '# Plays' ? '#666' : dataset.borderColor,
                                                    lineWidth: dataset.label === '# Plays' ? 1 : dataset.borderWidth,
                                                    hidden: !chart.isDatasetVisible(i),
                                                    datasetIndex: i
                                                };
                                            }).filter((item, index) => {
                                                // Apply the same filter logic as above
                                                const dataset = chart.data.datasets[index];
                                                if (!dataset || !dataset.data) return false;
                                                if (dataset.label === '# Plays') return true; // Always show # Plays
                                                if (dataset.label && (dataset.label.includes('NCAA Avg SR') || 
                                                                    dataset.label.includes('Quarters') || 
                                                                    dataset.label.includes('50/50'))) return false;
                                                return dataset.data.some((value) => value > 0);
                                            });
                                        }
                                        return [];
                                    }
                                }
                            },
                            tooltip: {
                                filter: function(tooltipItem) {
                                    if ('${_chartId}'.includes('play-map')) {
                                        return !tooltipItem.dataset.label.includes('< 0') &&
                                               !tooltipItem.dataset.label.includes('Quarters') &&
                                               !tooltipItem.dataset.label.includes('Drive');
                                    }
                                    return !tooltipItem.dataset.label.includes('NCAA Avg SR') && 
                                           !tooltipItem.dataset.label.includes('50/50') && 
                                           !tooltipItem.dataset.label.includes('< 0') &&
                                           !tooltipItem.dataset.label.includes('Quarters');
                                },
                                callbacks: {
                                    label: function(context) {
                                        const label = context.dataset.label || '';
                                        let labelText;
                                        
                                        // Play maps show yards instead of percentages
                                        if ('${_chartId}'.includes('play-map')) {
                                            labelText = label + ': ' + context.parsed.y + ' yards';
                                        } else {
                                            const value = Math.round(context.parsed.y * 100);
                                            labelText = label + ': ' + value + '%';
                                        }
                                        
                                        // For line charts, include play text if available
                                        if ('${_chartType}' === 'line' && context.raw && context.raw.text) {
                                            return [labelText, context.raw.text];
                                        }
                                        
                                        return labelText;
                                    }
                                }
                            }
                        },
                        scales: '${_chartType}' === 'line' ? '${_chartId}'.includes('play-map') ? {
                            x: {
                                type: 'linear',
                                position: 'bottom',
                                title: {
                                    display: true,
                                    text: 'Play Number'
                                },
                                min: 1,
                                ticks: {
                                    stepSize: 1,
                                    callback: function(value) {
                                        return Math.floor(value);
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Yards Gained'
                                },
                                min: chartData.minY,
                                max: chartData.maxY
                            }
                        } : {
                            x: {
                                type: 'linear',
                                position: 'bottom',
                                title: {
                                    display: true,
                                    text: '${_chartId}'.includes('team-lines') ? 'Play Number' : 'Team Play Number'
                                },
                                min: 1,
                                ticks: {
                                    stepSize: 1,
                                    callback: function(value) {
                                        return Math.floor(value);
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                max: 1,
                                min: 0,
                                ticks: {
                                    callback: function(value) {
                                        return Math.round(value * 100) + '%';
                                    }
                                }
                            }
                        } : '${_chartId}'.includes('drive-metrics') ? {
                            y: {
                                stacked: false,
                                max: 1,
                                ticks: {
                                    callback: function(value) {
                                        return Math.round(value * 100) + '%';
                                    }
                                }
                            },
                            y1: {
                                display: false,
                                type: 'linear',
                                position: 'right'
                            }
                        } : ('${_chartId}'.includes('top-rushers') || '${_chartId}'.includes('top-passers') || '${_chartId}'.includes('top-receivers')) ? {
                            x: {
                                stacked: true
                            },
                            y: {
                                stacked: true
                            }
                        } : {
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
                    
                    // Add indexAxis for player charts
                    if ('${_chartId}'.includes('top-rushers') || '${_chartId}'.includes('top-passers') || '${_chartId}'.includes('top-receivers')) {
                        chartOptions.indexAxis = 'y';
                    }
                    
                    // Initialize the chart
                    const ctx = canvas.getContext('2d');
                    const chart = new Chart(ctx, {
                        type: '${_chartType}',
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
        const enhancedData = {
          ...overallTeamData,
          teamColors: chartData.teamColors,
          opponentColors: chartData.opponentColors,
          teamPlayCount: chartData.teamPlays.length,
          opponentPlayCount: chartData.opponentPlays.length,
          currentParams: currentParams
        };
        embedCode = generateEmbedCode(chartId, title, enhancedData, barOptions, 'bar');
        break;
      }
      case 'team-lines': {
        const enhancedData = { ...teamLinesData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, lineOptionsPlayNumberSRXR, 'line');
        break;
      }
      case 'team-play-type-lines': {
        const enhancedData = { ...teamPlayTypeLinesData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, lineOptionsTeamPlay, 'line');
        break;
      }
      case 'opponent-play-type-lines': {
        const enhancedData = { ...opponentPlayTypeLinesData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, lineOptionsTeamPlay, 'line');
        break;
      }
      case 'team-rush-rate': {
        const enhancedData = { ...teamRushRateData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, lineOptionsTeamPlay, 'line');
        break;
      }
      case 'opponent-rush-rate': {
        const enhancedData = { ...opponentRushRateData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, lineOptionsTeamPlay, 'line');
        break;
      }
      case 'team-play-map': {
        const enhancedPlayMapData = {
          ...teamPlayMapData,
          minY: teamMinY,
          maxY: teamMaxY,
          currentParams: currentParams
        };
        embedCode = generateEmbedCode(chartId, title, enhancedPlayMapData, teamPlayMapOptions, 'line');
        break;
      }
      case 'opponent-play-map': {
        const enhancedPlayMapData = {
          ...opponentPlayMapData,
          minY: oppMinY,
          maxY: oppMaxY,
          currentParams: currentParams
        };
        embedCode = generateEmbedCode(chartId, title, enhancedPlayMapData, opponentPlayMapOptions, 'line');
        break;
      }
      case 'team-drive-metrics': {
        const enhancedData = { ...teamDriveChartData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, driveOptions, 'bar');
        break;
      }
      case 'opponent-drive-metrics': {
        const enhancedData = { ...opponentDriveChartData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, driveOptions, 'bar');
        break;
      }
      case 'play-type-bars': {
        const barData = createTeamVsOpponentBarData('playType');
        const enhancedBarData = enhanceBarDataWithCounts(barData);
        enhancedBarData.currentParams = currentParams;
        embedCode = generateEmbedCode(chartId, title, enhancedBarData, barOptions, 'bar');
        break;
      }
      case 'quarter-bars': {
        const barData = createTeamVsOpponentBarData('quarter');
        const enhancedBarData = enhanceBarDataWithCounts(barData);
        enhancedBarData.currentParams = currentParams;
        embedCode = generateEmbedCode(chartId, title, enhancedBarData, barOptions, 'bar');
        break;
      }
      case 'down-bars': {
        const barData = createTeamVsOpponentBarData('down');
        const enhancedBarData = enhanceBarDataWithCounts(barData);
        enhancedBarData.currentParams = currentParams;
        embedCode = generateEmbedCode(chartId, title, enhancedBarData, barOptions, 'bar');
        break;
      }
      case 'red-zone-bars': {
        const barData = createTeamVsOpponentBarData('redZone');
        const enhancedBarData = enhanceBarDataWithCounts(barData);
        enhancedBarData.currentParams = currentParams;
        embedCode = generateEmbedCode(chartId, title, enhancedBarData, barOptions, 'bar');
        break;
      }
      case 'distance-bars': {
        const barData = createTeamVsOpponentBarData('distance');
        const enhancedBarData = enhanceBarDataWithCounts(barData);
        enhancedBarData.currentParams = currentParams;
        embedCode = generateEmbedCode(chartId, title, enhancedBarData, barOptions, 'bar');
        break;
      }
      case 'top-rushers': {
        const playerData = createPlayerData(allRushers, 'rush');
        const enhancedData = { ...playerData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, playerOptions, 'bar');
        break;
      }
      case 'top-passers': {
        const playerData = createPlayerData(allPassers, 'pass');
        const enhancedData = { ...playerData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, playerOptions, 'bar');
        break;
      }
      case 'top-receivers': {
        const playerData = createPlayerData(allReceivers, 'receive');
        const enhancedData = { ...playerData, currentParams: currentParams };
        embedCode = generateEmbedCode(chartId, title, enhancedData, playerOptions, 'bar');
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
      
      // Track embed copy event in Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'copy_embed', {
          'event_category': 'user_interaction',
          'event_label': `${chartId}_${title}`,
          'custom_parameter_chart_id': chartId,
          'custom_parameter_chart_title': title,
          'custom_parameter_chart_type': chartId.includes('lines') || chartId.includes('rush-rate') || chartId.includes('play-map') ? 'line' : 'bar',
          'custom_parameter_team': currentParams?.team || '',
          'custom_parameter_year': currentParams?.year || '',
          'custom_parameter_week': currentParams?.week || '',
          'custom_parameter_season_type': currentParams?.seasonType || ''
        });
      }
      
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


  const chartData = useChartData(plays, team, selectedTeamColor, selectedOpponentColor);
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
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Team charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {teamCharts.map((chart) => (
            <div key={chart.id} className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {chart.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(chart.id, chart.title)}
                  className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                    copiedChart === chart.id
                      ? 'border-green-300 bg-green-50'
                      : 'border-neutral-300 hover:bg-neutral-50'
                  }`}
                  title={copiedChart === chart.id ? "Copied!" : "Copy embed code"}
                >
                  {copiedChart === chart.id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-neutral-600" />
                  )}
                </button>
              </div>
              
              <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
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
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Player charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Rushers and Passers stacked */}
          <div className="space-y-6">
            {/* Top Rushers */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {playerCharts[0].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[0].id, playerCharts[0].title)}
                  className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                    copiedChart === playerCharts[0].id
                      ? 'border-green-300 bg-green-50'
                      : 'border-neutral-300 hover:bg-neutral-50'
                  }`}
                  title={copiedChart === playerCharts[0].id ? "Copied!" : "Copy embed code"}
                >
                  {copiedChart === playerCharts[0].id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-neutral-600" />
                  )}
                </button>
              </div>
              
              <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                <div className="h-80">
                  {playerCharts[0].component}
                </div>
              </div>
            </div>

            {/* Top Passers */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {playerCharts[1].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[1].id, playerCharts[1].title)}
                  className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                    copiedChart === playerCharts[1].id
                      ? 'border-green-300 bg-green-50'
                      : 'border-neutral-300 hover:bg-neutral-50'
                  }`}
                  title={copiedChart === playerCharts[1].id ? "Copied!" : "Copy embed code"}
                >
                  {copiedChart === playerCharts[1].id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-neutral-600" />
                  )}
                </button>
              </div>
              
              <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                <div className="h-50" style={{ height: '200px' }}>
                  {playerCharts[1].component}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Receivers spanning full height */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {playerCharts[2].title}
                </h3>
              </div>
              <button
                onClick={() => handleCopyEmbed(playerCharts[2].id, playerCharts[2].title)}
                className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                  copiedChart === playerCharts[2].id
                    ? 'border-green-300 bg-green-50'
                    : 'border-neutral-300 hover:bg-neutral-50'
                }`}
                title={copiedChart === playerCharts[2].id ? "Copied!" : "Copy embed code"}
              >
                {copiedChart === playerCharts[2].id ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-neutral-600" />
                )}
              </button>
            </div>
            
            <div className="pt-5 px-6 pb-6 sm:pt-5 sm:px-6 sm:pb-6">
              <div className="h-[640px]">
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