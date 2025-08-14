import { API_BASE_URL, getApiHeaders } from '../config/api';

const headers = getApiHeaders();

export interface BoxScoreTeam {
  school: string;
  conference: string;
  homeAway: string;
  points: number;
  stats: Array<{
    category: string;
    stat: string;
  }>;
}

export interface Game {
  id: number;
  teams: BoxScoreTeam[];
}

export const fetchBoxScore = async (params: {
  year: number;
  week: number;
  seasonType: string;
  team: string;
}): Promise<Game[]> => {
  try {
    const { year, week, seasonType, team } = params;
    const url = `${API_BASE_URL}/games/teams?seasonType=${seasonType}&year=${year}&team=${team}&week=${week}`;
    
    console.log('Fetching box score from:', url);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched box score data:', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching box score data:', error);
    throw error;
  }
};