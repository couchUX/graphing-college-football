import { API_BASE_URL, getApiHeaders } from '../config/api';

interface ApiPlayData {
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

// Keep the fetchTeams function but we'll replace it with a simpler approach
export const fetchTeams = async (): Promise<Team[]> => {
  try {
    const url = `${API_BASE_URL}/teams`;
    
    console.log('Fetching teams from:', url);
    
    const response = await fetch(url, { headers: getApiHeaders() });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: Team[] = await response.json();
    const footballTeams = data.filter(isFootballTeam);
    console.log('Fetched teams:', data.length, '→ FBS/FCS:', footballTeams.length);

    return footballTeams;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

export const fetchAllGames = async (year: number): Promise<TeamGame[]> => {
  const url = `${API_BASE_URL}/games?year=${year}`;
  console.log('Fetching all games from:', url);

  const response = await fetch(url, { headers: getApiHeaders() });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log('Fetched all games:', data.length);
  return data;
};

export const fetchGamesForTeam = async (params: {
  year: number;
  team: string;
}): Promise<TeamGame[]> => {
  try {
    const { year, team } = params;
    const url = `${API_BASE_URL}/games?year=${year}&team=${encodeURIComponent(team)}`;
    
    console.log('Fetching games from:', url);
    
    const response = await fetch(url, { headers: getApiHeaders() });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched games for team:', data.length);
    
    return data;
  } catch (error) {
    console.error('Error fetching games:', error);
    throw error;
  }
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
    console.log('Fetching win probability from:', url);

    const response = await fetch(url, { headers: getApiHeaders() });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Fetched win probability data:', data.length);

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
      console.log('Fetching plays by gameId from:', gameIdUrl);

      try {
        const gameIdResponse = await fetch(gameIdUrl, { headers: getApiHeaders() });
        if (gameIdResponse.ok) {
          const gameIdData = await gameIdResponse.json();
          console.log('Fetched plays by gameId:', gameIdData.length);

          // If we got meaningful data (more than a few plays), use it
          if (gameIdData.length > 10) {
            return gameIdData;
          } else {
            console.log('GameId returned insufficient data, falling back to week-based fetch');
          }
        }
      } catch (error) {
        console.log('GameId fetch failed, falling back to week-based fetch:', error);
      }
    }
    
    // Fallback to week-based fetch
    const url = `${API_BASE_URL}/plays?seasonType=${seasonType}&year=${year}&team=${encodeURIComponent(team)}&week=${week}`;
    console.log('Fetching plays by week from:', url);
    
    const response = await fetch(url, { headers: getApiHeaders() });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched plays by week:', data.length);

    
    // If gameId was provided but gameId fetch failed, try to filter the week-based results
    let finalData = data;
    if (gameId && data.length > 0) {
      console.log('Attempting to filter week-based results by gameId:', gameId);
      
      try {
        // Get game info to help with filtering
        const gameInfoUrl = `${API_BASE_URL}/games?id=${gameId}`;
        const gameInfoResponse = await fetch(gameInfoUrl, { headers: getApiHeaders() });
        
        if (gameInfoResponse.ok) {
          const gameInfo = await gameInfoResponse.json();
          if (gameInfo.length > 0) {
            const game = gameInfo[0];
            const gameDate = new Date(game.startDate);
            const gameDateString = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            console.log('Game date for filtering:', gameDateString);
            
            // First try to filter by game_id if available in play data
            let filteredPlays = data.filter((play: ApiPlayData) => {
              return play.game_id && play.game_id.toString() === gameId.toString();
            });

            // If no game_id filtering worked, try date-based filtering
            if (filteredPlays.length === 0) {
              console.log('No game_id matches found, trying date-based filtering');
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
              console.log('Date filtering failed, trying team-based filtering');
              const homeTeam = game.homeTeam;
              const awayTeam = game.awayTeam;

              filteredPlays = data.filter((play: ApiPlayData) => {
                return (play.home && play.away &&
                        ((play.home === homeTeam && play.away === awayTeam) ||
                         (play.home === awayTeam && play.away === homeTeam)));
              });
            }
            
            if (filteredPlays.length > 0) {
              console.log(`Filtered plays by game date: ${filteredPlays.length} plays for game ${gameId}`);
              finalData = filteredPlays;
            } else {
              console.log('Date filtering failed, returning all week plays');
            }
          }
        }
      } catch (error) {
        console.log('Game filtering failed:', error);
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