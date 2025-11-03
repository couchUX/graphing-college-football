import { API_BASE_URL, getApiHeaders } from '../config/api';

export interface SPRating {
  year: number;
  team: string;
  conference?: string;
  rating: number;
  ranking: number;
  secondOrderWins?: number;
  sos?: number;
  offense?: {
    ranking: number;
    rating: number;
  };
  defense?: {
    ranking: number;
    rating: number;
  };
  specialTeams?: {
    ranking: number;
    rating: number;
  };
}

export const fetchSPRatings = async (year: number): Promise<SPRating[]> => {
  try {
    const url = `${API_BASE_URL}/ratings/sp?year=${year}`;
    console.log('Fetching SP+ ratings from:', url);

    const response = await fetch(url, { headers: getApiHeaders() });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Fetched SP+ ratings:', data.length, 'teams');

    return data;
  } catch (error) {
    console.error('Error fetching SP+ ratings:', error);
    throw error;
  }
};
