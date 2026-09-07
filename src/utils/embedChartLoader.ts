/**
 * Chart.js loader shared by the embed templates.
 *
 * Embeds must not depend on static `<script src>` tags. WordPress performance
 * plugins routinely rewrite them — adding `async`, or parking the URL on a
 * `data-*` attribute to be restored on first interaction — and either rewrite
 * is fatal here:
 *
 * - `async` drops the ordering guarantee, and the datalabels UMD bundle reads
 *   `window.Chart` the instant it executes (`ChartDataLabels = factory(
 *   Chart.helpers, Chart)`). It is 13 kB against Chart.js's 207 kB, so it
 *   usually wins the race, throws "Cannot read properties of undefined
 *   (reading 'helpers')", and never defines itself.
 * - A parked `src` never loads at all.
 *
 * Both surface identically: the init script waits for globals that never
 * arrive and replaces the canvas with "Chart library failed to load." The
 * embed renders fine in isolation (Gutenberg previews the block in a plain
 * sandboxed iframe, untouched by page-level optimizers) and fails on the
 * published page — which is exactly the shape of the bug this fixes.
 *
 * Injecting the tags from inline JS, sequentially, makes the order a guarantee
 * rather than a hope and keeps the URLs out of reach of tag rewriters.
 */

export const CHART_JS_CDN_URL =
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

export const CHART_DATALABELS_CDN_URL =
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';

/**
 * Source for `ensureChartLibs(onReady, onFail)`, to be inlined inside an
 * embed's init IIFE — indented to sit alongside the other functions there.
 *
 * Each embed carries its own copy of the function; the state that keeps N
 * embeds on one page from each downloading their own libraries lives on the
 * injected tags (`data-cfb-embed-lib`), so the copies coordinate through the
 * DOM without any page-wide script.
 *
 * `onReady` runs once both globals are usable. `onFail` runs if a library
 * cannot be fetched at all.
 */
export const chartLibLoaderScript = (): string => `            const CHART_JS_SRC = ${JSON.stringify(CHART_JS_CDN_URL)};
            const DATALABELS_SRC = ${JSON.stringify(CHART_DATALABELS_CDN_URL)};

            // Reuse a Chart.js the page already has when it's v3+ (the range
            // datalabels 2.x supports), so a post full of embeds loads one
            // copy. A v2 global has no .register and is replaced.
            function chartCoreReady() {
                return typeof Chart !== 'undefined' && typeof Chart.register === 'function';
            }

            // At most one tag per library per page, however many embeds ask.
            function loadChartLib(src, key, onLoad, onFail) {
                const existing = document.querySelector('script[data-cfb-embed-lib="' + key + '"]');
                if (existing) {
                    if (existing.getAttribute('data-cfb-embed-state') === 'loaded') {
                        onLoad();
                    } else if (existing.getAttribute('data-cfb-embed-state') === 'failed') {
                        onFail();
                    } else {
                        existing.addEventListener('load', onLoad);
                        existing.addEventListener('error', onFail);
                    }
                    return;
                }

                const script = document.createElement('script');
                script.setAttribute('data-cfb-embed-lib', key);
                // Registered before src is assigned, so the state attribute is
                // always set before any later embed reads it.
                script.addEventListener('load', function () {
                    script.setAttribute('data-cfb-embed-state', 'loaded');
                    onLoad();
                });
                script.addEventListener('error', function () {
                    script.setAttribute('data-cfb-embed-state', 'failed');
                    onFail();
                });
                script.src = src;
                document.head.appendChild(script);
            }

            function ensureChartLibs(onReady, onFail) {
                function withChartCore() {
                    if (typeof ChartDataLabels !== 'undefined') {
                        onReady();
                        return;
                    }
                    loadChartLib(DATALABELS_SRC, 'datalabels', onReady, onFail);
                }

                if (chartCoreReady()) {
                    withChartCore();
                } else {
                    loadChartLib(CHART_JS_SRC, 'chartjs', withChartCore, onFail);
                }
            }
`;
