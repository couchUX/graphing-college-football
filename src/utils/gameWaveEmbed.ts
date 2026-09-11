import { QUARTER_MINUTES, type GameWaveModel } from './gameWave';
import {
  DOT_LABEL_COLOR,
  DOT_R,
  GRID_COLOR,
  LABEL_BAND,
  MINUTE_LABEL_COLOR,
  QUARTER_LABEL_COLOR,
  buildWaveGeometry,
  waveDotColor,
  waveDotTooltip,
  type WaveShadeColors,
} from './gameWaveGeometry';
import { SP_LINK, SUCCESSFUL_PLAY_DEF } from './embedDefinitions';

/**
 * "Copy embed code" for the Game Wave.
 *
 * The wave is hand-drawn SVG rather than a Chart.js canvas, so it can't ride
 * the generic `chartEmbedGenerator`. It doesn't need to: the same geometry the
 * page renders with (`gameWaveGeometry`) is serialized straight to static SVG
 * markup here, which means no chart library, no inline init script, and nothing
 * a CMS performance plugin can reorder and break.
 *
 * The embed drops the on-screen resize handles — it simply fills whatever
 * container it lands in. Binning is baked at copy time (the granularity showing
 * when the button was pressed), and a min-width keeps the dots legible in a
 * narrow column by letting the chart scroll sideways instead of shrinking into
 * illegibility.
 */

export interface GameWaveEmbedSpec {
  model: GameWaveModel;
  /** Team stacked above the clock. */
  team: string;
  /** Team stacked below it. */
  opponent: string;
  topColors: WaveShadeColors;
  bottomColors: WaveShadeColors;
  title: string;
  subtitle?: string;
  /** Footer link target ("See all charts"). */
  sourceUrl: string;
  sourceLabel?: string;
}

// Narrowest a single dot cell may render before the chart scrolls instead.
// A touch under the on-screen minimum (18px), so the common case — an embed
// column narrower than the app's — still fits without a scrollbar.
const MIN_EMBED_CELL_PX = 16;

// Legend swatches read as a neutral ramp on screen (they describe the shading,
// not either team), so the embed keeps the app's warm neutrals here.
const SWATCH_EXPLOSIVE = '#44403C';
const SWATCH_SUCCESS = '#A8A29B';
const SWATCH_OTHER = '#E5E1DB';
const SWATCH_OTHER_RING = '#D6D1C8';

const escapeHtml = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/** Trim the float noise out of coordinates so the markup stays readable. */
const n = (value: number): string => String(Math.round(value * 1000) / 1000);

/** "2.1-minute" / "1-minute", for the definition of a clock bin. */
const binLength = (segmentsPerQuarter: number): string => {
  const minutes = QUARTER_MINUTES / segmentsPerQuarter;
  return Number.isInteger(minutes) ? `${minutes}` : minutes.toFixed(1);
};

const arrowIcon = (direction: 'up' | 'down', color: string): string => {
  const paths =
    direction === 'up'
      ? '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'
      : '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>';
  return `<svg class="wave-arrow" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
};

const keySwatch = (color: string, ring: string | null, label: string): string =>
  `<span class="wave-key"><span class="wave-key-dot" style="background:${escapeHtml(color)}${
    ring ? `;box-shadow:inset 0 0 0 1px ${escapeHtml(ring)}` : ''
  }"></span>${escapeHtml(label)}</span>`;

