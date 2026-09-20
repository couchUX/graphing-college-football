/**
 * Locks down the grammar behind the all-plays table's column filters.
 *
 * The numeric box accepts a small expression language — exact values,
 * comparisons, inclusive ranges — and every unparseable fragment has to fall
 * through to "matches everything", or the table blanks while you're still
 * typing. None of that is visible to `tsc`: every case below type-checks
 * whether the regexes are right or not, so the rules get exercised here.
 *
 * Builds src/utils/playFilters.ts the way the app bundles it, then runs the
 * table against the real module.
 *
 *   node scripts/check-play-filters.mjs
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rmSync } from 'node:fs';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(root, 'node_modules/.cache/check-play-filters');

await build({
  root,
  logLevel: 'error',
  configFile: false,
  build: {
    outDir: cache,
    emptyOutDir: true,
    lib: { entry: resolve(root, 'src/utils/playFilters.ts'), formats: ['es'], fileName: 'playFilters' },
  },
});

const { matchesNumber, matchesText, matchesPlayFilter } = await import(
  pathToFileURL(resolve(cache, 'playFilters.js')).href
);

let failures = 0;
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures += 1;
    console.error(`  ✗ ${label}: expected ${expected}, got ${actual}`);
  }
};

/** [expression, value, expected] */
const NUMERIC = [
  // Nothing typed yet — never exclude a row.
  ['', 0, true], ['', -99, true], ['   ', 7, true],

  // Exact, including the zero and negative values yardage really produces.
  ['15', 15, true], ['15', 14, false], ['15', 16, false],
  ['0', 0, true], ['0', 1, false],
  ['-5', -5, true], ['-5', 5, false],
  ['42.9', 42.9, true], ['42.9', 42.8, false],

  // Comparisons, checked hard against their boundary.
  ['>15', 16, true], ['>15', 15, false], ['>15', 14, false],
  ['>=15', 15, true], ['>=15', 14, false],
  ['<0', -1, true], ['<0', 0, false],
  ['<=3', 3, true], ['<=3', 4, false],
  ['=7', 7, true], ['=7', 8, false],
  ['>-3', -2, true], ['>-3', -3, false],
  ['>=42.9', 42.9, true], ['>=42.9', 42.8, false],
  ['> 15', 16, true], ['  <=3  ', 3, true],

  // Ranges are inclusive at both ends, and accept either order.
  ['10-20', 10, true], ['10-20', 20, true], ['10-20', 15, true],
  ['10-20', 9, false], ['10-20', 21, false],
  ['20-10', 15, true], ['20-10', 9, false],
  ['10..20', 15, true], ['10–20', 15, true], ['10 to 20', 15, true],
  ['-5-5', 0, true], ['-5-5', -5, true], ['-5-5', 5, true], ['-5-5', 6, false],
  ['-10--5', -7, true], ['-10--5', -4, false],
  ['0.5-1.5', 1, true], ['0.5-1.5', 1.6, false],

  // Half-typed and junk both fall through rather than emptying the table.
  ['>', 5, true], ['>=', 5, true], ['<', 5, true], ['=', 5, true],
  ['10-', 5, true], ['-', 5, true], ['..', 5, true],
  ['abc', 5, true], ['3rd', 5, true], ['>abc', 5, true], ['>1.2.3', 5, true],
];

for (const [expr, value, expected] of NUMERIC) {
  check(`matchesNumber(${JSON.stringify(expr)}, ${value})`, matchesNumber(expr, value), expected);
}

/** [expression, value, expected] */
const TEXT = [
  ['', 'Quinn Ewers', true], ['   ', 'Quinn Ewers', true],
  ['ewers', 'Q.Ewers', true],
  ['EWERS', 'Q.Ewers', true],
  ['  bond  ', 'I.Bond', true],
  ['bond', 'Q.Ewers', false],
  // Substrings match mid-word, so "sack" finds "sacked" — intended, since
  // play text never says "sack" on its own.
  ['sack', 'Quinn Ewers sacked by Mykel Williams', true],
  ['fumble', 'Quinn Ewers sacked by Mykel Williams', false],
  ['—', '—', true],
];

for (const [expr, value, expected] of TEXT) {
  check(`matchesText(${JSON.stringify(expr)}, ${JSON.stringify(value)})`, matchesText(expr, value), expected);
}

/** [kind, expression, value, expected] */
const DISPATCH = [
  // A dropdown is exact: picking "3" must not also match 13 or 30.
  ['select', '3', 3, true], ['select', '3', 13, false], ['select', '3', 30, false],
  ['select', 'Texas', 'Texas', true], ['select', 'Texas', 'Texas A&M', false],
  ['select', 'Yes', 'No', false],
  // Numbers arrive from the cell as numbers, and text as strings.
  ['number', '>15', 18, true], ['number', '>15', 9, false],
  ['text', 'ewers', 'Q.Ewers', true],
  // An empty expression short-circuits for every kind.
  ['select', '', 'Texas', true], ['number', '', 0, true], ['text', '', '—', true],
];

for (const [kind, expr, value, expected] of DISPATCH) {
  check(
    `matchesPlayFilter(${kind}, ${JSON.stringify(expr)}, ${JSON.stringify(value)})`,
    matchesPlayFilter(kind, expr, value),
    expected
  );
}

rmSync(cache, { recursive: true, force: true });

const total = NUMERIC.length + TEXT.length + DISPATCH.length;
if (failures > 0) {
  console.error(`\n✗ ${failures} of ${total} play-filter cases failed`);
  process.exit(1);
}
console.log(`✓ the all-plays column filters match as specified (${total} cases)`);
