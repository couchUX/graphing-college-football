import { API_BASE_URL, getApiHeaders } from '../config/api';
import { cachedFetch } from '../utils/apiCache';

export interface ApiPlayData {
  id: string; // Changed from number to string to handle large IDs properly
  drive_id: number;
  game_id: number;
  drive_number: number;
  play_number: number;
  offense: string;
  defense: string;
  offense_conference: string;
  defense_conference: string;
  down: number;
  distance: number;
  yards_to_goal: number;
  yards_gained: number;
  play_type: string;
  play_text: string;
  ppa: number;
  quarter: number;
  clock: {
    minutes: number;
    seconds: number;
  };
  wallclock: string;
  time_remaining: number;
  home?: string;
  away?: string;

  // CFBD has served camelCase for some of these fields depending on endpoint
  // and era, and the processing code reads either spelling. Declared optional
  // so that fallback stays type-checked rather than cast away.
  driveNumber?: number;
  playNumber?: number;
  yardsGained?: number;
  yardsToGoal?: number;
  playType?: string;
  playText?: string;
  period?: number;
  driveId?: number;
  gameId?: number;
  offenseConference?: string;
  defenseConference?: string;
  timeRemaining?: number;
}

export interface Team {
  id: number;
  school: string;
  mascot: string;
  abbreviation: string;
  alt_name_1?: string;
  alt_name_2?: string;
  alt_name_3?: string;
  conference: string;
  division: string;
  classification?: string;
  color: string;
  alt_color: string;
  logos: string[];
}

// Divisions that field a football team we chart. The CFBD /teams endpoint
// also returns lower divisions (ii, iii) and defunct/non-football programs.
const FOOTBALL_CLASSIFICATIONS = new Set(['fbs', 'fcs']);

export const isFootballTeam = (team: Team): boolean => {
  if (team.classification) {
    return FOOTBALL_CLASSIFICATIONS.has(team.classification.toLowerCase());
  }
  // Older/edge responses may omit classification; fall back to "has a conference".
  return Boolean(team.conference);
};

export interface TeamGame {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  startTimeTBD: boolean;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  attendance: number;
  venueId: number;
  venue: string;
  homeId: number;
  homeTeam: string;
  homeConference: string;
  homeClassification: string;
  homePoints: number;
  homeLineScores: number[];
  homePostgameWinProbability: number;
  homePregameElo: number;
  homePostgameElo: number;
  awayId: number;
  awayTeam: string;
  awayConference: string;
  awayClassification: string;
  awayPoints: number;
  awayLineScores: number[];
  awayPostgameWinProbability: number;
  awayPregameElo: number;
  awayPostgameElo: number;
  excitementIndex: number;
  highlights: string;
  notes: string;
}

/**
 * The full FBS+FCS team list, cached for a day. It changes at most once a
 * season, and every Games/Trends visit needs it before anything can be picked.
 */
export const fetchTeams = async (): Promise<Team[]> =>
  cachedFetch('teams', async () => {
    const response = await fetch(`${API_BASE_URL}/teams`, { headers: getApiHeaders() });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: Team[] = await response.json();
    return data.filter(isFootballTeam);
  });