/** The wave itself, as static SVG — the same shapes the page draws. */
const renderWaveSvg = (spec: GameWaveEmbedSpec): { svg: string; minWidthPx: number } => {
  const { model, team, opponent, topColors, bottomColors } = spec;
  const geom = buildWaveGeometry(model);
  const parts: string[] = [];

  // Quarter dividers
  for (const x of geom.dividers) {
    parts.push(
      `<line x1="${n(x)}" x2="${n(x)}" y1="0.2" y2="${n(geom.vbHeight - LABEL_BAND + 0.4)}" stroke="${GRID_COLOR}" stroke-width="0.05"/>`,
    );
  }

  // Dots, each carrying its play description as a native SVG tooltip
  for (const point of model.points) {
    const cx = geom.xOf(point.column);
    const cy = geom.yOf(point);
    const fill = waveDotColor(point, topColors, bottomColors);
    parts.push(
      `<g><circle cx="${n(cx)}" cy="${n(cy)}" r="${DOT_R}" fill="${escapeHtml(fill)}" stroke="#ffffff" stroke-width="0.05"><title>${escapeHtml(waveDotTooltip(point))}</title></circle>` +
        (point.label
          ? `<text x="${n(cx)}" y="${n(cy)}" dy="0.35em" font-size="0.5" font-weight="bold" fill="${point.isScore ? '#ffffff' : DOT_LABEL_COLOR}" text-anchor="middle" pointer-events="none">${escapeHtml(point.label)}</text>`
          : '') +
        `</g>`,
    );
  }

  // Game-clock minute ticks in the reserved central axis lane
  for (const mark of geom.minuteMarks) {
    parts.push(
      `<text x="${n(mark.x)}" y="${n(geom.minuteLabelY)}" font-size="0.55" fill="${MINUTE_LABEL_COLOR}" text-anchor="middle" dominant-baseline="central">${escapeHtml(mark.label)}</text>`,
    );
  }

  // Quarter marks
  for (const mark of geom.quarterMarks) {
    parts.push(
      `<text x="${n(mark.x)}" y="${n(geom.labelY)}" font-size="0.62" font-weight="bold" fill="${QUARTER_LABEL_COLOR}" text-anchor="middle" dominant-baseline="central">${escapeHtml(mark.label)}</text>`,
    );
  }

  const svg =
    `<svg class="wave-svg" viewBox="0 0 ${n(geom.vbWidth)} ${n(geom.vbHeight)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(`Game wave: ${team} versus ${opponent}`)}">` +
    parts.join('') +
    `</svg>`;

  return { svg, minWidthPx: Math.round(geom.vbWidth * MIN_EMBED_CELL_PX) };
};

