/**
 * Locks down garbage-time tagging (src/utils/garbageTime.ts).
 *
 * The rule is simple to state and easy to get subtly wrong: judge each play on
 * the score going INTO it, strictly greater than 38/28/22/16 by quarter, never
 * in overtime, not sticky. Every case below type-checks whether the margin
 * logic is right or not, so it's exercised here.
 *
 * Two parts:
 *
 *   1. Offline cases on hand-built games: the boundaries, a touchdown judged
 *      on the score before it, a comeback, sticky mode, null and stale score
 *      fields, two games in one feed. Always runs.
 *
 *   2. The reference table: seven Alabama games, from blowouts to close
 *      losses, checked for excluded plays and success rate before and after.
 *      Close games must exclude nothing — if one does, the margin is being
 *      read off the wrong side of a play. Needs CFB_API_KEY in .env (the same
 *      key `npm run dev` uses), or CFBD_BASE pointed at a proxy that adds it.
 *      Skipped, and said so, when neither is set.
 *
 *   node scripts/check-garbage-time.mjs
 *   node scripts/check-garbage-time.mjs --offline
 *   CFBD_BASE=https://www.graphingcollegefootball.com/api/cfbd node scripts/check-garbage-time.mjs
 */
import { readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(root, 'node_modules/.cache/check-garbage-time');

await build({
  root,
  logLevel: 'error',
  configFile: false,
  build: {
    outDir: cache,
    emptyOutDir: true,
    lib: {
      entry: {
        garbageTime: resolve(root, 'src/utils/garbageTime.ts'),
        metrics: resolve(root, 'src/utils/metrics.ts'),
      },
      formats: ['es'],
    },
  },
});

const load = name => import(pathToFileURL(resolve(cache, `${name}.js`)).href);
const {
  findGarbageTimePlays,
  countedPlays,
  readExcludeGarbageTime,
  garbageTimeParamValue,
} = await load('garbageTime');
const { processPlayData, withGarbageTimeHeld } = await load('metrics');

let failures = 0;
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures += 1;
    console.error(`  ✗ ${label}: expected ${expected}, got ${actual}`);
  }
};

// ---------------------------------------------------------------------------
// 1. Offline cases

/**
 * A game from a list of plays: [offense, quarter, [A score, B score] after the
 * play, play type]. Ids, drives and the offense/defense view of the score are
 * filled in, so each case reads as a scoreboard.
 */
let nextId = 1000;
const game = (steps, { gameId = 1, snake = false } = {}) => {
  let drive = 0;
  let last = null;
  return steps.map(([offense, quarter, after, type = 'Rush'], i) => {
    if (offense !== last) drive += 1;
    last = offense;
    const defense = offense === 'A' ? 'B' : 'A';
    const [a, b] = after;
    const offenseScore = offense === 'A' ? a : b;
    const defenseScore = offense === 'A' ? b : a;
    const scores = snake
      ? { offense_score: offenseScore, defense_score: defenseScore }
      : { offenseScore, defenseScore };
    return {
      id: String(nextId++),
      game_id: gameId,
      drive_number: drive,
      play_number: i + 1,
      offense,
      defense,
      period: quarter,
      play_type: type,
      play_text: '',
      down: 1,
      distance: 10,
      yards_gained: 4,
      ...scores,
    };
  });
};

/** Whether the last play of a game is tagged. */
const lastTagged = (plays, options) => findGarbageTimePlays(plays, options).has(plays[plays.length - 1]);

// Boundaries: strictly greater than the quarter's number.
for (const [quarter, limit] of [[1, 38], [2, 28], [3, 22], [4, 16]]) {
  check(`Q${quarter} lead of ${limit} counts`, lastTagged(game([['A', quarter, [limit, 0], 'Kickoff'], ['B', quarter, [limit, 0]]])), false);
  check(`Q${quarter} lead of ${limit + 1} is garbage`, lastTagged(game([['A', quarter, [limit + 1, 0], 'Kickoff'], ['B', quarter, [limit + 1, 0]]])), true);
}
check('overtime is never garbage', lastTagged(game([['A', 4, [60, 0], 'Kickoff'], ['B', 5, [60, 0]]])), false);
check('second overtime is never garbage', lastTagged(game([['A', 4, [60, 0], 'Kickoff'], ['B', 6, [60, 0]]])), false);
check('no score yet, no garbage', lastTagged(game([['A', 4, [0, 0]]])), false);

