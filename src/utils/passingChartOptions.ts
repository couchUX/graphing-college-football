/**
 * Options for the passing charts whose axes aren't rates.
 *
 * The existing `createPlayerOptions` counts plays ("12 plays") in its tooltip
 * and is shared by three charts, so the yards-based depth chart gets its own
 * factory here rather than a flag threaded through a protected file. Everything
 * else — base options, the bar options the depth split uses — is reused as-is.
 */
import { ChartOptions } from 'chart.js';
import { createBaseOptions } from './chartOptions';
import { legendFilter } from './chartConfig';

/** The slices of Chart.js tooltip callback arguments these callbacks read. */
interface TooltipContext {
  parsed: { x: number };
  dataset: { label?: string };
}

interface TooltipItem {
  dataIndex: number;
  chart: { data: { meta?: PlayerMeta[] } };
}

interface PlayerMeta {
  attempts: number;
  completions: number;
  completionRate: number;
  aDOT: number;
}

/**
 * Horizontal stacked bars measured in yards, one row per player.
 *
 * The tooltip reads the per-player summary off `data.meta` rather than a
 * captured variable, so the callback stays closure-free and survives embed
 * serialization.
 */
export const createDepthYacOptions = (): ChartOptions<'bar'> => ({
  ...createBaseOptions(),
  indexAxis: 'y' as const,
  scales: {
    x: {
      stacked: true,
      title: {
        display: true,
        text: 'Yards',
      },
    },
    y: {
      stacked: true,
    },
  },
  plugins: {
    ...createBaseOptions().plugins,
    datalabels: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: (context: TooltipContext) => {
          const value = context.parsed.x;
          const label = context.dataset.label || '';
          return `${label}: ${value} ${value === 1 ? 'yard' : 'yards'}`;
        },
        afterBody: (items: TooltipItem[]) => {
          const meta = items?.[0]?.chart?.data?.meta?.[items[0].dataIndex];
          if (!meta) return '';
          const pct = Math.round((meta.completionRate || 0) * 100);
          return `${meta.completions}/${meta.attempts} · ${pct}% · ${meta.aDOT.toFixed(1)} aDOT`;
        },
      },
    },
    legend: {
      ...createBaseOptions().plugins?.legend,
      labels: {
        usePointStyle: false,
        boxWidth: 12,
        boxHeight: 12,
        padding: 12,
        filter: legendFilter,
      },
    },
  },
});
