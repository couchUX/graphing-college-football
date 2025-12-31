import { PlayData, SeasonMetrics, PerGameMetric } from '../types';
import { TeamGame } from '../services/api';

/**
 * Calculate aggregate season-wide metrics for a team
 */
export const calculateSeasonMetrics = (plays: PlayData[], team: string): SeasonMetrics => {
  const teamPlays = plays.filter(p => p.offense === team);
  const successfulPlays = teamPlays.filter(p => p.success).length;
  const explosivePlays = teamPlays.filter(p => p.explosiveness).length;
  const totalYards = teamPlays.reduce((sum, p) => sum + p.yardsGained, 0);

  return {
    totalPlays: teamPlays.length,
    successRate: teamPlays.length > 0 ? successfulPlays / teamPlays.length : 0,
    explosivenessRate: teamPlays.length > 0 ? explosivePlays / teamPlays.length : 0,
    avgYardsPerPlay: teamPlays.length > 0 ? totalYards / teamPlays.length : 0
  };
};

/**
 * Calculate per-game metrics for line charts
 */
export const calculatePerGameMetrics = (
  perGamePlays: Map<number, PlayData[]>,
  games: TeamGame[],
  team: string
): PerGameMetric[] => {
  return games.map(game => {
    const gamePlays = perGamePlays.get(game.id) || [];
    const teamPlays = gamePlays.filter(p => p.offense === team);
    const opponentPlays = gamePlays.filter(p => p.offense !== team);

    const teamSuccessful = teamPlays.filter(p => p.success).length;
    const teamExplosive = teamPlays.filter(p => p.explosiveness).length;
    const oppSuccessful = opponentPlays.filter(p => p.success).length;
    const oppExplosive = opponentPlays.filter(p => p.explosiveness).length;

    const opponent = game.homeTeam === team ? game.awayTeam : game.homeTeam;
    const isHome = game.homeTeam === team;

    return {
      gameId: game.id,
      week: game.week,
      seasonType: game.seasonType,
      opponent,
      isHome,
      teamSR: teamPlays.length > 0 ? teamSuccessful / teamPlays.length : 0,
      teamXR: teamPlays.length > 0 ? teamExplosive / teamPlays.length : 0,
      oppSR: opponentPlays.length > 0 ? oppSuccessful / opponentPlays.length : 0,
      oppXR: opponentPlays.length > 0 ? oppExplosive / opponentPlays.length : 0,
      teamPlays: teamPlays.length,
      oppPlays: opponentPlays.length,
      teamScore: isHome ? game.homePoints : game.awayPoints,
      oppScore: isHome ? game.awayPoints : game.homePoints
    };
  });
};

/**
 * Calculate aggregate opponent metrics (all opponents combined)
 */
export const calculateAggregateOpponentMetrics = (
  perGamePlays: Map<number, PlayData[]>,
  games: TeamGame[],
  team: string
): SeasonMetrics => {
  const allOpponentPlays: PlayData[] = [];

  games.forEach(game => {
    const gamePlays = perGamePlays.get(game.id) || [];
    const opponentPlays = gamePlays.filter(p => p.offense !== team);
    allOpponentPlays.push(...opponentPlays);
  });

  const successfulPlays = allOpponentPlays.filter(p => p.success).length;
  const explosivePlays = allOpponentPlays.filter(p => p.explosiveness).length;
  const totalYards = allOpponentPlays.reduce((sum, p) => sum + p.yardsGained, 0);

  return {
    totalPlays: allOpponentPlays.length,
    successRate: allOpponentPlays.length > 0 ? successfulPlays / allOpponentPlays.length : 0,
    explosivenessRate: allOpponentPlays.length > 0 ? explosivePlays / allOpponentPlays.length : 0,
    avgYardsPerPlay: allOpponentPlays.length > 0 ? totalYards / allOpponentPlays.length : 0
  };
};