// A touchdown is judged on the score before it, not the one it produced.
{
  const plays = game([
    ['A', 4, [10, 0], 'Kickoff'],
    ['A', 4, [16, 0], 'Passing Touchdown'], // 10 going in: counts
    ['A', 4, [17, 0], 'Extra Point Good'], // 16 going in: counts
    ['B', 4, [17, 0], 'Kickoff'], // 17 going in: garbage
    ['B', 4, [17, 0]],
  ]);
  const tagged = findGarbageTimePlays(plays);
  check('TD judged on the score going in', tagged.has(plays[1]), false);
  check('PAT judged on the TD it follows (16)', tagged.has(plays[2]), false);
  check('kickoff after the PAT (17) is garbage', tagged.has(plays[3]), true);
  check('trailing team snaps in garbage time too', tagged.has(plays[4]), true);
}

// Not sticky: a comeback brings plays back.
const comeback = game([
  ['A', 4, [17, 0], 'Kickoff'],
  ['B', 4, [17, 0]], // garbage
  ['B', 4, [17, 7], 'Rushing Touchdown'], // 17 going in: garbage
  ['A', 4, [17, 7], 'Kickoff'], // 10 going in: counts again
  ['A', 4, [17, 7]],
  ['A', 5, [17, 7]],
]);
{
  const tagged = findGarbageTimePlays(comeback);
  check('comeback: play at 17 is garbage', tagged.has(comeback[1]), true);
  check('comeback: scoring play judged at 17', tagged.has(comeback[2]), true);
  check('comeback: back to 10, counts again', tagged.has(comeback[4]), false);

  const sticky = findGarbageTimePlays(comeback, { sticky: true });
  check('sticky: stays garbage after the comeback', sticky.has(comeback[4]), true);
  check('sticky: overtime still counts', sticky.has(comeback[5]), false);
}

// Missing or stale score fields never run a score backwards.
{
  const plays = game([
    ['A', 4, [17, 0], 'Kickoff'],
    ['B', 4, [null, null]],
    ['B', 4, [10, 0]], // stale: below what's already on the board
    ['B', 4, [17, 0]],
  ]);
  const tagged = findGarbageTimePlays(plays);
  check('null scores keep the board', tagged.has(plays[2]), true);
  check('a stale lower score keeps the board', tagged.has(plays[3]), true);
}

// snake_case score fields read the same.
check('snake_case scores', lastTagged(game([['A', 4, [17, 0], 'Kickoff'], ['B', 4, [17, 0]]], { snake: true })), true);

// Feed order doesn't matter: plays are put in drive/play order first.
{
  const plays = game([
    ['A', 4, [10, 0], 'Kickoff'],
    ['A', 4, [17, 0], 'Passing Touchdown'],
    ['B', 4, [17, 0]],
  ]);
  const shuffled = [plays[2], plays[0], plays[1]];
  const tagged = findGarbageTimePlays(shuffled);
  check('shuffled feed: TD still judged at 10', tagged.has(plays[1]), false);
  check('shuffled feed: next play judged at 17', tagged.has(plays[2]), true);
}

// Two games in one feed keep separate scoreboards, even with the same teams.
{
  const blowout = game([['A', 4, [40, 0], 'Kickoff'], ['B', 4, [40, 0]]], { gameId: 1 });
  const close = game([['A', 4, [3, 0], 'Kickoff'], ['B', 4, [3, 0]]], { gameId: 2 });
  const tagged = findGarbageTimePlays([...blowout, ...close]);
  check('season feed: the blowout is garbage', tagged.has(blowout[1]), true);
  check('season feed: the close game is not', tagged.has(close[1]), false);
}

