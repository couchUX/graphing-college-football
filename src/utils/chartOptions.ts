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
        filter: legendFilter
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
        filter: legendFilter
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