/**
 * Guards the team-colour lookup against the failure that produced a
 * gray-on-gray Vanderbilt–NC State chart.
 *
 * `src/utils/teamColors.ts` was keyed from an NCAA-style roster ("La.-Monroe",
 * "Miami (Fla.)", "North Carolina State") while CFBD sends its own shorter
 * names. A name the table doesn't hold falls through to the gray default —
 * silently. Nothing throws, nothing logs; the chart just draws in the colour of
 * an unknown team, and two such teams in one game are indistinguishable.
 *
 * The lookup now folds case, diacritics and punctuation and consults an alias
 * map, which fixes today's roster but adds two new ways to fail quietly:
 *
 *   - an alias pointing at a key that doesn't exist resolves to gray, and
 *   - two keys that normalize to the same string shadow one another, so one
 *     school silently wears another's colours.
 *
 * So this asserts the invariants rather than the values. It deliberately does
 * NOT check that a given team's colours look right — those are a design call
 * (see the one rule in CLAUDE.md) and belong to whoever picks them.
 *
 *   npm run check:colors
 *
 * FBS_2025 below is the roster this was written against. When teams move up or
 * down a division, update it: a new school the table doesn't know is exactly
 * the bug this exists to catch.
 */
import { build } from 'vite';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(root, 'node_modules/.cache/team-colors-check');

const problems = [];
const note = (message, detail) => problems.push({ message, detail });

/** The value every unmatched name falls through to. */
const GRAY = 'rgba(140, 140, 140, 0.8)';

/** Must mirror normalizeTeamName in src/utils/teamColors.ts. */
const normalize = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Every school CFBD listed as FBS for 2025, spelled the way CFBD spells it.
 * Each one has to resolve to an entry; whether that entry is a curated colour
 * or a placeholder is reported separately below.
 */
const FBS_2025 = [
  'Air Force', 'Akron', 'Alabama', 'Appalachian State', 'Arizona', 'Arizona State', 'Arkansas',
  'Arkansas State', 'Army', 'Auburn', 'Ball State', 'Baylor', 'Boise State', 'Boston College',
  'Bowling Green', 'Buffalo', 'BYU', 'California', 'Central Michigan', 'Charlotte', 'Cincinnati',
  'Clemson', 'Coastal Carolina', 'Colorado', 'Colorado State', 'UConn', 'Duke', 'East Carolina',
  'Eastern Michigan', 'Florida', 'Florida Atlantic', 'Florida International', 'Florida State',
  'Fresno State', 'Georgia', 'Georgia Southern', 'Georgia State', 'Georgia Tech', "Hawai'i",
  'Houston', 'Illinois', 'Indiana', 'Iowa', 'Iowa State', 'Jacksonville State', 'James Madison',
  'Kansas', 'Kansas State', 'Kennesaw State', 'Kent State', 'Kentucky', 'Liberty', 'Louisiana',
  'Louisiana Monroe', 'Louisiana Tech', 'Louisville', 'LSU', 'Marshall', 'Maryland', 'Memphis',
  'Miami', 'Miami (OH)', 'Michigan', 'Michigan State', 'Middle Tennessee', 'Minnesota',
  'Mississippi State', 'Missouri', 'Navy', 'NC State', 'Nebraska', 'Nevada', 'New Mexico',
  'New Mexico State', 'North Carolina', 'North Texas', 'Northern Illinois', 'Northwestern',
  'Notre Dame', 'Ohio', 'Ohio State', 'Oklahoma', 'Oklahoma State', 'Old Dominion', 'Ole Miss',
  'Oregon', 'Oregon State', 'Penn State', 'Pittsburgh', 'Purdue', 'Rice', 'Rutgers',
  'Sam Houston', 'San Diego State', 'San José State', 'SMU', 'South Alabama', 'South Carolina',
  'South Florida', 'Southern Mississippi', 'Stanford', 'Syracuse', 'TCU', 'Temple', 'Tennessee',
  'Texas', 'Texas A&M', 'Texas State', 'Texas Tech', 'Toledo', 'Troy', 'Tulane', 'Tulsa', 'UAB',
  'UCF', 'UCLA', 'UMass', 'UNLV', 'USC', 'Utah', 'Utah State', 'UTEP', 'UTSA', 'Vanderbilt',
  'Virginia', 'Virginia Tech', 'Wake Forest', 'Washington', 'Washington State', 'West Virginia',
  'Western Kentucky', 'Western Michigan', 'Wisconsin', 'Wyoming',
];

