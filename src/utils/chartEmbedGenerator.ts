/**
 * Generic "copy embed code" generator.
 *
 * Takes the exact Chart.js config a chart is rendered with on screen and wraps
 * it in a self-contained, CMS-safe HTML snippet (scoped styles + CDN Chart.js +
 * inline init script) matching the look of the Games/Season-trends embeds.
 *
 * Fidelity strategy:
 * - Data and options are serialized as a JS object literal, with function
 *   values (tick callbacks, legend filters, datalabel color functions, ...)
 *   preserved via Function.prototype.toString. Those functions MUST be
 *   closure-free — they may only use their arguments and globals.
 * - Tooltip callbacks and datalabel formatters often close over local data, so
 *   instead of serializing them they are "baked": invoked once per data point
 *   at copy time, with the resulting strings stored on the dataset and read
 *   back by closure-free reader callbacks in the embed.
 */

export interface ChartEmbedRow {
  label: string;
  value: string;
  hint?: string;
}

export interface ChartEmbedSpec {
  /** Chart.js chart type ('bar' | 'line' | 'scatter' | ...). */
  chartType: string;
  /** Chart.js data object, exactly as rendered on screen. */
  data: any;
  /** Chart.js options object, exactly as rendered on screen. */
  options: any;
  title: string;
  subtitle?: string;
  /** Footer link target ("See all charts"). */
  sourceUrl: string;
  sourceLabel?: string;
  /** Chart area height in px (desktop). */
  height: number;
  /** Chart area height in px on small screens (defaults to `height`). */
  mobileHeight?: number;
  /** Optional accordion bullets (HTML allowed — caller is trusted). */
  definitions?: string[];
  /** Optional accordion rows table (e.g. Discover "Show details" rows). */
  rows?: ChartEmbedRow[];
  /** Accordion toggle label. */
  detailsLabel?: string;
}

const escapeHtml = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// JSON.stringify a string but escape '<' so '</script>' inside labels can
// never terminate the embed's inline <script> tag.
const jsString = (s: string): string => JSON.stringify(s).replace(/</g, '\\u003c');

/**
 * Serialize a value to a JS object-literal string, preserving functions via
 * toString. Functions must be closure-free (arguments + globals only) or the
 * emitted code will throw ReferenceErrors when the embed runs.
 */
