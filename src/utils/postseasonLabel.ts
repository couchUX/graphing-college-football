import { TeamGame } from '../services/api';

// How a postseason game is labelled in the game and season pickers.
//
// This lived twice — once in GameSelector, once in SeasonSelector — and the
// two had already drifted: only one knew the conference championships, only
// the other could pull a bowl name out of arbitrary notes. One copy now, so
// they can't disagree about what a game is called.
//
// CFBD's `notes` are free text and vary by season, so everything here is
// best-effort string matching over an uppercased copy, ordered most specific
// first. What it must never do is assert a round it can't actually tell:
// under the 12-team bracket a team plays up to four playoff games, and the
// old fallback called the first one a semifinal and every later one the
// national championship.

/** Round names, tried before the bowl names a playoff game may also carry. */
const PLAYOFF_ROUNDS: [test: (notes: string) => boolean, label: string][] = [
  [n => n.includes('NATIONAL CHAMPIONSHIP') || n.includes('CFP CHAMPIONSHIP'), 'National Championship'],
  [n => n.includes('SEMIFINAL') || n.includes('SEMI-FINAL'), 'CFP Semifinal'],
  [n => n.includes('QUARTERFINAL') || n.includes('QUARTER-FINAL'), 'CFP Quarterfinal'],
  [n => n.includes('FIRST ROUND') || n.includes('1ST ROUND'), 'CFP First Round'],
];

const CONFERENCE_CHAMPIONSHIPS: [needle: string, label: string][] = [
  ['SEC CHAMPIONSHIP', 'SEC Championship'],
  ['BIG TEN CHAMPIONSHIP', 'Big Ten Championship'],
  ['ACC CHAMPIONSHIP', 'ACC Championship'],
  ['BIG 12 CHAMPIONSHIP', 'Big 12 Championship'],
  ['PAC-12 CHAMPIONSHIP', 'Pac-12 Championship'],
];

/** Bowls worth naming explicitly; anything else falls to the generic match. */
const NAMED_BOWLS = [
  'ROSE', 'SUGAR', 'ORANGE', 'PEACH', 'COTTON', 'FIESTA',
  'CITRUS', 'OUTBACK', 'GATOR', 'LIBERTY', 'HOLIDAY', 'ALAMO',
];

// Capitalise at the start and after a space or hyphen only. A plain \b\w
// would also fire after an apostrophe and give "Duke'S Mayo".
const titleCase = (value: string): string =>
  value.toLowerCase().replace(/(^|[\s-])(\w)/g, (_, sep, c: string) => sep + c.toUpperCase());

/** This team's postseason games, oldest first. */
const postseasonOrder = (allGames: TeamGame[]): TeamGame[] =>
  allGames
    .filter((g) => g.seasonType === 'postseason')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

/**
 * Position in the postseason run, 1-based, or null when there's only one game
 * (nothing to disambiguate) or the game isn't in the list.
 */
const positionInRun = (game: TeamGame, allGames: TeamGame[]): number | null => {
  const games = postseasonOrder(allGames);
  if (games.length <= 1) return null;
  const index = games.findIndex((g) => g.id === game.id);
  return index === -1 ? null : index + 1;
};

export const getPostseasonLabel = (game: TeamGame, allGames: TeamGame[]): string => {
  const position = positionInRun(game, allGames);

  if (!game.notes) {
    return position ? `Postseason ${position}` : `Postseason ${game.week}`;
  }

  const notes = game.notes.toUpperCase();

  for (const [test, label] of PLAYOFF_ROUNDS) {
    if (test(notes)) return label;
  }

  for (const [needle, label] of CONFERENCE_CHAMPIONSHIPS) {
    if (notes.includes(needle)) return label;
  }

  for (const bowl of NAMED_BOWLS) {
    if (notes.includes(`${bowl} BOWL`)) return `${titleCase(bowl)} Bowl`;
  }

  // A playoff game whose notes name no round. Number it and say no more: the
  // bracket is 12 teams, so position alone can't tell a first round from a
  // quarterfinal, and guessing produced four "National Championship" games.
  if (notes.includes('PLAYOFF') || notes.includes('CFP')) {
    return position ? `CFP Game ${position}` : 'CFP Game';
  }

  // Sponsors put apostrophes and periods in bowl names ("Duke's Mayo Bowl",
  // "TaxAct Texas Bowl"), so the class has to be wider than \w or the capture
  // starts mid-name.
  const bowlMatch = notes.match(/([\w'’.-]+(?:\s+[\w'’.-]+)*)\s+BOWL/);
  if (bowlMatch) return `${titleCase(bowlMatch[1])} Bowl`;

  return position ? `Postseason ${position}` : `Postseason ${game.week}`;
};
