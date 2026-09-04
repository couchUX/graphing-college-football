/**
 * CFBD passing endpoints (`/passing/*`).
 *
 * These arrived in the CFBD client 5.25.0 and are the first source on the site
 * that carries *where* a pass went: air yards, short/deep, left/middle/right,
 * and yards after the catch. None of that can be derived from `/plays`, which
 * is why the passing charts need their own fetchers rather than more regex over
 * `play_text`.
 *
 * Two things to know before using these:
 *
 * 1. **They carry no success, explosiveness or PPA.** Those still come from our
 *    own play processing; `utils/passing.ts` joins an attempt to its play on
 *    `playId` so the existing definitions apply unchanged.
 * 2. **Attempts are not our "pass plays."** Sacks are pass plays to us (see
 *    `utils/playType.ts`) but are not attempts here. Any chart mixing the two
 *    has to say which denominator it used.
 *
 * A whole team-season comes back in one request, so unlike `/plays` these need
 * no per-game fan-out.
 */
import { API_BASE_URL, getApiHeaders } from '../config/api';
import { cachedFetch } from '../utils/apiCache';

export type PassOutcome = 'completion' | 'incompletion' | 'interception';
export type PassDepth = 'short' | 'deep';
export type PassDirection = 'left' | 'middle' | 'right';
export type PassLocation =
  | 'short left'
  | 'short middle'
  | 'short right'
  | 'deep left'
  | 'deep middle'
  | 'deep right';
export type PassParseStatus = 'complete' | 'partial' | 'invalid';

/** One enriched pass attempt, from `/passing/plays`. */
export interface PassingPlay {
  gameId: number;
  playId: string;
  driveId: string;
  season: number;
  week: number;
  seasonType: string;
  offenseId: number;
  offense: string;
  offenseConference: string | null;
  defenseId: number;
  defense: string;
  defenseConference: string | null;
  period: number;
  clock: { minutes: number; seconds: number };
  down: number;
  distance: number;
  playText: string | null;
  passerId: string | null;
  passer: string | null;
  targetId: string | null;
  target: string | null;
  outcome: PassOutcome;
  airYards: number | null;
  passDepth: PassDepth | null;
  passDirection: PassDirection | null;
  passLocation: PassLocation | null;
  totalYards: number | null;
  yardsAfterCatch: number | null;
  startYardline: number;
  startYardsToGoal: number;
  targetYardsToGoal: number | null;
  isSpike: boolean;
  isThrowaway: boolean;
  isIntentionalGrounding: boolean;
  parseStatus: PassParseStatus;
}

/**
 * The aggregate block shared by every player/team passing route.
 *
 * The three `*AttemptsAvailable` counts are the API telling us how many
 * attempts actually carry each measure. They are the honest denominator for
 * anything we draw — see `coverageOf()` in `utils/passing.ts`.
 */
export interface PassingProduction {
  attempts: number;
  completions: number;
  incompletions: number;
  interceptions: number;
  completionRate: number | null;
  airYardsAttemptsAvailable: number;
  totalAirYards: number | null;
  averageDepthOfTarget: number | null;
  totalYardsAttemptsAvailable: number;
  totalYards: number | null;
  yardsAfterCatchAttemptsAvailable: number;
  totalYardsAfterCatch: number | null;
  averageYardsAfterCatch: number | null;
}

export interface TeamPassingGame {
  gameId: number;
  season: number;
  week: number;
  seasonType: string;
  team: string;
  conference: string | null;
  opponent: string;
  offense: PassingProduction;
  defense: PassingProduction;
}

export interface PlayerPassingGame extends PassingProduction {
  gameId: number;
  season: number;
  week: number;
  seasonType: string;
  playerId: string;
  player: string;
  team: string;
  conference: string | null;
  opponent: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: getApiHeaders() });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

/**
 * Pass attempts for one game, or for a team's whole season when `gameId` is
 * omitted. Cached for an hour, matching the schedule cache: long enough that
 * flipping between games is instant, short enough that an in-progress season
 * still refreshes the same day.
 */
export const fetchPassingPlays = async (params: {
  year: number;
  team: string;
  gameId?: string;
}): Promise<PassingPlay[]> => {
  const { year, team, gameId } = params;
  const query = new URLSearchParams({ year: String(year), team });
  if (gameId) query.set('gameId', gameId);

  return cachedFetch(
    `passing:plays:${year}:${team}:${gameId ?? 'season'}`,
    () => getJson<PassingPlay[]>(`/passing/plays?${query}`),
    ONE_HOUR_MS
  );
};

/** Per-game team passing production (offense and defense) for a whole season. */
export const fetchTeamPassingByGame = async (params: {
  year: number;
  team: string;
}): Promise<TeamPassingGame[]> => {
  const { year, team } = params;
  const query = new URLSearchParams({ year: String(year), team });

  return cachedFetch(
    `passing:teams:${year}:${team}`,
    () => getJson<TeamPassingGame[]>(`/passing/teams/games?${query}`),
    ONE_HOUR_MS
  );
};

/** Per-game production for every passer on a team across a season. */
export const fetchPlayerPassingByGame = async (params: {
  year: number;
  team: string;
}): Promise<PlayerPassingGame[]> => {
  const { year, team } = params;
  const query = new URLSearchParams({ year: String(year), team });

  return cachedFetch(
    `passing:players:${year}:${team}`,
    () => getJson<PlayerPassingGame[]>(`/passing/players/games?${query}`),
    ONE_HOUR_MS
  );
};