export const fetchAllGames = async (year: number): Promise<TeamGame[]> => {
  const url = `${API_BASE_URL}/games?year=${year}`;

  const response = await fetch(url, { headers: getApiHeaders() });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * A team's schedule for a season. Cached for an hour so flipping between teams
 * and years is instant, while in-season results still refresh the same day.
 */
export const fetchGamesForTeam = async (params: {
  year: number;
  team: string;
}): Promise<TeamGame[]> => {
  const { year, team } = params;

  return cachedFetch(
    `games:${year}:${team}`,
    async () => {
      const url = `${API_BASE_URL}/games?year=${year}&team=${encodeURIComponent(team)}`;
      const response = await fetch(url, { headers: getApiHeaders() });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    ONE_HOUR_MS
  );
};

/**
 * Whether a game can be charted yet. During a season in progress the schedule
 * endpoint returns the whole slate, most of it unplayed, so anything that
 * hasn't kicked off would load an empty chart. Kickoff rather than `completed`
 * is the test here: CFBD serves plays while a game is still going, and a game
 * in progress charts fine. Season-level views stick to `completed`, since a
 * half-finished game would skew per-game averages.
 */
export const hasKickedOff = (game: TeamGame, now: number = Date.now()): boolean => {
  if (game.completed) return true;
  const kickoff = new Date(game.startDate).getTime();
  return Number.isFinite(kickoff) && kickoff <= now;
};

export interface WinProbabilityData {
  gameId: number;
  homeId: number;
  home: string;
  awayId: number;
  away: string;
  playId: string;
  playText: string;
  homeScore: number;
  awayScore: number;
  down: number;
  distance: number;
  homeWinProbability: number;
  spread: number;
  yardLine: number;
  homeBall: boolean;
  playNumber: number;
}

export const fetchWinProbabilityData = async (gameId: string): Promise<WinProbabilityData[]> => {
  try {
    const url = `${API_BASE_URL}/metrics/wp?gameId=${gameId}`;

    const response = await fetch(url, { headers: getApiHeaders() });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error fetching win probability data:', error);
    throw error;
  }
};

export const fetchPlayByPlayData = async (params: {
  year: number;
  week: number;
  seasonType: string;
  team: string;
  gameId?: string;
}): Promise<ApiPlayData[]> => {
  try {
    const { year, week, seasonType, team, gameId } = params;
    
    // If gameId is provided, try to fetch by gameId first
    if (gameId) {
      const gameIdUrl = `${API_BASE_URL}/plays?gameId=${gameId}`;

      try {
        const gameIdResponse = await fetch(gameIdUrl, { headers: getApiHeaders() });
        if (gameIdResponse.ok) {
          const gameIdData = await gameIdResponse.json();

          // If we got meaningful data (more than a few plays), use it
          // A handful of plays means the gameId lookup didn't really resolve;
          // fall through to the week-based fetch below.
          if (gameIdData.length > 10) {
            return gameIdData;
          }
        }
      } catch {
        // gameId lookup failed — fall back to the week-based fetch.
      }
    }
    
    // Fallback to week-based fetch
    const url = `${API_BASE_URL}/plays?seasonType=${seasonType}&year=${year}&team=${encodeURIComponent(team)}&week=${week}`;
    
    const response = await fetch(url, { headers: getApiHeaders() });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    
    // If gameId was provided but gameId fetch failed, try to filter the week-based results
    let finalData = data;
    if (gameId && data.length > 0) {
      
      try {
        // Get game info to help with filtering
        const gameInfoUrl = `${API_BASE_URL}/games?id=${gameId}`;
        const gameInfoResponse = await fetch(gameInfoUrl, { headers: getApiHeaders() });
        
        if (gameInfoResponse.ok) {
          const gameInfo = await gameInfoResponse.json();
          if (gameInfo.length > 0) {
            const game = gameInfo[0];

            // First try to filter by game_id if available in play data
            let filteredPlays = data.filter((play: ApiPlayData) => {
              return play.game_id && play.game_id.toString() === gameId.toString();
            });

            // If no game_id filtering worked, try date-based filtering
            if (filteredPlays.length === 0) {
              filteredPlays = data.filter((play: ApiPlayData) => {
                if (play.wallclock) {
                  const playDateTime = new Date(play.wallclock);
                  const gameDateTime = new Date(game.startDate);

                  // Allow plays within 24 hours of game start (to handle games that span midnight)
                  const timeDiff = Math.abs(playDateTime.getTime() - gameDateTime.getTime());
                  const hoursDiff = timeDiff / (1000 * 60 * 60);

                  return hoursDiff <= 24;
                }
                // Include plays without wallclock (like overtime plays)
                return true;
              });
            }

            // If still no matches, try filtering by opponent teams
            if (filteredPlays.length === 0) {
              const homeTeam = game.homeTeam;
              const awayTeam = game.awayTeam;

              filteredPlays = data.filter((play: ApiPlayData) => {
                return (play.home && play.away &&
                        ((play.home === homeTeam && play.away === awayTeam) ||
                         (play.home === awayTeam && play.away === homeTeam)));
              });
            }
            
            // No filter matched — keep the unfiltered week results.
            if (filteredPlays.length > 0) {
              finalData = filteredPlays;
            }
          }
        }
      } catch {
        // gameId lookup failed — fall back to the week-based fetch.
      }
    }
    
    // Ensure IDs are treated as strings
    const processedData = finalData.map((play: any) => ({
      ...play,
      id: String(play.id) // Convert ID to string to handle large numbers properly
    }));


    return processedData;
  } catch (error) {
    console.error('Error fetching play-by-play data:', error);
    throw error;
  }
};