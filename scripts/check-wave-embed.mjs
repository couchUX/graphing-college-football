/**
 * Regression check for the one Game Wave invariant nothing else can hold.
 *
 * `gameWaveEmbed` ships `createWaveRuntime`'s own source text inside the copied
 * HTML, and the pasted page evaluates it in a fresh scope. So the factory has
 * to stand alone: an import, a module-level constant, or syntax the bundler
 * lowers into a helper all pass `tsc` and `vite build` happily, and then leave
 * every pasted embed blank.
 *
 * This bundles the embed generator the way `npm run build` does, generates an
 * embed, pulls the serialized runtime back out of that HTML, evaluates it in an
 * empty scope the way a host page would, and draws with it — then checks it
 * drew the same thing the app's own instance draws.
 *
 * It runs twice, minified and not. Minified is what readers actually get.
 * Unminified is the stricter net: the minifier quietly inlines a single-use
 * constant, which hides a reference that a later bundler or target change
 * would stop hiding, so the unminified pass is what catches reaching out of
 * the closure at all.
 *
 *   npm run check:embed
 */
import { build } from 'vite';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(root, 'node_modules/.cache/wave-embed-check');

const fail = (message, detail) => {
  console.error(`\n✗ ${message}`);
  if (detail) console.error(`\n${detail}`);
  console.error(
    '\nThe Game Wave embed ships createWaveRuntime as source text, so everything it\n' +
      'touches must live inside that closure. See the rules at the top of\n' +
      'src/utils/gameWaveRuntime.ts.\n',
  );
  process.exit(1);
};

const COLORS = { explosive: '#800000', success: '#BF5700', light: '#F5D6C6' };
const TEAM = 'Texas';
const OPPONENT = 'Ohio State';

/** A small game: four quarters of alternating possessions, plus an OT snap. */
const makeEvents = () => {
  const events = [];
  for (let quarter = 1; quarter <= 5; quarter += 1) {
    for (let i = 0; i < (quarter === 5 ? 2 : 20); i += 1) {
      events.push({
        side: i % 4 < 2 ? 'top' : 'bottom',
        quarter,
        minutes: Math.max(0, Math.floor(14 - i * 0.7)),
        seconds: (i * 7) % 60,
        outcome: ['explosive', 'success', 'other'][i % 3],
        label: i % 9 === 0 ? '6' : null,
        isScore: i % 9 === 0,
        playText: 'A play with "quotes", <angles> & an ampersand',
        yardsGained: i - 3,
        down: (i % 4) + 1,
        distance: 10,
      });
    }
  }
  return events;
};

const events = makeEvents();

const bundle = async (minify) => {
  const outDir = resolve(cache, minify ? 'min' : 'raw');
  await build({
    root,
    logLevel: 'error',
    configFile: false,
    build: {
      outDir,
      emptyOutDir: true,
      minify,
      // Both entries in one build, so rollup shares a single runtime module
      // between them: the comparison below is serialized-vs-live, not
      // serialized-vs-some-other-build.
      lib: {
        entry: {
          embed: resolve(root, 'src/utils/gameWaveEmbed.ts'),
          runtime: resolve(root, 'src/utils/gameWaveRuntime.ts'),
        },
        formats: ['es'],
      },
    },
  });
  return {
    embed: await import(pathToFileURL(resolve(outDir, 'embed.js')).href),
    runtime: (await import(pathToFileURL(resolve(outDir, 'runtime.js')).href)).waveRuntime,
  };
};

/** Bin, lay out and draw at a given container width — what a host page does. */
const draw = (api, width, label) => {
  try {
    const segments = api.chooseSegments(width, true, events.length);
    const model = api.buildModel(events, segments);
    const svg = api.renderSvg({
      model,
      geometry: api.buildGeometry(model),
      team: TEAM,
      opponent: OPPONENT,
      topColors: COLORS,
      bottomColors: COLORS,
    });
    return { segments, svg };
  } catch (error) {
    fail(`${label}: the serialized runtime threw while drawing at ${width}px`, String(error));
  }
};

for (const minify of [true, false]) {
  const label = minify ? 'minified' : 'unminified';
  console.log(`building the embed generator (${label})…`);
  const built = await bundle(minify);

  const html = built.embed.buildGameWaveEmbedHtml({
    events,
    segmentsPerQuarter: 7,
    team: TEAM,
    opponent: OPPONENT,
    topColors: COLORS,
    bottomColors: COLORS,
    title: 'Game Wave',
    sourceUrl: 'https://graphingcollegefootball.com',
  });

  // Pull the runtime back out of the emitted HTML, exactly as shipped.
  const serialized = html.match(/var runtime = \((.*)\)\(\);\s*var events =/s);
  if (!serialized) fail(`${label}: could not find the serialized runtime in the generated embed HTML`);

  // `new Function` bodies run in global scope, so anything the factory reaches
  // for outside itself throws here the same way it would on a reader's page.
  let runtime;
  try {
    runtime = new Function(`return (${serialized[1]})();`)();
  } catch (error) {
    fail(`${label}: the serialized runtime does not stand alone after bundling`, String(error));
  }

  const wide = draw(runtime, 1200, label);
  const narrow = draw(runtime, 320, label);

  if (wide.segments <= narrow.segments) {
    fail(`${label}: the embed did not re-bin — ${wide.segments} bins/quarter at 1200px, ${narrow.segments} at 320px`);
  }

  for (const [where, drawn] of [['wide', wide], ['narrow', narrow]]) {
    const dots = (drawn.svg.match(/<circle/g) ?? []).length;
    if (dots !== events.length) fail(`${label} ${where}: drew ${dots} dots for ${events.length} events`);
    if (!/^<svg class="wave-svg" viewBox="0 0 [\d.]+ [\d.]+"/.test(drawn.svg)) {
      fail(`${label} ${where}: the SVG has no sized viewBox, so it can't scale to its container`);
    }
    if (!drawn.svg.includes('>OT<')) fail(`${label} ${where}: the overtime column is missing`);
    if (drawn.svg.includes('<angles>')) {
      fail(`${label} ${where}: play text reached the markup unescaped — an injection risk in the host page`);
    }
  }

  // The shipped copy must draw what the app draws, not merely something valid.
  const live = draw(built.runtime, 1200, `${label} (app instance)`);
  if (live.svg !== wide.svg) {
    fail(
      `${label}: the serialized runtime and the app's own instance drew different SVG at the same width`,
      `app: ${live.svg.length} chars, embed: ${wide.svg.length} chars`,
    );
  }

  console.log(
    `  ✓ ${label}: stands alone, matches the app, re-bins ${wide.segments} → ${narrow.segments} ` +
      `bins/quarter from 1200px to 320px (${events.length} dots either way)`,
  );
}

rmSync(cache, { recursive: true, force: true });
console.log('✓ the Game Wave embed\'s serialized runtime is intact');