// Plays are tracked as themselves, not by id: two plays sharing an id (a feed
// glitch, or ids JSON.parse rounded past 2^53) can't borrow each other's tag.
{
  const plays = game([
    ['A', 4, [10, 0], 'Kickoff'],
    ['B', 4, [10, 0]], // counts
    ['A', 4, [17, 0], 'Passing Touchdown'],
    ['B', 4, [17, 0]], // garbage
  ]);
  plays[3].id = plays[1].id;
  const tagged = findGarbageTimePlays(plays);
  check('shared id: the counted play stays counted', tagged.has(plays[1]), false);
  check('shared id: the garbage play is still tagged', tagged.has(plays[3]), true);
  const processed = processPlayData(plays);
  check('shared id: processPlayData keeps them apart', processed.map(p => p.garbageTime).join(','), 'false,false,true');
}

// Thresholds are configurable.
check(
  'custom Q4 threshold',
  lastTagged(game([['A', 4, [10, 0], 'Kickoff'], ['B', 4, [10, 0]]]), { thresholds: [38, 28, 22, 9] }),
  true
);

// processPlayData stamps the tag on the plays it keeps, scored by the ones it drops.
{
  const raw = game([
    ['A', 4, [14, 0], 'Kickoff'],
    ['B', 4, [14, 0], 'Rush'], // counts
    ['A', 4, [17, 0], 'Field Goal Good'], // the field goal moves the board, then is filtered out
    ['A', 4, [17, 0], 'Kickoff'],
    ['B', 4, [17, 0], 'Pass Reception'], // garbage
    ['B', 4, [17, 0], 'Rush'], // garbage
  ]);
  const processed = processPlayData(raw);
  check('processed: only rush/pass kept', processed.length, 3);
  check('processed: first rush counts', processed[0].garbageTime, false);
  check('processed: pass after the FG is garbage', processed[1].garbageTime, true);
  check('countedPlays drops it', countedPlays(processed, true).length, 1);
  check('countedPlays off keeps all', countedPlays(processed, false).length, 3);

  // Charts that keep garbage plays on screen hold the running totals level.
  const before = JSON.stringify(processed);
  const held = withGarbageTimeHeld(processed);
  check('held: positions unchanged', held.map(p => p.teamPlayNumber).join(','), '1,2,3');
  check('held: totals hold through garbage time', held[2].teamCumulativeSR, held[0].teamCumulativeSR);
  check('held: originals untouched', JSON.stringify(processed), before);
}

// The URL setting round-trips, and leaves the default out of the link.
check('param default', readExcludeGarbageTime(new URLSearchParams('')), true);
check('param include', readExcludeGarbageTime(new URLSearchParams('garbageTime=include')), false);
check('param exclude', readExcludeGarbageTime(new URLSearchParams('garbageTime=exclude')), true);
check('param junk falls back', readExcludeGarbageTime(new URLSearchParams('garbageTime=maybe')), true);
check('default writes nothing', garbageTimeParamValue(true), null);
check('include writes include', garbageTimeParamValue(false), 'include');

const offlineFailures = failures;
console.log(offlineFailures ? `Offline cases: ${offlineFailures} failed` : 'Offline cases: all passed');

// ---------------------------------------------------------------------------
// 2. The reference table

/**
 * [season, opponent, Alabama points, opponent points, garbage plays excluded,
 *  Alabama SR raw, filtered, opponent SR raw, filtered]
 */
const TABLE = [
  [2022, 'Mississippi State', 30, 6, 98, 33.9, 35.7, 34.5, 29.2],
  [2020, 'Missouri', 38, 19, 82, 42.6, 50.0, 43.7, 35.3],
  [2026, 'LSU', 31, 13, 21, 40.4, 45.5, 46.3, 45.8],
  [2021, 'Georgia', 41, 24, 19, 47.1, 47.8, 48.7, 47.6],
  [2017, 'Florida State', 24, 7, 16, 28.8, 27.8, 38.3, 37.0],
  [2022, 'Ole Miss', 30, 24, 0, 41.8, 41.8, 46.8, 46.8],
  [2024, 'Vanderbilt', 35, 40, 0, 55.6, 55.6, 41.9, 41.9],
];
const TEAM = 'Alabama';

const apiKey = (() => {
  if (process.env.CFB_API_KEY) return process.env.CFB_API_KEY.trim();
  try {
    const line = readFileSync(resolve(root, '.env'), 'utf8').split('\n').find(l => l.startsWith('CFB_API_KEY='));
    return line ? line.slice('CFB_API_KEY='.length).trim() : null;
  } catch {
    return null;
  }
})();
const base = (process.env.CFBD_BASE || (apiKey ? 'https://api.collegefootballdata.com' : '')).replace(/\/+$/, '');

