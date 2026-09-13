/**
 * Answers one question about CFBD's win probability feed that its docs don't:
 * does a row's probability describe the situation BEFORE the play it names, or
 * AFTER it?
 *
 * It matters because the Win probability tooltip prints a percentage and a play
 * description side by side. If the row is a "before" snapshot, the play text is
 * what happens NEXT and the percentage is the state it starts from. If it's an
 * "after" snapshot, the percentage already contains that play's result.
 *
 * Two independent tests, run against a real game:
 *
 *   1. Down & distance. Each row carries its own down/distance. Compare them to
 *      the pre-snap down/distance of the play the row names (joined by playId)
 *      and to the pre-snap down/distance of the NEXT play. Whichever matches is
 *      the situation the row describes.
 *
 *   2. Scoring plays. On a touchdown, does the row's own score already include
 *      the points, or does the score only move on the following row?
 *
 * Needs CFB_API_KEY in .env (the same key `npm run dev` uses).
 *
 *   node scripts/check-wp-alignment.mjs <gameId>
 *   node scripts/check-wp-alignment.mjs 401628455
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const apiKey = (() => {
  if (process.env.CFB_API_KEY) return process.env.CFB_API_KEY.trim();
  try {
    const line = readFileSync(resolve(root, '.env'), 'utf8')
      .split('\n')
      .find(l => l.startsWith('CFB_API_KEY='));
    return line ? line.slice('CFB_API_KEY='.length).trim() : null;
  } catch {
    return null;
  }
})();

const gameId = process.argv[2];
if (!gameId) {
  console.error('usage: node scripts/check-wp-alignment.mjs <gameId>');
  process.exit(1);
}
if (!apiKey) {
  console.error('No CFB_API_KEY found in the environment or .env');
  process.exit(1);
}

const get = async path => {
  const res = await fetch(`https://api.collegefootballdata.com${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`${path} → HTTP ${res.status}`);
    process.exit(1);
  }
  return res.json();
};

const [wp, plays] = await Promise.all([
  get(`/metrics/wp?gameId=${gameId}`),
  get(`/plays?gameId=${gameId}`),
]);

if (!wp.length) {
  console.error(`No win probability rows for game ${gameId}`);
  process.exit(1);
}

const playById = new Map(plays.map(p => [String(p.id), p]));
const dd = x => (x && x.down ? `${x.down} & ${x.distance}` : '—');
const pre = row => playById.get(String(row.playId));

// --- Test 1: which snap does the row's own down & distance describe? --------
let matchesOwn = 0;
let matchesNext = 0;
let compared = 0;

for (let i = 0; i < wp.length - 1; i += 1) {
  const own = pre(wp[i]);
  const next = pre(wp[i + 1]);
  if (!own || !next || !own.down || !next.down || !wp[i].down) continue;
  // Only count rows where the two candidates actually differ, otherwise the
  // row agrees with both and tells us nothing.
  if (own.down === next.down && own.distance === next.distance) continue;
  compared += 1;
  if (wp[i].down === own.down && wp[i].distance === own.distance) matchesOwn += 1;
  else if (wp[i].down === next.down && wp[i].distance === next.distance) matchesNext += 1;
}

// --- Test 2: on a touchdown, has the row's score already moved? ------------
let scoredOnOwnRow = 0;
let scoredOnNextRow = 0;

for (let i = 1; i < wp.length - 1; i += 1) {
  if (!/touchdown/i.test(wp[i].playText || '')) continue;
  const before = wp[i - 1].homeScore + wp[i - 1].awayScore;
  const own = wp[i].homeScore + wp[i].awayScore;
  const next = wp[i + 1].homeScore + wp[i + 1].awayScore;
  if (own > before) scoredOnOwnRow += 1;
  else if (next > own) scoredOnNextRow += 1;
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : 'n/a');

console.log(`\nGame ${gameId} — ${wp[0].away} at ${wp[0].home}`);
console.log(`${wp.length} win probability rows, ${plays.length} plays, ${wp.filter(r => pre(r)).length} rows joined to a play by playId\n`);

console.log('Down & distance on the row describes…');
console.log(`  the play the row names (pre-snap):  ${matchesOwn}/${compared}  ${pct(matchesOwn, compared)}`);
console.log(`  the NEXT play (i.e. post-play):     ${matchesNext}/${compared}  ${pct(matchesNext, compared)}`);

console.log('\nOn touchdowns, the score on the row…');
console.log(`  already includes the points:        ${scoredOnOwnRow}`);
console.log(`  only moves on the following row:    ${scoredOnNextRow}`);

const beforePlay = matchesOwn > matchesNext;
console.log(
  `\nVerdict: the probability describes the state ${beforePlay ? 'BEFORE' : 'AFTER'} the play it names.` +
    (beforePlay
      ? '\n  → the play text is what happens next; its result lands on the following row.'
      : '\n  → the play text is what just happened; the probability already contains its result.')
);

console.log('\nFirst 12 rows:\n');
console.log(
  ['#', 'WP(home)', 'row d&d', 'play d&d', 'score', 'play text'].join('\t')
);
for (let i = 0; i < Math.min(12, wp.length); i += 1) {
  const r = wp[i];
  console.log(
    [
      i + 1,
      `${(r.homeWinProbability * 100).toFixed(1)}%`,
      dd(r),
      dd(pre(r)),
      `${r.awayScore}-${r.homeScore}`,
      String(r.playText || '').slice(0, 70),
    ].join('\t')
  );
}
console.log('');
