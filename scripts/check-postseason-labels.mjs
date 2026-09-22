// Exercise the postseason label grammar. CFBD's `notes` are free text, so the
// matching is all string work that tsc and vite build are perfectly happy to
// let drift — this is what actually pins the behaviour down.
//
// The case that motivated it: under the 12-team bracket a team can play four
// playoff games, and the old fallback labelled the first "CFP Semifinal" and
// every later one "National Championship".
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Bundle the util to a scratch directory and load it, then throw the
// directory away: once imported the module lives in memory, so the file on
// disk is disposable. In a finally so a failed build doesn't leave one behind
// either — this runs often enough that the strays would pile up.
const dir = mkdtempSync(join(tmpdir(), 'postseason-'));
let getPostseasonLabel;
try {
  const out = join(dir, 'postseasonLabel.mjs');
  await build({
    entryPoints: ['src/utils/postseasonLabel.ts'],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
  });
  ({ getPostseasonLabel } = await import(out));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

let day = 0;
const game = (notes, id = ++day) => ({
  id,
  notes,
  seasonType: 'postseason',
  week: 1,
  // Ordering is by startDate; one game per day keeps the run in call order.
  startDate: `2024-12-${String(10 + id).padStart(2, '0')}T00:00:00.000Z`,
});

const results = [];
const check = (name, actual, expected) => {
  const pass = actual === expected;
  results.push({ name, pass });
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}\n      got: ${actual}\n      want: ${expected}`);
};

// A full 12-team run: four games, each naming its round.
const run = [
  game('College Football Playoff First Round'),
  game('College Football Playoff Quarterfinal - Fiesta Bowl'),
  game('College Football Playoff Semifinal - Orange Bowl'),
  game('CFP National Championship'),
];
console.log('a full 12-team playoff run');
check('first round', getPostseasonLabel(run[0], run), 'CFP First Round');
check('quarterfinal beats the bowl name it carries', getPostseasonLabel(run[1], run), 'CFP Quarterfinal');
check('semifinal beats the bowl name it carries', getPostseasonLabel(run[2], run), 'CFP Semifinal');
check('championship', getPostseasonLabel(run[3], run), 'National Championship');

// The regression: playoff games whose notes name no round.
console.log('\nplayoff games with no round in the notes');
const vague = [game('College Football Playoff'), game('CFP'), game('College Football Playoff')];
check('game 1 is not asserted to be a semifinal', getPostseasonLabel(vague[0], vague), 'CFP Game 1');
check('game 2 is not asserted to be the title game', getPostseasonLabel(vague[1], vague), 'CFP Game 2');
check('game 3 is not asserted to be the title game', getPostseasonLabel(vague[2], vague), 'CFP Game 3');
const lone = [game('College Football Playoff')];
check('a lone playoff game is not numbered', getPostseasonLabel(lone[0], lone), 'CFP Game');

// Conference championships — these only existed in SeasonSelector's copy.
console.log('\nconference championships (were missing from the Games picker)');
for (const [notes, want] of [
  ['SEC Championship', 'SEC Championship'],
  ['Big Ten Championship Game', 'Big Ten Championship'],
  ['ACC Championship', 'ACC Championship'],
  ['Big 12 Championship', 'Big 12 Championship'],
  ['Pac-12 Championship', 'Pac-12 Championship'],
]) {
  const g = [game(notes)];
  check(notes, getPostseasonLabel(g[0], g), want);
}

// Bowls — named ones, and the generic extraction that only GameSelector had.
console.log('\nbowls');
for (const [notes, want] of [
  ['Rose Bowl', 'Rose Bowl'],
  ['Allstate Sugar Bowl', 'Sugar Bowl'],
  ['Duke’s Mayo Bowl', 'Duke’s Mayo Bowl'],
  ['TaxAct Texas Bowl', 'Taxact Texas Bowl'],
  ['Pop-Tarts Bowl', 'Pop-Tarts Bowl'],
]) {
  const g = [game(notes)];
  check(notes, getPostseasonLabel(g[0], g), want);
}

// No notes at all.
console.log('\nmissing notes');
const bare = [game(null), game(null)];
check('numbered within the run', getPostseasonLabel(bare[0], bare), 'Postseason 1');
const single = [{ ...game(null), week: 15 }];
check('lone game falls back to the week', getPostseasonLabel(single[0], single), 'Postseason 15');

const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length ? '✗' : '✓'} postseason labels: ${results.length - failed.length}/${results.length} cases`);
process.exit(failed.length ? 1 : 0);