if (process.argv.includes('--offline') || !base) {
  if (!process.argv.includes('--offline')) {
    console.log('Reference table: skipped (no CFB_API_KEY in .env and no CFBD_BASE set).');
  }
  rmSync(cache, { recursive: true, force: true });
  process.exit(offlineFailures ? 1 : 0);
}

const get = async path => {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(`${base}${path}`, { headers });
  if (!response.ok) throw new Error(`${response.status} for ${path}`);
  return response.json();
};

/** The game, found by opponent and final score so a rematch can't be mistaken for it. */
const findGame = async (season, opponent, teamPoints, oppPoints) => {
  const games = await get(`/games?year=${season}&team=${encodeURIComponent(TEAM)}&seasonType=both`);
  return games.find(g => {
    const home = g.homeTeam ?? g.home_team;
    const away = g.awayTeam ?? g.away_team;
    const homePoints = g.homePoints ?? g.home_points;
    const awayPoints = g.awayPoints ?? g.away_points;
    const bamaHome = home === TEAM;
    return (
      (bamaHome ? away : home) === opponent &&
      (bamaHome ? homePoints : awayPoints) === teamPoints &&
      (bamaHome ? awayPoints : homePoints) === oppPoints
    );
  });
};

/** The game's plays the way the app loads them: by gameId, else by week and filtered. */
const fetchPlays = async g => {
  const byId = await get(`/plays?gameId=${g.id}`).catch(() => []);
  if (byId.length > 10) return byId;
  const week = await get(
    `/plays?seasonType=${g.seasonType ?? g.season_type}&year=${g.season}&team=${encodeURIComponent(TEAM)}&week=${g.week}`
  );
  return week.filter(p => String(p.gameId ?? p.game_id) === String(g.id));
};

const pct = plays => (plays.length ? (plays.filter(p => p.success).length / plays.length) * 100 : 0);
const round1 = n => Math.round(n * 10) / 10;

console.log(`\nReference table (${base}):`);
for (const [season, opponent, teamPts, oppPts, expectedCount, bamaRaw, bamaFiltered, oppRaw, oppFiltered] of TABLE) {
  const label = `${season} ${opponent} (${teamPts}-${oppPts})`;
  let g;
  try {
    g = await findGame(season, opponent, teamPts, oppPts);
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${label}: schedule lookup failed (${error.message})`);
    continue;
  }
  if (!g) {
    failures += 1;
    console.error(`  ✗ ${label}: no such game on ${TEAM}'s schedule`);
    continue;
  }

  const raw = await fetchPlays(g);
  const processed = processPlayData(raw);
  const bama = processed.filter(p => p.offense === TEAM);
  const opp = processed.filter(p => p.offense !== TEAM);
  const counted = p => !p.garbageTime;

  const got = {
    rushPassExcluded: processed.filter(p => p.garbageTime).length,
    allExcluded: findGarbageTimePlays(raw).size,
    bamaRaw: round1(pct(bama)),
    bamaFiltered: round1(pct(bama.filter(counted))),
    oppRaw: round1(pct(opp)),
    oppFiltered: round1(pct(opp.filter(counted))),
  };

  const countMatches = got.rushPassExcluded === expectedCount || got.allExcluded === expectedCount;
  const ok =
    countMatches &&
    got.bamaRaw === bamaRaw &&
    got.bamaFiltered === bamaFiltered &&
    got.oppRaw === oppRaw &&
    got.oppFiltered === oppFiltered;
  if (!ok) failures += 1;

  console.log(
    `  ${ok ? '✓' : '✗'} ${label}: excluded ${got.rushPassExcluded} rush/pass of ${processed.length}` +
      ` (${got.allExcluded} counting special teams; table says ${expectedCount}) · ` +
      `${TEAM} SR ${got.bamaRaw}% → ${got.bamaFiltered}% (table ${bamaRaw} → ${bamaFiltered}) · ` +
      `opp SR ${got.oppRaw}% → ${got.oppFiltered}% (table ${oppRaw} → ${oppFiltered})`
  );
}

rmSync(cache, { recursive: true, force: true });

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll garbage-time checks passed.');
