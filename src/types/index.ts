export interface GameData {
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

export interface TeamMetrics {
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