/** Spellings that must land on the same entry as their plain-ASCII twin. */
const VARIANTS = [
  ["Hawai'i", 'Hawaii'],
  ['Hawaiʻi', 'Hawaii'],
  ['San José State', 'San Jose State'],
  ['Miami (OH)', 'Miami (Oh.)'],
  ['NC STATE', 'NC State'],
  ['  Vanderbilt  ', 'Vanderbilt'],
];

/** Names that must never resolve to anything but the default. */
const NON_TEAMS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'Hogwarts', ''];

const outDir = resolve(cache, 'lib');
await build({
  root,
  logLevel: 'error',
  configFile: false,
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    lib: { entry: { colors: resolve(root, 'src/utils/teamColors.ts') }, formats: ['es'] },
  },
});
const { getTeamColors } = await import(pathToFileURL(resolve(outDir, 'colors.js')).href);

// The table and alias map aren't exported, so read them out of the source. That
// keeps the check honest about what actually ships rather than a copy of it.
const source = await import('node:fs').then((fs) =>
  fs.readFileSync(resolve(root, 'src/utils/teamColors.ts'), 'utf8'),
);
const tableKeys = [...source.matchAll(/^ {2}"([^"]+)": \{ success:/gm)].map((m) => m[1]);
const aliasBlock = source.match(/const teamNameAliases[^{]*\{([\s\S]*?)\n\};/);
const aliases = [...(aliasBlock?.[1] ?? '').matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => ({
  alias: m[1],
  canonical: m[2],
}));

if (tableKeys.length < 300) note(`only found ${tableKeys.length} team entries — did the table's shape change?`);
if (!aliases.length) note('found no aliases — did teamNameAliases move or get renamed?');

// 1. Normalized keys must be unique, or one school silently wears another's colours.
const seen = new Map();
for (const key of tableKeys) {
  const n = normalize(key);
  if (seen.has(n)) note(`"${seen.get(n)}" and "${key}" both normalize to "${n}" — one shadows the other`);
  else seen.set(n, key);
}

// 2. Every alias must point at a real entry, and must not be swallowed by one.
for (const { alias, canonical } of aliases) {
  if (!tableKeys.includes(canonical)) {
    note(`alias "${alias}" points at "${canonical}", which is not in the table — it resolves to gray`);
    continue;
  }
  const shadowed = seen.get(normalize(alias));
  if (shadowed && shadowed !== canonical) {
    note(`alias "${alias}" normalizes onto the existing entry "${shadowed}", not "${canonical}"`);
  }
  if (getTeamColors(alias).success !== getTeamColors(canonical).success) {
    note(`alias "${alias}" does not resolve to the same colours as "${canonical}"`);
  }
}

// 3. Spelling variants must agree with their twin.
for (const [variant, twin] of VARIANTS) {
  if (getTeamColors(variant).success !== getTeamColors(twin).success) {
    note(`"${variant}" and "${twin}" resolve differently`);
  }
}

// 4. Nothing that isn't a team may resolve to colours — including prototype keys.
for (const name of NON_TEAMS) {
  const colors = getTeamColors(name);
  if (colors.success !== GRAY) {
    note(`"${name}" resolved to ${colors.success} instead of the default`);
  }
}

// 5. Every FBS school must resolve to an entry. Landing on the placeholder is a
//    palette gap rather than a lookup bug, so it's reported, not failed.
const unresolved = [];
const placeholder = [];
for (const team of FBS_2025) {
  if (!seen.has(normalize(team)) && !aliases.some((a) => normalize(a.alias) === normalize(team))) {
    unresolved.push(team);
  } else if (getTeamColors(team).success === GRAY) {
    placeholder.push(team);
  }
}
for (const team of unresolved) {
  note(`FBS team "${team}" has no entry or alias — it draws in the gray default`);
}

rmSync(cache, { recursive: true, force: true });

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem${problems.length === 1 ? '' : 's'} with the team colour lookup\n`);
  for (const { message, detail } of problems) {
    console.error(`  - ${message}`);
    if (detail) console.error(`    ${detail}`);
  }
  console.error(
    '\nA name the lookup misses does not throw — it draws in the gray default, and\n' +
      'two such teams in one game are indistinguishable. See src/utils/teamColors.ts.\n',
  );
  process.exit(1);
}

console.log(
  `✓ team colours resolve: ${tableKeys.length} entries, ${aliases.length} aliases, ` +
    `${FBS_2025.length} FBS teams, no normalized collisions`,
);
if (placeholder.length) {
  console.log(`  ${placeholder.length} FBS teams still on the gray placeholder: ${placeholder.join(', ')}`);
}
