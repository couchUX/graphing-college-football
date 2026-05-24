import type { ChartData, ChartOptions, ChartType } from 'chart.js';

export interface DetectorFilters {
  year: number;
  conference?: string; // 'all' | 'power4' | specific conference
  team?: string;
}

export interface DetectorChart {
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
  /** Approximate pixel height for the chart container. */
  height?: number;
}

export interface DetectorRow {
  label: string;
  value: string;
  hint?: string;
}

export interface DetectorResult {
  headline: string;
  subtext: string;
  chart: DetectorChart;
  /** Optional structured rows shown below the chart and in the standalone export. */
  rows?: DetectorRow[];
  /** Optional one-line "why this matters" callout. */
  callout?: string;
}

export interface Detector {
  id: string;
  title: string;
  description: string;
  run: (filters: DetectorFilters) => Promise<DetectorResult>;
}