export const buildGameWaveEmbedHtml = (spec: GameWaveEmbedSpec): string => {
  const { model, team, opponent, topColors, bottomColors, title, subtitle, sourceUrl, sourceLabel = 'See all charts' } =
    spec;

  const uniqueId = `cfb-wave-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const fnSuffix = uniqueId.replace(/-/g, '_');
  const { svg, minWidthPx } = renderWaveSvg(spec);

  const definitions = [
    `Based roughly on ${SP_LINK}`,
    SUCCESSFUL_PLAY_DEF,
    '<strong>Explosive play:</strong> Gains 15+ yards',
    `<strong>Each dot:</strong> One play, stacked inside the ${binLength(
      model.segmentsPerQuarter,
    )}-minute stretch of game clock it ran in — taller stacks mean more snaps`,
    `<strong>Sides:</strong> ${escapeHtml(team)}'s offensive plays sit above the clock, ${escapeHtml(
      opponent,
    )}'s below`,
    '<strong>Dot labels:</strong> 6 = touchdown, 3 = field goal, i = interception, f = fumble lost',
    '<strong>Center numbers:</strong> Minutes left in the quarter',
  ];

  return `<!-- CFB Analytics Chart Embed: ${escapeHtml(title)} -->
<div class="cfb-wave-embed-${uniqueId}">
    <style>
        .cfb-wave-embed-${uniqueId} {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
        }
        .cfb-wave-embed-${uniqueId} .chart-container {
            background: white;
            border-radius: 12px;
            border: 1px solid #e5e5e5;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .cfb-wave-embed-${uniqueId} .chart-header {
            padding: 18px 24px 14px;
            border-bottom: 1px solid #e5e5e5;
            background: white;
        }
        .cfb-wave-embed-${uniqueId} .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #171717;
            margin: 0;
        }
        .cfb-wave-embed-${uniqueId} .chart-subtitle {
            font-size: 11px;
            font-weight: 400;
            color: #737373;
            margin: 4px 0 0 0;
        }
        .cfb-wave-embed-${uniqueId} .chart-content {
            padding: 16px 24px 20px;
            background: white;
        }
        .cfb-wave-embed-${uniqueId} .wave-legend {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px 10px;
            margin: 0 0 12px 0;
            font-size: 12px;
            color: #78716C;
        }
        .cfb-wave-embed-${uniqueId} .wave-legend-note {
            color: #A8A29B;
        }
        .cfb-wave-embed-${uniqueId} .wave-sep {
            color: #D6D1C8;
        }
        .cfb-wave-embed-${uniqueId} .wave-team {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
            color: #44403C;
        }
        .cfb-wave-embed-${uniqueId} .wave-arrow {
            width: 13px;
            height: 13px;
            flex: none;
        }
        /* The shading key wraps as one unit, so its leading separator can't
           be stranded at the end of a line in a narrow column. */
        .cfb-wave-embed-${uniqueId} .wave-keys {
            display: inline-flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px 10px;
        }
        .cfb-wave-embed-${uniqueId} .wave-key {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .cfb-wave-embed-${uniqueId} .wave-key-dot {
            width: 10px;
            height: 10px;
            border-radius: 9999px;
            display: inline-block;
            flex: none;
        }
        /* The wave fills its container. When that container is too narrow for
           the dots to stay readable, it scrolls sideways rather than shrinking. */
        .cfb-wave-embed-${uniqueId} .wave-scroll {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }
        .cfb-wave-embed-${uniqueId} .wave-svg {
            display: block;
            width: 100%;
            height: auto;
            min-width: ${minWidthPx}px;
            font-family: inherit;
        }
        .cfb-wave-embed-${uniqueId} .embed-footer {
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #737373;
        }
        .cfb-wave-embed-${uniqueId} .embed-footer-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
        }
        .cfb-wave-embed-${uniqueId} .embed-footer-link {
            color: #737373;
            text-decoration: none;
            font-weight: 500;
        }
        .cfb-wave-embed-${uniqueId} .embed-footer-link:hover {
            color: #525252;
            text-decoration: underline;
        }
        .cfb-wave-embed-${uniqueId} .data-definitions-toggle {
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
        .cfb-wave-embed-${uniqueId} .data-definitions-toggle:hover {
            color: #525252;
        }
        .cfb-wave-embed-${uniqueId} .caret {
            transition: transform 0.2s ease;
            font-size: 10px;
        }
        .cfb-wave-embed-${uniqueId} .caret.expanded {
            transform: rotate(180deg);
        }
        .cfb-wave-embed-${uniqueId} .data-definitions {
            display: none;
            padding: 16px;
            background: #fafafa;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            line-height: 1.4;
        }
        .cfb-wave-embed-${uniqueId} .data-definitions.expanded {
            display: block;
        }
        .cfb-wave-embed-${uniqueId} .data-definitions ul {
            margin: 0;
            padding-left: 0;
            list-style: none;
        }
        .cfb-wave-embed-${uniqueId} .data-definitions li {
            margin-bottom: 4px;
        }

        @media (max-width: 640px) {
            .cfb-wave-embed-${uniqueId} .chart-header {
                padding: 12px 16px 12px !important;
            }
            .cfb-wave-embed-${uniqueId} .chart-content {
                padding: 12px 16px 16px !important;
            }
            .cfb-wave-embed-${uniqueId} .embed-footer-top {
                padding: 8px 12px !important;
            }
            .cfb-wave-embed-${uniqueId} .data-definitions {
                padding: 12px !important;
            }
        }
    </style>

    <div class="chart-container">
        <div class="chart-header">
            <h3 class="chart-title">${escapeHtml(title)}</h3>
            ${subtitle ? `<p class="chart-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <div class="chart-content">
            <div class="wave-legend">
                <span class="wave-legend-note">Plays binned by game clock</span>
                <span class="wave-sep">&middot;</span>
                <span class="wave-team">${arrowIcon('up', topColors.explosive)}${escapeHtml(team)}</span>
                <span class="wave-team">${arrowIcon('down', bottomColors.explosive)}${escapeHtml(opponent)}</span>
                <span class="wave-keys"><span class="wave-sep">&middot;</span>${keySwatch(
                  SWATCH_EXPLOSIVE,
                  null,
                  'Explosive',
                )}${keySwatch(SWATCH_SUCCESS, null, 'Successful')}${keySwatch(
                  SWATCH_OTHER,
                  SWATCH_OTHER_RING,
                  'Unsuccessful',
                )}</span>
            </div>
            <div class="wave-scroll">
                ${svg}
            </div>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${escapeHtml(sourceUrl)}" class="embed-footer-link" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)}</a>
                <button type="button" class="data-definitions-toggle" onclick="toggleDefinitions_${fnSuffix}()">
                    Data definitions
                    <span class="caret" id="caret_${uniqueId}">&#9660;</span>
                </button>
            </div>
            <div class="data-definitions" id="dataDefinitions_${uniqueId}">
                <ul>${definitions.map(def => `<li>${def}</li>`).join('')}</ul>
            </div>
        </div>
    </div>

    <script>
        // Toggle details accordion
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
    <\u002fscript>
</div>`;
};
