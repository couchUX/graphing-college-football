import { createWaveRuntime, waveRuntime, type WaveEvent, type WaveShadeColors } from './gameWaveRuntime';
import { SP_LINK, SUCCESSFUL_PLAY_DEF } from './embedDefinitions';

/**
 * "Copy embed code" for the Game Wave.
 *
 * The wave is hand-drawn SVG rather than a Chart.js canvas, so it can't ride
 * the generic `chartEmbedGenerator` — and it needs something that generator
 * never had to do: re-bin itself. On the page the wave subdivides each quarter
 * into finer clock slices as it gets more room; an embed lands in a column of
 * unknown width, so a picture baked at copy time would be wrong as often as
 * right.
 *
 * So the embed ships the game's events and `createWaveRuntime`'s own source
 * (`Function.prototype.toString`, the same trick `chartEmbedGenerator` uses for
 * chart callbacks). The copied chart measures its container and bins, stacks
 * and draws with the very code this page runs — no chart library, no CDN, and
 * no way for the two to drift apart.
 */

export interface GameWaveEmbedSpec {
  /** The game's plays, already classified — the embed bins them itself. */
  events: WaveEvent[];
  /** Granularity showing on screen; the embed starts here, then measures. */
  segmentsPerQuarter: number;
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

/** Nothing inside the embed's inline script may close its <script> tag. */
const scriptSafe = (source: string): string => source.replace(/<\/script/gi, '<\\u002fscript');

const json = (value: unknown): string => scriptSafe(JSON.stringify(value).replace(/</g, '\\u003c'));

/** "2.1" / "1", for the length of a clock bin. */
const binLength = (segmentsPerQuarter: number): string => {
  const minutes = waveRuntime.QUARTER_MINUTES / segmentsPerQuarter;
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

export const buildGameWaveEmbedHtml = (spec: GameWaveEmbedSpec): string => {
  const {
    events,
    segmentsPerQuarter,
    team,
    opponent,
    topColors,
    bottomColors,
    title,
    subtitle,
    sourceUrl,
    sourceLabel = 'See all charts',
  } = spec;

  const uniqueId = `cfb-wave-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const fnSuffix = uniqueId.replace(/-/g, '_');
  const hasOvertime = events.some(event => event.quarter > waveRuntime.REGULATION_QUARTERS);

  // The drawer carries the "plays are binned by game clock" idea the legend
  // used to spend a line on, so it leads: how to read the chart first, what
  // the metrics mean after. The bin length is live — the script rewrites it
  // whenever the chart re-bins itself.
  const definitions = [
    `<strong>Each dot is one play</strong>, dropped into the <span id="binLength_${uniqueId}">${binLength(
      segmentsPerQuarter,
    )}</span>-minute stretch of game clock it ran in — so a tall column is a busy stretch of clock, not a long drive`,
    `<strong>Down the middle:</strong> minutes left in the quarter, counting down through each quarter in turn${
      hasOvertime ? '; overtime gets a column of its own at the end' : ''
    }`,
    `<strong>Sides:</strong> ${escapeHtml(team)}'s offensive plays stack above the clock, ${escapeHtml(
      opponent,
    )}'s below`,
    '<strong>Shading:</strong> darkest dots are explosive plays, mid are successful, palest are unsuccessful',
    '<strong>Dot labels:</strong> 6 = touchdown, 3 = field goal, i = interception, f = fumble lost',
    SUCCESSFUL_PLAY_DEF,
    '<strong>Explosive play:</strong> Gains 15+ yards',
    `Based roughly on ${SP_LINK}`,
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
        /* The wave is redrawn to fit this box, never scrolled inside it. */
        .cfb-wave-embed-${uniqueId} .wave-frame {
            width: 100%;
        }
        .cfb-wave-embed-${uniqueId} .wave-svg {
            display: block;
            width: 100%;
            height: auto;
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
            <div class="wave-frame" id="waveFrame_${uniqueId}"></div>
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

        // Draw the wave, and redraw it whenever the container width would put
        // it in a different clock binning. This is graphingcollegefootball.com's
        // own wave code, shipped verbatim — see gameWaveRuntime.ts.
        (function () {
            'use strict';

            var runtime = (${scriptSafe(String(createWaveRuntime))})();
            var events = ${json(events)};
            var team = ${json(team)};
            var opponent = ${json(opponent)};
            var topColors = ${json(topColors)};
            var bottomColors = ${json(bottomColors)};
            var hasOvertime = ${hasOvertime};
            var segments = 0;

            function start() {
                var frame = document.getElementById('waveFrame_${uniqueId}');
                if (!frame) return false;

                var binLabel = document.getElementById('binLength_${uniqueId}');

                function draw() {
                    var chosen = runtime.chooseSegments(frame.clientWidth, hasOvertime, events.length);
                    if (chosen === segments) return;
                    segments = chosen;

                    var model = runtime.buildModel(events, chosen);
                    frame.innerHTML = runtime.renderSvg({
                        model: model,
                        geometry: runtime.buildGeometry(model),
                        team: team,
                        opponent: opponent,
                        topColors: topColors,
                        bottomColors: bottomColors
                    });

                    if (binLabel) {
                        var minutes = ${waveRuntime.QUARTER_MINUTES} / chosen;
                        binLabel.textContent = minutes % 1 === 0 ? String(minutes) : minutes.toFixed(1);
                    }
                }

                draw();
                if (typeof ResizeObserver === 'function') {
                    new ResizeObserver(draw).observe(frame);
                } else {
                    window.addEventListener('resize', draw);
                }
                return true;
            }

            if (!start() && document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', start);
            }
        })();
    </script>
</div>`;
};
