interface GameData {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface PlayData {
  id: string; // Changed from number to string to handle large IDs properly
  driveId: number;
  gameId: number;
  driveNumber: number;
  playNumber: number; // Our processed play number (1, 2, 3... for rush/pass only)
  playInDrive: number; // Original API play number within the drive
  offense: string;
  defense: string;
  offenseConference: string;
  defenseConference: string;
  down: number;
  distance: number;
  yardsToGoal: number;
  yardsGained: number;
  playType: string;
  playText: string;
  ppa: number;
  success: boolean;
  explosiveness: boolean;
  extraYards: number;
  quarter: number;
  clock: {
    minutes: number;
    seconds: number;
  };
  wallclock: string;
  timeRemaining: number;
  // Player name fields
  rusher?: string;
  passer?: string;
  receiver?: string;
  // Cumulative calculated fields
  teamPlayNumber: number;
  teamCumulativeSR: number;
  teamCumulativeXR: number;
  teamCumulativeRushRate: number;
  teamRushCumulativeSR: number;
  teamPassCumulativeSR: number;
}

export interface ProcessedMetrics {
  successRate: number;
  explosivenessRate: number;
  totalPlays: number;
  avgYardsPerPlay: number;
}

interface TeamMetrics {
  [teamName: string]: ProcessedMetrics;
}

export interface DriveMetrics {
  driveNumber: number;
  playCount: number;
  successRate: number;
  explosivenessRate: number;
  totalYards: number;
}

export interface PlayerStats {
  name: string;
  explosive: number;
  successful: number;
  unsuccessful: number;
  uns_catches?: number; // For receivers: catches that weren't successful
  int?: number; // For passers: interceptions
  total: number;
}

// Season-level types for Team Trends page
export interface SeasonMetrics {
  totalPlays: number;
  successRate: number;
  explosivenessRate: number;
  avgYardsPerPlay: number;
}

export interface PerGameMetric {
  gameId: number;
  week: number;
  seasonType: string;
  opponent: string;
  isHome: boolean;
  teamSR: number;
  teamXR: number;
  oppSR: number;
  oppXR: number;
  teamPlays: number;
  oppPlays: number;
  teamScore: number;
  oppScore: number;
}

export interface SeasonDataFetchResult {
  games: import('../services/api').TeamGame[];
  allPlays: import('../services/api').ApiPlayData[];
  perGamePlays: Map<number, import('../services/api').ApiPlayData[]>;
  failedGames: number[];
}