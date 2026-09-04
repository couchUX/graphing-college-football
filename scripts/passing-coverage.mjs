#!/usr/bin/env node
/**
 * How much of the passing data is actually charted?
 *
 * The `/passing` endpoints carry air yards, target location and yards after
 * catch, but those are charting-derived upstream and are not on every attempt.
 * The passing charts hide themselves below a coverage floor (60% of attempts
 * with air yards, see src/utils/passing.ts), so before trusting a season it is
 * worth knowing what its coverage looks like.
 *
 * This talks to CFBD directly rather than through the app's proxy, so it needs
 * the key in the environment or in .env:
 *
 *   node scripts/passing-coverage.mjs
 *   node scripts/passing-coverage.mjs --years 2023,2024,2025 --teams Alabama,"Boise State"
 *
 * Nothing here is imported by the app; it exists to answer the coverage
 * question once and then be ignored.
 */
import { readFileSync } from 'node:fs';

const BASE = 'https://api.collegefootballdata.com';

const readKey = () => {
  if (process.env.CFB_API_KEY) return process.env.CFB_API_KEY.trim();
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const match = env.match(/^\s*CFB_API_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    // No .env — fall through to the error below.
  }
  return null;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    years: get('--years', '2023,2024,2025').split(',').map(y => Number(y.trim())),
    teams: get('--teams', 'Alabama,Boise State').split(',').map(t => t.trim()),
  };
};

const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');

const fetchAttempts = async (key, year, team) => {
  const url = `${BASE}/passing/plays?year=${year}&team=${encodeURIComponent(team)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return { rows: JSON.parse(text), bytes: text.length };
};

const summarize = (rows, bytes) => {
  const valid = rows.filter(r => r.parseStatus !== 'invalid');
  const live = valid.filter(r => !r.isSpike && !r.isThrowaway && !r.isIntentionalGrounding);
  const completions = live.filter(r => r.outcome === 'completion');
  const parse = { complete: 0, partial: 0, invalid: 0 };
  rows.forEach(r => {
    parse[r.parseStatus] = (parse[r.parseStatus] || 0) + 1;
  });

  return {
    rows: rows.length,
    valid: valid.length,
    live: live.length,
    parse,
    airYards: live.filter(r => r.airYards != null).length,
    location: live.filter(r => r.passLocation != null).length,
    depth: live.filter(r => r.passDepth != null).length,
    targetSpot: live.filter(r => r.targetYardsToGoal != null).length,
    yac: completions.filter(r => r.yardsAfterCatch != null).length,
    completions: completions.length,
    passerIds: new Set(live.map(r => r.passerId).filter(Boolean)).size,
    targetIds: new Set(live.map(r => r.targetId).filter(Boolean)).size,
    sackText: rows.filter(r => /sack/i.test(r.playText || '')).length,
    kb: Math.round(bytes / 1024),
  };
};

const run = async () => {
  const key = readKey();
  if (!key) {
    console.error('No CFB_API_KEY found in the environment or in .env.');
    process.exit(1);
  }

  const { years, teams } = parseArgs();
  const failures = [];

  console.log('Pass-attempt coverage. "Charted" is the share of real attempts');
  console.log('(spikes, throwaways and grounding excluded) carrying air yards.');
  console.log('The passing charts need 60% to draw at all.\n');

  const header = ['Season', 'Team', 'Attempts', 'Charted', 'Location', 'YAC', 'Parse', 'Size'];
  const widths = [7, 16, 9, 9, 9, 9, 22, 7];
  console.log(header.map((h, i) => h.padEnd(widths[i])).join(''));
  console.log(widths.map(w => '-'.repeat(w - 1)).join(' '));

  for (const year of years) {
    for (const team of teams) {
      try {
        const { rows, bytes } = await fetchAttempts(key, year, team);
        const s = summarize(rows, bytes);
        const cells = [
          String(year),
          team.length > 15 ? `${team.slice(0, 14)}…` : team,
          String(s.live),
          pct(s.airYards, s.live),
          pct(s.location, s.live),
          pct(s.yac, s.completions),
          `${s.parse.complete}c/${s.parse.partial || 0}p/${s.parse.invalid || 0}i`,
          `${s.kb}KB`,
        ];
        console.log(cells.map((c, i) => c.padEnd(widths[i])).join(''));

        if (year === years[years.length - 1] && team === teams[0]) {
          console.log(
            `\n  ${team} ${year} detail: ${s.passerIds} passer IDs, ${s.targetIds} target IDs, ` +
              `${s.depth} with short/deep, ${s.targetSpot} with a target spot on the field.`
          );
          console.log(
            `  Rows whose text mentions a sack: ${s.sackText} ` +
              '(should be ~0 — sacks are not attempts here, but are pass plays to us).\n'
          );
        }
      } catch (err) {
        failures.push(`${year} ${team}: ${err.message}`);
        console.log(`${String(year).padEnd(7)}${team.padEnd(16)}failed — ${err.message}`);
      }
    }
  }

  if (failures.length) {
    console.log(`\n${failures.length} request(s) failed.`);
  }
  console.log('\nPaste this output back into the passing plan and it can stop guessing.');
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