export const toJsLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t === 'function') return String(value);
  if (t === 'number') return Number.isFinite(value as number) ? String(value) : 'null';
  if (t === 'boolean') return String(value);
  if (t === 'string') return jsString(value as string);
  if (Array.isArray(value)) {
    return `[${value.map(v => toJsLiteral(v)).join(',')}]`;
  }
  if (t === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && typeof v !== 'symbol')
      .map(([k, v]) => `${jsString(k)}:${toJsLiteral(v)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
};

const asLines = (v: unknown): string[] | null => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
};

/**
 * Pre-compute tooltip titles/labels and datalabel strings for every data point
 * by calling the live (possibly closure-capturing) callbacks now, then replace
 * those callbacks with closure-free readers that the serializer can emit.
 * Returns cleaned copies; the originals are not mutated.
 */
const bakeDynamicContent = (data: any, options: any, indexAxis: string) => {
  const tooltipCallbacks = options?.plugins?.tooltip?.callbacks;
  const chartFormatter = options?.plugins?.datalabels?.formatter;

  const datasets = (data?.datasets ?? []).map((dataset: any, datasetIndex: number) => {
    const cleaned = { ...dataset };
    const points: any[] = Array.isArray(dataset.data) ? dataset.data : [];

    const mockItem = (i: number) => {
      const raw = points[i];
      const numeric = typeof raw === 'number' ? raw : null;
      const parsed =
        raw && typeof raw === 'object'
          ? { x: (raw as any).x, y: (raw as any).y }
          : indexAxis === 'y'
            ? { x: numeric, y: i }
            : { x: i, y: numeric };
      return {
        dataIndex: i,
        datasetIndex,
        raw,
        dataset,
        label: data?.labels?.[i] != null ? String(data.labels[i]) : '',
        parsed,
        formattedValue: raw == null ? '' : String(typeof raw === 'object' ? parsed.y : raw),
      };
    };

    // Bake tooltip label lines (per point) for this dataset.
    if (typeof tooltipCallbacks?.label === 'function') {
      try {
        cleaned.embedTooltipLabels = points.map((_p, i) => asLines(tooltipCallbacks.label(mockItem(i))));
      } catch {
        // Leave unbaked; the embed falls back to a default label.
      }
    }

    // Bake datalabel strings when a formatter exists (dataset-level wins).
    const formatter = dataset.datalabels?.formatter ?? chartFormatter;
    if (typeof formatter === 'function') {
      try {
        cleaned.embedDataLabels = points.map((p, i) =>
          formatter(p, { dataIndex: i, datasetIndex, dataset })
        );
        if (cleaned.datalabels?.formatter) {
          cleaned.datalabels = { ...cleaned.datalabels };
          delete cleaned.datalabels.formatter;
        }
      } catch {
        // Leave the original formatter in place; if it's closure-free it will
        // still serialize and run correctly.
      }
    }
    return cleaned;
  });

  // Bake tooltip titles once per data index (titles are per-category).
  let embedTooltipTitles: (string | null)[] | undefined;
  if (typeof tooltipCallbacks?.title === 'function' && datasets.length > 0) {
    const first: any[] = Array.isArray(data.datasets[0]?.data) ? data.datasets[0].data : [];
    try {
      embedTooltipTitles = first.map((_p: any, i: number) => {
        const raw = first[i];
        const item = {
          dataIndex: i,
          datasetIndex: 0,
          raw,
          dataset: data.datasets[0],
          label: data?.labels?.[i] != null ? String(data.labels[i]) : '',
        };
        const t = tooltipCallbacks.title([item]);
        const lines = asLines(t);
        return lines ? lines.join('\n') : null;
      });
    } catch {
      embedTooltipTitles = undefined;
    }
  }

  const cleanedData = { ...data, datasets, ...(embedTooltipTitles ? { embedTooltipTitles } : {}) };

  // Rebuild options with reader callbacks in place of the baked ones.
  const cleanedOptions = { ...(options ?? {}) };
  cleanedOptions.plugins = { ...(cleanedOptions.plugins ?? {}) };

  if (tooltipCallbacks) {
    const tooltip = { ...(cleanedOptions.plugins.tooltip ?? {}) };
    const callbacks: any = { ...tooltipCallbacks };
    if (typeof tooltipCallbacks.label === 'function') {
      callbacks.label = function (item: any) {
        const baked = item.dataset && item.dataset.embedTooltipLabels;
        if (baked && baked[item.dataIndex] !== undefined && baked[item.dataIndex] !== null) {
          return baked[item.dataIndex];
        }
        return (item.dataset && item.dataset.label ? item.dataset.label + ': ' : '') + item.formattedValue;
      };
    }
    if (typeof tooltipCallbacks.title === 'function') {
      callbacks.title = function (items: any[]) {
        const chart = items && items[0] && items[0].chart;
        const titles = chart && chart.data && (chart.data as any).embedTooltipTitles;
        if (titles && items[0] && titles[items[0].dataIndex] != null) return titles[items[0].dataIndex];
        return items && items[0] ? items[0].label : '';
      };
    }
    tooltip.callbacks = callbacks;
    cleanedOptions.plugins.tooltip = tooltip;
  }

  const hasBakedDataLabels = datasets.some((d: any) => d.embedDataLabels !== undefined);
  if (hasBakedDataLabels) {
    const datalabels = { ...(cleanedOptions.plugins.datalabels ?? {}) };
    datalabels.formatter = function (value: any, context: any) {
      const baked = context.dataset && context.dataset.embedDataLabels;
      if (baked !== undefined && baked !== null) return baked[context.dataIndex];
      return value;
    };
    cleanedOptions.plugins.datalabels = datalabels;
  }

  return { cleanedData, cleanedOptions };
};

export const generateChartEmbed = (spec: ChartEmbedSpec): string => {
  const {
    chartType,
    title,
    subtitle,
    sourceUrl,
    sourceLabel = 'See all charts',
    height,
    mobileHeight = spec.height,
    definitions = [],
    rows = [],
    detailsLabel = rows.length > 0 ? 'Show details' : 'Data definitions',
  } = spec;

  const uniqueId = `cfb-chart-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const fnSuffix = uniqueId.replace(/-/g, '_');

  const indexAxis = spec.options?.indexAxis === 'y' ? 'y' : 'x';
  const { cleanedData, cleanedOptions } = bakeDynamicContent(spec.data, spec.options, indexAxis);

  // Static embeds should render instantly and always fill their container.
  cleanedOptions.responsive = true;
  cleanedOptions.maintainAspectRatio = false;
  cleanedOptions.animation = { duration: 1 };

  const serializedData = toJsLiteral(cleanedData);
  const serializedOptions = toJsLiteral(cleanedOptions);

  const hasDetails = definitions.length > 0 || rows.length > 0;

  const detailsInnerHtml =
    rows.length > 0
      ? `<table class="details-table"><tbody>${rows
          .map(
            r =>
              `<tr><td class="details-label">${escapeHtml(r.label)}</td><td class="details-value">${escapeHtml(
                r.value
              )}</td><td class="details-hint">${escapeHtml(r.hint ?? '')}</td></tr>`
          )
          .join('')}</tbody></table>`
      : `<ul>${definitions.map(def => `<li>${def}</li>`).join('')}</ul>`;

  return `<!-- CFB Analytics Chart Embed: ${escapeHtml(title)} -->
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
            height: ${height}px;
        }

        @media (max-width: 640px) {
            .cfb-chart-embed-${uniqueId} .chart-content {
                padding: 12px 16px 20px !important;
                height: ${mobileHeight}px !important;
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
        .cfb-chart-embed-${uniqueId} .details-table {
            width: 100%;
            border-collapse: collapse;
        }
        .cfb-chart-embed-${uniqueId} .details-table td {
            padding: 5px 8px 5px 0;
            border-bottom: 1px solid #ececec;
            vertical-align: top;
        }
        .cfb-chart-embed-${uniqueId} .details-table tr:last-child td {
            border-bottom: none;
        }
        .cfb-chart-embed-${uniqueId} .details-label {
            font-weight: 600;
            color: #171717;
        }
        .cfb-chart-embed-${uniqueId} .details-value {
            color: #404040;
        }
        .cfb-chart-embed-${uniqueId} .details-hint {
            color: #737373;
            text-align: right;
        }
    </style>

    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">${escapeHtml(title)}</h3>
            ${subtitle ? `<p class="chart-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <div class="chart-content">
            <canvas id="${uniqueId}"></canvas>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${sourceUrl}" class="embed-footer-link" target="_blank">${escapeHtml(sourceLabel)}</a>
                ${hasDetails ? `<button class="data-definitions-toggle" onclick="toggleDefinitions_${fnSuffix}()">
                    ${escapeHtml(detailsLabel)}
                    <span class="caret" id="caret_${uniqueId}">▼</span>
                </button>` : ''}
            </div>
            ${hasDetails ? `<div class="data-definitions" id="dataDefinitions_${uniqueId}">
                ${detailsInnerHtml}
            </div>` : ''}
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"><\/script>

    <script>
        ${hasDetails ? `// Toggle details accordion
        function toggleDefinitions_${fnSuffix}() {
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
        ` : ''}
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

                if (typeof Chart === 'undefined' || typeof ChartDataLabels === 'undefined') {
                    if (retryCount >= maxRetries) {
                        showError('Chart library failed to load. Please refresh the page.');
                        return;
                    }
                    setTimeout(initChart, 100);
                    return;
                }

                const canvas = document.getElementById('${uniqueId}');
                if (!canvas) {
                    setTimeout(initChart, 100);
                    return;
                }

                if (canvas.chartInstance) {
                    return;
                }

                try {
                    Chart.register(ChartDataLabels);

                    // Match the app's global Chart.js defaults so the embed
                    // renders identically to the on-screen chart.
                    Chart.defaults.plugins.legend.align = 'start';
                    Chart.defaults.maintainAspectRatio = false;
                    Chart.defaults.plugins.legend.labels.borderRadius = 15;
                    Chart.defaults.plugins.legend.labels.boxWidth = 8;
                    Chart.defaults.plugins.legend.labels.padding = 12;
                    Chart.defaults.plugins.legend.labels.usePointStyle = true;
                    Chart.defaults.elements.line.tension = 0.25;
                    Chart.defaults.elements.line.borderWidth = 1;
                    Chart.defaults.elements.point.pointRadius = 4;
                    Chart.defaults.elements.point.pointHoverRadius = 8;
                    Chart.defaults.elements.point.pointBorderWidth = 1;
                    Chart.defaults.plugins.datalabels.color = 'white';
                    Chart.defaults.plugins.datalabels.backgroundColor = '#26262660';
                    Chart.defaults.plugins.datalabels.padding = 4;
                    Chart.defaults.plugins.datalabels.borderRadius = 4;

                    const chart = new Chart(canvas, {
                        type: '${chartType}',
                        data: ${serializedData},
                        options: ${serializedOptions}
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
