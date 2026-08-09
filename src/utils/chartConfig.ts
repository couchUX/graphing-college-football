import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

// Set Chart.js global defaults
export const initializeChartDefaults = () => {
  // Chart.js accepts the `point*` aliases at runtime but doesn't declare them
  // on the element defaults, and `plugins.datalabels` is optional in its types
  // until the plugin registers. Narrow both rather than changing any value.
  const pointDefaults = ChartJS.defaults.elements.point as unknown as Record<string, number>;
  const datalabelDefaults = ChartJS.defaults.plugins.datalabels as unknown as Record<string, unknown>;

  ChartJS.defaults.plugins.legend.align = 'start';
  ChartJS.defaults.maintainAspectRatio = false;
  ChartJS.defaults.plugins.legend.labels.borderRadius = 15;
  ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
  ChartJS.defaults.plugins.legend.labels.padding = 12;
  ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
  ChartJS.defaults.elements.line.tension = 0.25;
  ChartJS.defaults.elements.line.borderWidth = 1;
  pointDefaults.pointRadius = 4;
  pointDefaults.pointHoverRadius = 8;
  pointDefaults.pointBorderWidth = 1;
  datalabelDefaults.color = 'white';
  datalabelDefaults.backgroundColor = '#26262660';
  datalabelDefaults.padding = 4;
  datalabelDefaults.borderRadius = 4;
};

// Constants
export const NCAA_AVERAGE_SR = 0.42;
export const RUSH_PASS_SPLIT = 0.5;

// Utility functions
export const percentCallback = (value: number) => `${Math.round(value * 100)}%`;

// Filter functions for legends and tooltips
export const legendFilter = (item: any) => {
  return !item.text.includes('NCAA Avg SR') && 
         !item.text.includes('50/50') && 
         !item.text.includes('< 0') &&
         !item.text.includes('Quarters');
};

export const tooltipFilter = (tooltipItem: any) => {
  return !tooltipItem.dataset.label.includes('NCAA Avg SR') && 
         !tooltipItem.dataset.label.includes('50/50') && 
         !tooltipItem.dataset.label.includes('< 0') &&
         !tooltipItem.dataset.label.includes('Quarters');
};

// Base tooltip callback
export const baseTooltipCallback = (context: any) => 
  `${context.dataset.label}: ${Math.round(context.parsed.y * 100)}%`;

// Tooltip with play text
export const tooltipWithPlayText = {
  filter: tooltipFilter,
  callbacks: {
    label: (context: any) => {
      const label = `${context.dataset.label}: ${Math.round(context.parsed.y * 100)}%`;
      const text = context.raw.text;
      return text ? [label, text] : label;
    }
  }
};

// Enhanced datalabels configuration for player charts (bar charts only)
export const enhancedDatalabelsConfig = {
  display: true,
  color: 'white',
  font: {
    weight: 'normal' as const,
    size: 12,
  },
  formatter: (value: number) => {
    // Hide data labels for zero or negative values
    return value > 0 ? value : null;
  },
  anchor: 'center' as const,
  align: 'center' as const,
  backgroundColor: function(context: any) {
    // Only show background when there's a value to display
    const value = context.dataset.data[context.dataIndex];
    return value > 0 ? '#26262660' : 'transparent';
  },
  borderColor: function(context: any) {
    // Only show border when there's a value to display  
    const value = context.dataset.data[context.dataIndex];
    return value > 0 ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
  },
  padding: 4,
  borderRadius: 4,
};

// Disabled datalabels configuration for line charts
export const disabledDatalabelsConfig = {
  display: false,
};