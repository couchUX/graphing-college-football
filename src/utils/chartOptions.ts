import { ChartOptions } from 'chart.js';
import { percentCallback, legendFilter, baseTooltipCallback, tooltipWithPlayText, enhancedDatalabelsConfig, disabledDatalabelsConfig } from './chartConfig';

// Enhanced base options with improved datalabels from Bolt
export const createBaseOptions = (): ChartOptions<any> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    datalabels: enhancedDatalabelsConfig,
    legend: {
      position: 'top' as const,
      align: 'start' as const,
      labels: {
        usePointStyle: false,
        boxWidth: 12,
        boxHeight: 12,
        padding: 12,
        filter: legendFilter
      }
    },
    tooltip: {
      filter: tooltipWithPlayText.filter,
      callbacks: {
        label: baseTooltipCallback
      }
    },
  },
});

// Line chart options for play number charts (SR/XR over time)
export const createLineOptionsPlayNumberSRXR = (): ChartOptions<'line'> => ({
  ...createBaseOptions(),
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: 'Play Number'
      },
      min: 1,
      ticks: {
        stepSize: 1,
        callback: (value: any) => Math.floor(value)
      },
      grid: {
        display: false // Hide default gridlines since we're using quarter lines
      }
    },
    y: {
      max: 1,
      min: 0,
      ticks: { callback: percentCallback }
    }
  },
  elements: {
    line: { tension: 0.25, borderWidth: 2.2 },
    point: { pointRadius: 0 } // Hide points on this chart
  },
  plugins: {
    ...createBaseOptions().plugins,
    datalabels: disabledDatalabelsConfig,
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: false, // Use boxes instead of point styles
        boxWidth: 12, // Larger box size for better visibility
        boxHeight: 12, // Keep 1:1 ratio
        padding: 12,
        filter: legendFilter
      }
    },
    tooltip: tooltipWithPlayText
  }
});

// Line chart options for general play number charts
export const createLineOptionsPlayNumber = (): ChartOptions<'line'> => ({
  ...createBaseOptions(),
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: 'Play Number'
      },
      min: 1,
      ticks: {
        stepSize: 1,
        callback: (value: any) => Math.floor(value)
      },
      grid: {
        display: false
      }
    },
    y: {
      max: 1,
      min: 0,
      ticks: { callback: percentCallback }
    }
  },
  elements: {
    line: { tension: 0.25, borderWidth: 2.2 }
  },
  plugins: {
    ...createBaseOptions().plugins,
    datalabels: disabledDatalabelsConfig,
    tooltip: tooltipWithPlayText,
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: true,
        generateLabels: function(chart: any) {
          const original = chart.constructor.defaults.plugins.legend.labels.generateLabels;
          const labels = original.call(this, chart);
          
          // Customize each label based on dataset
          labels.forEach((label: any, index: number) => {
            const dataset = chart.data.datasets[index];
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
          
          return labels;
        },
        boxWidth: 20,
        padding: 12,
        filter: legendFilter
      }
    }
  }
});

// Line chart options for team play number charts
export const createLineOptionsTeamPlay = (): ChartOptions<'line'> => ({
  ...createBaseOptions(),
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: 'Team Play Number'
      },
      min: 1,
      ticks: {
        stepSize: 1,
        callback: (value: any) => Math.floor(value)
      },
      grid: {
        display: false
      }
    },
    y: {
      max: 1,
      min: 0,
      ticks: { callback: percentCallback }
    }
  },
  elements: {
    line: { tension: 0.25, borderWidth: 2.2 }
  },
  plugins: {
    ...createBaseOptions().plugins,
    datalabels: disabledDatalabelsConfig,
    tooltip: tooltipWithPlayText,
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: false,
        boxWidth: 12,
        boxHeight: 12,
        padding: 12,
        filter: legendFilter,
        generateLabels: function(chart: any) {
          const original = chart.constructor.defaults.plugins.legend.labels.generateLabels;
          const labels = original.call(this, chart);
          
          // Ensure white fill for all legend boxes
          labels.forEach((label: any) => {
            label.fillStyle = 'white';
          });
          
          return labels;
        }
      }
    }
  }
});

// Bar chart options
export const createBarOptions = (): ChartOptions<'bar'> => ({
  ...createBaseOptions(),
  scales: {
    y: {
      max: 1,
      min: 0,
      stacked: false,
      ticks: { callback: percentCallback }
    }
  },
  plugins: {
    ...createBaseOptions().plugins,
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: false, // Use boxes for bar charts
        boxWidth: 12, // Smaller box size for bar charts
        boxHeight: 12, // Keep 1:1 ratio
        padding: 12,
        filter: legendFilter,
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
            }).filter((_, index) => {
              // Apply the same filter logic as legendFilter
              const dataset = chart.data.datasets[index];
              if (!dataset || !dataset.data) return false;
              if (dataset.label === '# Plays') return true; // Always show # Plays
              return dataset.data.some((value) => {
                if (typeof value === 'number') {
                  return value > 0;
                }
                // Handle other data types like Point, BubbleDataPoint, etc.
                if (value && typeof value === 'object' && 'y' in value) {
                  return (value as any).y > 0;
                }
                return false;
              });
            });
          }
          return [];
        }
      }
    }
  }
});

