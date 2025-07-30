const API_BASE_URL = 'https://api.collegefootballdata.com';
const API_TOKEN = 'V3y3fLyvrUtg7Kt98Rn1tv2W05bbv3Hl7PgJ5DPDdFWLOMerDBOVpB0hXKtlBxyW';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

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
}

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