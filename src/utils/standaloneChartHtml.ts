import type { DetectorResult } from '../detectors/types';

const escapeHtml = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Strip non-serializable values (functions, undefined) so the chart config
 * survives JSON.stringify. Tooltip callbacks and dynamic formatters are
 * intentionally dropped — the standalone export is a static artifact.
 */
const sanitizeForJson = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) {
    return value.map(sanitizeForJson);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeForJson(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
};

export const buildStandaloneHtml = (result: DetectorResult): string => {
  const chartConfig = {
    type: result.chart.type,
    data: sanitizeForJson(result.chart.data),
    options: sanitizeForJson({
      ...result.chart.options,
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
    }),
  };

  const chartConfigJson = JSON.stringify(chartConfig);
  const chartHeight = result.chart.height ?? 420;

  const rowsHtml = (result.rows ?? [])
    .map(
      r => `
        <tr>
          <td class="row-label">${escapeHtml(r.label)}</td>
          <td class="row-value">${escapeHtml(r.value)}</td>
          ${r.hint ? `<td class="row-hint">${escapeHtml(r.hint)}</td>` : '<td></td>'}
        </tr>`
    )
    .join('');

  const calloutHtml = result.callout
    ? `<div class="callout">${escapeHtml(result.callout)}</div>`
    : '';

  const rowsTableHtml = result.rows && result.rows.length
    ? `
      <table class="rows-table">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(result.headline)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #f5f5f5;
      color: #1f2937;
      padding: 32px 16px;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      padding: 32px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 18px; }
    .actions { display: flex; gap: 10px; margin-bottom: 18px; }
    button {
      padding: 8px 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      color: #1f2937;
    }
    button.primary {
      background: #1f2937;
      color: #fff;
      border-color: #1f2937;
    }
    button:hover { background: #f3f4f6; }
    button.primary:hover { background: #111827; }
    .callout {
      background: #f9fafb;
      border-left: 3px solid #2563eb;
      padding: 10px 14px;
      font-size: 13px;
      color: #374151;
      border-radius: 4px;
      margin-bottom: 18px;
    }
    .chart-box {
      position: relative;
      height: ${chartHeight}px;
      margin-bottom: 24px;
    }
    .rows-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .rows-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f3f4f6;
    }
    .row-label { font-weight: 600; color: #1f2937; }
    .row-value { color: #111827; }
    .row-hint { color: #6b7280; text-align: right; }
    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #6b7280;
    }
    .footer a { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(result.headline)}</h1>
    <div class="subtitle">${escapeHtml(result.subtext)}</div>
    <div class="actions">
      <button class="primary" id="save-png">Save as PNG</button>
    </div>
    ${calloutHtml}
    <div class="chart-box">
      <canvas id="chart"></canvas>
    </div>
    ${rowsTableHtml}
    <div class="footer">
      Data from <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a> ·
      Generated by <a href="https://graphingcollegefootball.com" target="_blank" rel="noopener">Graphing College Football</a>
    </div>
  </div>
  <script>
    (function () {
      if (window.ChartDataLabels) {
        Chart.register(window.ChartDataLabels);
      }

      var config = ${chartConfigJson};

      // Restore a sensible datalabels formatter (stripped during JSON serialization).
      config.options = config.options || {};
      config.options.plugins = config.options.plugins || {};
      config.options.plugins.datalabels = Object.assign({}, config.options.plugins.datalabels, {
        formatter: function (value) {
          if (value === null || value === undefined || value === 0) return '';
          return typeof value === 'number' ? value.toFixed(2) : value;
        },
      });

      var ctx = document.getElementById('chart').getContext('2d');
      var chart = new Chart(ctx, config);

      document.getElementById('save-png').addEventListener('click', function () {
        var link = document.createElement('a');
        link.download = 'chart.png';
        link.href = chart.toBase64Image('image/png', 1);
        link.click();
      });
    })();
  </script>
</body>
</html>`;
};

export const openStandalone = (result: DetectorResult): void => {
  const html = buildStandaloneHtml(result);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
};