// Play map options
export const createPlayMapOptions = (minY: number, maxY: number): ChartOptions<'line'> => ({
  ...createBaseOptions(),
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: { display: true, text: 'Play Number' },
      min: 1,
      ticks: {
        stepSize: 1,
        callback: (value: any) => Math.floor(value)
      },
      grid: {
        display: false
      }
    },
    y: { 
      title: { display: true, text: 'Yards Gained' },
      min: minY,
      max: maxY
    }
  },
  elements: {
    line: { tension: 0, borderWidth: 0 }
  },
  plugins: {
    ...createBaseOptions().plugins,
    datalabels: disabledDatalabelsConfig,
    tooltip: {
      filter: function(tooltipItem: any) {
        return !tooltipItem.dataset.label.includes('< 0') &&
               !tooltipItem.dataset.label.includes('Quarters') &&
               !tooltipItem.dataset.label.includes('Drive');
      },
      callbacks: {
        label: (context: any) => {
          const label = `${context.dataset.label}: ${context.parsed.y} yards`;
          const text = context.raw.text;
          return text ? [label, text] : label;
        }
      }
    },
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: true,
        generateLabels: function(chart: any) {
          const original = chart.constructor.defaults.plugins.legend.labels.generateLabels;
          const labels = original.call(this, chart);
          
          // Filter and customize each label
          const filteredLabels = labels.filter((label: any) => {
            return !label.text.includes('< 0') &&
                   !label.text.includes('Quarters') &&
                   !label.text.includes('Drive');
          });
          
          // Customize each label based on dataset
          filteredLabels.forEach((label: any) => {
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
      }
    }
  }
});

// Drive options
export const createDriveOptions = (teamDriveData: any[], opponentDriveData: any[]): ChartOptions<'bar'> => ({
  ...createBaseOptions(),
  scales: {
    y: {
      stacked: false,
      max: 1,
      ticks: { callback: percentCallback },
    },
    y1: {
      display: false,
      suggestedMax: Math.max(
        ...teamDriveData.map(d => d.count),
        ...opponentDriveData.map(d => d.count)
      ),
    }
  },
  plugins: {
    ...createBaseOptions().plugins,
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: false, // Use boxes for bar charts
        boxWidth: 12, // Smaller box size for bar charts
        boxHeight: 12, // Keep 1:1 ratio
        padding: 12,
        filter: legendFilter
      }
    }
  }
});

// Enhanced player options with stacked configuration
export const createPlayerOptions = (): ChartOptions<'bar'> => ({
  ...createBaseOptions(),
  indexAxis: 'y' as const,
  scales: {
    x: {
      stacked: true,
    },
    y: {
      stacked: true,
    }
  },
  plugins: {
    ...createBaseOptions().plugins,
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.parsed.x;
          const label = context.dataset.label || '';
          return `${label}: ${value} ${value === 1 ? 'play' : 'plays'}`;
        }
      }
    },
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: false, // Use boxes for bar charts
        boxWidth: 12, // Smaller box size for bar charts
        boxHeight: 12, // Keep 1:1 ratio
        padding: 12,
        filter: legendFilter
      }
    }
  }
});

// Win probability chart options with gradient color support
export const createWinProbabilityOptions = (): ChartOptions<'line'> => ({
  ...createBaseOptions(),
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: 'Play Number'
      },
      min: 0,
      ticks: {
        stepSize: 10,
        callback: (value: any) => Math.floor(value)
      },
      grid: {
        display: false // Remove vertical grid lines, use quarter lines instead
      }
    },
    y: {
      max: 100,
      min: 0,
      title: {
        display: true,
        text: 'Win Probability'
      },
      ticks: {
        callback: (value: any) => `${value}%`,
        stepSize: 10
      },
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)', // Darker gray to match quarter lines
        lineWidth: 1
      }
    }
  },
  elements: {
    line: {
      tension: 0.15,
      borderWidth: 2.2,
      fill: false
    },
    point: {
      pointRadius: 0, // Hide points by default
      pointHoverRadius: 4
    }
  },
  plugins: {
    ...createBaseOptions().plugins,
    datalabels: disabledDatalabelsConfig,
    legend: {
      display: false // Hide legend for win probability chart
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (tooltipItems: any[]) => {
          if (tooltipItems && tooltipItems[0]) {
            return `Play ${tooltipItems[0].dataIndex + 1}`;
          }
          return '';
        },
        label: (context: any) => {
          const selectedTeamWinProb = context.parsed.y;
          const opponentWinProb = 100 - selectedTeamWinProb;
          return [
            `${context.dataset.selectedTeam}: ${selectedTeamWinProb.toFixed(1)}%`,
            `${context.dataset.opponentTeam}: ${opponentWinProb.toFixed(1)}%`
          ];
        },
        afterLabel: (context: any) => {
          if (context.dataset.playTexts && context.dataset.playTexts[context.dataIndex]) {
            return `\n${context.dataset.playTexts[context.dataIndex]}`;
          }
          return '';
        }
      }
    }
  },
  interaction: {
    mode: 'index',
    intersect: false
  }
});