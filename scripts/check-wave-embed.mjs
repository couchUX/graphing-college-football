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

/**
 * The dot tooltip is DOM code inside the same shipped closure, and it only runs
 * on hover — so a reference out of the closure would pass every drawing check
 * above and still throw on a reader's page. Bind it to a stand-in DOM, hover a
 * dot, tap, leave, and make sure it shows the app's text in the right place.
 */
const checkTooltip = (api, appApi, label) => {
  const model = api.buildModel(events, 7);
  const index = model.points.findIndex(p => p.label === '6');
  const point = model.points[index];
  const listeners = { host: {}, doc: {} };
  const on = bag => (type, fn) => { (bag[type] = bag[type] || []).push(fn); };
  const off = bag => (type, fn) => { bag[type] = (bag[type] || []).filter(g => g !== fn); };
  const fire = (bag, type, event) => (bag[type] || []).forEach(fn => fn(event));
  const created = [];
  const node = () => ({ style: {}, textContent: '', appendChild: child => child });
  const doc = {
    createElement: () => { const n = node(); created.push(n); return n; },
    addEventListener: on(listeners.doc),
    removeEventListener: off(listeners.doc),
    defaultView: { getComputedStyle: () => ({ position: 'static' }) },
  };
  // A 10px dot near the top-left of a 400×200 host with a 1px border.
  const dot = { getAttribute: () => String(index), getBoundingClientRect: () => ({ left: 101, right: 111, top: 21, bottom: 31 }) };
  dot.closest = () => dot;
  const elsewhere = { closest: () => null };
  const host = {
    ownerDocument: doc, style: {}, clientLeft: 1, clientTop: 1, clientWidth: 400, clientHeight: 200,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener: on(listeners.host), removeEventListener: off(listeners.host),
    contains: n => n === dot || n === elsewhere,
  };
  const tip = Object.assign(node(), { offsetWidth: 180, offsetHeight: 40 });

  let binding;
  try {
    binding = api.bindTooltip({ host, tooltip: tip, pointAt: i => model.points[i], team: TEAM, opponent: OPPONENT });
    fire(listeners.host, 'pointermove', { target: dot, pointerType: 'mouse' });
  } catch (error) {
    fail(`${label}: the serialized runtime's dot tooltip threw on hover`, String(error));
  }
  const [title, body, caret] = created;
  const want = appApi.tooltipParts(point, TEAM, OPPONENT);
  if (tip.style.display !== 'block') fail(`${label}: hovering a dot didn't show its tooltip`);
  if (title.textContent !== want.title || body.textContent !== want.body) {
    fail(`${label}: the tooltip text differs from the app's`, `got "${title.textContent}" / "${body.textContent}"`);
  }
  if (host.style.position !== 'relative') fail(`${label}: the tooltip host wasn't made a positioning context`);
  // No room above a dot 20px from the top, so it flips under: 30 + 5 caret + 2 gap.
  if (tip.style.top !== '37px' || tip.style.left !== '15px' || caret.style.left !== '85px' || caret.style.top !== '-5px') {
    fail(`${label}: tooltip placed wrong`, JSON.stringify({ top: tip.style.top, left: tip.style.left, caretLeft: caret.style.left, caretTop: caret.style.top }));
  }
  fire(listeners.host, 'pointerleave', { target: dot, pointerType: 'mouse' });
  if (tip.style.display !== 'none') fail(`${label}: the tooltip stayed up after the mouse left`);
  fire(listeners.host, 'pointerdown', { target: dot, pointerType: 'touch' });
  fire(listeners.host, 'pointerleave', { target: dot, pointerType: 'touch' });
  if (tip.style.display !== 'block') fail(`${label}: a tap didn't keep the tooltip up after the finger lifted`);
  fire(listeners.doc, 'pointerdown', { target: {}, pointerType: 'touch' });
  if (tip.style.display !== 'none') fail(`${label}: tapping outside the wave didn't close the tooltip`);
  fire(listeners.host, 'pointermove', { target: elsewhere, pointerType: 'mouse' });
  binding.destroy();
  const left = Object.values(listeners.host).concat(Object.values(listeners.doc)).reduce((n, fns) => n + fns.length, 0);
  if (left !== 0) fail(`${label}: destroy left ${left} listeners attached`);
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
    const tagged = (drawn.svg.match(/<circle data-point="\d+"/g) ?? []).length;
    if (tagged !== events.length) {
      fail(`${label} ${where}: only ${tagged} of ${events.length} dots carry a data-point index for their tooltip`);
    }
    if (drawn.svg.includes('<title')) fail(`${label} ${where}: dots still carry a native <title> tooltip`);
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

  if (!html.includes('runtime.bindTooltip(') || !html.includes('waveTip_')) {
    fail(`${label}: the embed HTML doesn't wire up the dot tooltips`);
  }
  checkTooltip(runtime, built.runtime, label);

  console.log(
    `  ✓ ${label}: stands alone, matches the app, tooltips work, re-bins ${wide.segments} → ${narrow.segments} ` +
      `bins/quarter from 1200px to 320px (${events.length} dots either way)`,
  );
}

rmSync(cache, { recursive: true, force: true });
console.log('✓ the Game Wave embed\'s serialized runtime is intact');
