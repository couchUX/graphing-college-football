// Shared builder for the box-score "copy embed code" HTML — a self-contained
// CMS-safe table (two value columns) used by both the Season-trends box score
// (team vs. opponents) and the Team-vs-Team box score (team A vs. team B).

export interface BoxScoreEmbedColumn {
  label: string;
  /** Header underline color. */
  color: string;
}

export interface BoxScoreEmbedRow {
  label: string;
  leftValue: string;
  rightValue: string;
}

export interface BoxScoreEmbedOptions {
  title: string;
  subtitle: string;
  /** "See all charts" footer link target. */
  sourceUrl: string;
  left: BoxScoreEmbedColumn;
  right: BoxScoreEmbedColumn;
  rows: BoxScoreEmbedRow[];
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

export const buildBoxScoreEmbedHtml = ({
  title,
  subtitle,
  sourceUrl,
  left,
  right,
  rows,
}: BoxScoreEmbedOptions): string => {
  const statsRows = rows
    .map(
      (row, index) => `
    <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}">
      <td class="px-4 py-3 text-sm font-medium text-neutral-900">${escapeHtml(row.label)}</td>
      <td class="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">${escapeHtml(row.leftValue)}</td>
      <td class="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">${escapeHtml(row.rightValue)}</td>
    </tr>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
            background: #f8fafc;
        }
        .embed-container {
            background: white;
            border-radius: 12px;
            border: 1px solid #e5e5e5;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            max-width: 800px;
            margin: 0 auto;
            padding: 0;
        }
        .header {
            padding: 18px 24px 14px;
            border-bottom: 1px solid #e5e5e5;
            background: white;
        }
        .title {
            font-size: 18px;
            font-weight: 600;
            color: #171717;
            margin: 0;
        }
        .subtitle {
            font-size: 11px;
            font-weight: 400;
            color: #737373;
            margin: 4px 0 0 0;
        }
        .table-wrapper {
            padding: 0;
        }
        table {
            min-width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
        }
        .col-stat { width: auto; }
        .col-team { width: 140px; }
        thead tr {
            background-color: #525252;
            color: white;
        }
        th {
            padding: 12px 16px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            border-bottom: 4px solid #475569;
            text-align: center;
        }
        th.stat-header {
            text-align: left;
        }
        tbody tr {
            border-bottom: 1px solid #e5e5e5;
        }
        .bg-white {
            background-color: #ffffff;
        }
        .bg-neutral-50 {
            background-color: #fafafa;
        }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .font-medium { font-weight: 500; }
        .font-semibold { font-weight: 600; }
        .text-neutral-900 { color: #171717; }
        .text-center { text-align: center; }
        .embed-footer {
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #737373;
        }
        .embed-footer-top {
            display: flex;
            justify-content: center;
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

        @media (max-width: 640px) {
            .header { padding: 12px 16px; }
            th, td { padding: 8px 12px; }
            .title { font-size: 16px; }
            .embed-footer-top { padding: 8px 12px; }
            .col-team { width: 80px; }
            th, td { font-size: 13px; }
        }
    </style>
</head>
<body>
    <div class="embed-container">
        <div class="header">
            <h3 class="title">${escapeHtml(title)}</h3>
            <p class="subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <div class="table-wrapper">
            <table>
                <colgroup>
                    <col class="col-stat" />
                    <col class="col-team" />
                    <col class="col-team" />
                </colgroup>
                <thead>
                    <tr>
                        <th class="stat-header">Stats</th>
                        <th style="border-bottom-color: ${escapeHtml(left.color || '#6b7280')}; text-align: center;">${escapeHtml(left.label)}</th>
                        <th style="border-bottom-color: ${escapeHtml(right.color || '#9CA3AF')}; text-align: center;">${escapeHtml(right.label)}</th>
                    </tr>
                </thead>
                <tbody>
                    ${statsRows}
                </tbody>
            </table>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${escapeHtml(sourceUrl)}" class="embed-footer-link" target="_blank" rel="noopener noreferrer">See all charts</a>
            </div>
        </div>
    </div>
</body>
</html>`;
};
