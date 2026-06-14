import { API_BASE_URL, getApiHeaders } from '../config/api';
import { withRetry } from '../utils/asyncUtils';

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

    return data;
  } catch (error) {
    console.error('Error fetching SP+ ratings:', error);
    throw error;
  }
};

// All seasons of SP+ ratings for a single team, oldest year first.
export const fetchSPRatingsHistory = async (team: string): Promise<SPRating[]> => {
  try {
    const url = `${API_BASE_URL}/ratings/sp?team=${encodeURIComponent(team)}`;

    const response = await withRetry(async () => {
      const res = await fetch(url, { headers: getApiHeaders() });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res;
    });

    const data: SPRating[] = await response.json();

    // Guard against aggregate rows without a real season year, and collapse any
    // duplicate rows for the same year to a single point (the endpoint can
    // return more than one record per season, which made the chart zig-zag
    // within a year). Prefer the row that actually carries an overall rating.
    const byYear = new Map<number, SPRating>();
    for (const rating of data) {
      if (typeof rating.year !== 'number') continue;
      const existing = byYear.get(rating.year);
      if (!existing || (existing.rating == null && rating.rating != null)) {
        byYear.set(rating.year, rating);
      }
    }

    return [...byYear.values()].sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error('Error fetching SP+ ratings history:', error);
    throw error;
  }
};
