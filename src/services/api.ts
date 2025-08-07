const API_BASE_URL = 'https://api.collegefootballdata.com';
const API_TOKEN = 'hLbzCRUDZnzyUKQfCCV56wmx8+weMvUqr4O7YJ4EhU1oCAvuNuop7+N1hABCVTup';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

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
  color: string;
  alt_color: string;
  logos: string[];
}

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
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched teams:', data.length);
    
    return data;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

export const fetchGamesForTeam = async (params: {
  year: number;
  team: string;
}): Promise<TeamGame[]> => {
  try {
    const { year, team } = params;
    const url = `${API_BASE_URL}/games?year=${year}&team=${team}`;
    
    console.log('Fetching games from:', url);
    
    const response = await fetch(url, { headers });
    
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

export const fetchPlayByPlayData = async (params: {
  year: number;
  week: number;
  seasonType: string;
  team: string;
}): Promise<ApiPlayData[]> => {
  try {
    const { year, week, seasonType, team } = params;
    const url = `${API_BASE_URL}/plays?seasonType=${seasonType}&year=${year}&team=${team}&week=${week}`;
    
    console.log('Fetching from:', url);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched plays:', data.length);
    
    // Ensure IDs are treated as strings
    const processedData = data.map((play: any) => ({
      ...play,
      id: String(play.id) // Convert ID to string to handle large numbers properly
    }));
    
    return processedData;
  } catch (error) {
    console.error('Error fetching play-by-play data:', error);
    throw error;
  }
};