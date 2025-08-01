import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartOptions,
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
  ChartJS.defaults.plugins.legend.align = 'start';
  ChartJS.defaults.maintainAspectRatio = false;
  ChartJS.defaults.plugins.legend.labels.borderRadius = 15;
  ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
  ChartJS.defaults.plugins.legend.labels.padding = 12;
  ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
  ChartJS.defaults.elements.line.tension = 0.25;
  ChartJS.defaults.elements.line.borderWidth = 1;
  ChartJS.defaults.elements.point.pointRadius = 4;
  ChartJS.defaults.elements.point.pointHoverRadius = 8;
  ChartJS.defaults.elements.point.pointBorderWidth = 1;
  ChartJS.defaults.plugins.datalabels.color = 'white';
  ChartJS.defaults.plugins.datalabels.backgroundColor = '#26262660';
  ChartJS.defaults.plugins.datalabels.padding = 4;
  ChartJS.defaults.plugins.datalabels.borderRadius = 4;
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

// Enhanced datalabels configuration from Bolt improvements
export const enhancedDatalabelsConfig = {
  display: true,
  color: 'white',
  font: {
    weight: 'bold' as const,
    size: 11,
  },
  formatter: (value: number) => value > 0 ? value : '',
  anchor: 'center' as const,
  align: 'center' as const,
};