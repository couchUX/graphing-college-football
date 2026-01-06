import { useMemo } from 'react';
import { PlayData, PerGameMetric } from '../types';
import { TeamGame } from '../services/api';
import { getDisplayTeamColors, getDisplayTeamColorsForPlayerChart } from '../utils/displayTeamColors';
import { calculateSeasonMetrics, calculatePerGameMetrics, calculateAggregateOpponentMetrics } from '../utils/seasonMetrics';
import { createTeamVsOpponentBarData } from '../utils/chartHelpers';
import { NCAA_AVERAGE_SR } from '../utils/chartConfig';
import { aggregateSeasonPlayerStats } from '../utils/seasonPlayerStats';

export const useSeasonChartData = (
  allSeasonPlays: PlayData[],
  perGamePlays: Map<number, PlayData[]>,
  games: TeamGame[],
  team: string,
  selectedTeamColor: string = 'default'
) => {
  return useMemo(() => {
    if (!allSeasonPlays.length || !games.length) {
      return null;
    }

    // Get team colors (opponents always in gray)
    const teamColors = getDisplayTeamColors(team, selectedTeamColor);
    const teamPlayerColors = getDisplayTeamColorsForPlayerChart(team, selectedTeamColor);
    const grayColors = {
      success: '#D1D5DB',
      explosive: '#9CA3AF',
      light: '#F3F4F6',
      colorDark: '#6B7280'
    };

    // Calculate season metrics
    const seasonMetrics = calculateSeasonMetrics(allSeasonPlays, team);
    const perGameMetrics = calculatePerGameMetrics(perGamePlays, games, team);
    const aggregateOppMetrics = calculateAggregateOpponentMetrics(perGamePlays, games, team);

    // Filter plays by offense
    const teamPlays = allSeasonPlays.filter(p => p.offense === team);
    const opponentPlays = allSeasonPlays.filter(p => p.offense !== team);

    // ===== BAR CHARTS (Season Aggregates) =====

    // Overall Performance
    const overallPerformance = {
      labels: [team, 'All Opponents'],
      datasets: [
        {
          label: 'Explosiveness Rate (XR)',
          data: [seasonMetrics.explosivenessRate, aggregateOppMetrics.explosivenessRate],
          backgroundColor: [teamColors.explosive, grayColors.explosive],
          stack: 'SRXR',
          datalabels: {
            display: false
          }
        },
        {
          label: 'Success Rate (SR)',
          data: [seasonMetrics.successRate, aggregateOppMetrics.successRate],
          backgroundColor: [teamColors.success, grayColors.success],
          stack: 'SRXR',
          datalabels: {
            display: true,
            formatter: (value: number, context: any) => {
              return context.dataIndex === 0 ? seasonMetrics.totalPlays : aggregateOppMetrics.totalPlays;
            }
          }
        },
        // NCAA Average reference line
        {
          type: 'line' as const,
          data: [NCAA_AVERAGE_SR, NCAA_AVERAGE_SR],
          label: 'NCAA Avg SR',
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [3, 3],
          pointRadius: 0,
          datalabels: {
            display: false
          }
        },
        // Fake dataset for "# Plays" legend item
        {
          type: 'line' as const,
          data: [null, null],
          label: '# Plays',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: 0,
          pointRadius: 0,
          datalabels: {
            display: false
          }
        }
      ]
    };

    // Performance by category (reusing existing helper)
    const performanceByDown = createTeamVsOpponentBarData(
      'down',
      teamPlays,
      opponentPlays,
      team,
      'All Opponents',
      teamColors,
      grayColors
    );

    const performanceByQuarter = createTeamVsOpponentBarData(
      'quarter',
      teamPlays,
      opponentPlays,
      team,
      'All Opponents',
      teamColors,
      grayColors
    );

    const performanceByPlayType = createTeamVsOpponentBarData(
      'playType',
      teamPlays,
      opponentPlays,
      team,
      'All Opponents',
      teamColors,
      grayColors
    );

    const performanceByFieldPosition = createTeamVsOpponentBarData(
      'redZone',
      teamPlays,
      opponentPlays,
      team,
      'All Opponents',
      teamColors,
      grayColors
    );

    const performanceByDistance = createTeamVsOpponentBarData(
      'distance',
      teamPlays,
      opponentPlays,
      team,
      'All Opponents',
      teamColors,
      grayColors
    );

    // ===== LINE CHARTS (Per-Game Trends) =====

    // Format game labels
    const labels = perGameMetrics.map(g => {
      const prefix = g.isHome ? 'vs' : '@';
      const suffix = g.seasonType === 'postseason' ? '*' : '';
      return `${prefix} ${g.opponent}${suffix}`;
    });

    // SR & XR by Game
    const srxrByGame = {
      labels,
      datasets: [
        // NCAA Average reference area (must be first to appear behind other data)
        {
          type: 'line' as const,
          label: 'NCAA Avg SR',
          data: Array(perGameMetrics.length).fill(NCAA_AVERAGE_SR * 100),
          backgroundColor: 'rgba(0,0,0,0.03)',
          borderColor: 'transparent',
          pointRadius: 0,
          fill: 'origin',
          tension: 0,
          datalabels: {
            display: false
          },
          order: 10
        },
        {
          label: `${team} SR`,
          data: perGameMetrics.map(g => g.teamSR * 100),
          borderColor: teamColors.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: teamColors.success,
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 1
        },
        {
          label: `${team} XR`,
          data: perGameMetrics.map(g => g.teamXR * 100),
          borderColor: teamColors.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [5, 3],
          pointRadius: 4,
          pointBackgroundColor: teamColors.explosive,
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 2
        },
        {
          label: 'Opp SR',
          data: perGameMetrics.map(g => g.oppSR * 100),
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 3
        },
        {
          label: 'Opp XR',
          data: perGameMetrics.map(g => g.oppXR * 100),
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 3],
          pointRadius: 3,
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 4
        }
      ]
    };

    // Rush Rate by Game (percentage of plays that are rushes)
    const rushRateByGame = {
      labels,
      datasets: [
        // 50% reference line (must be first to appear behind other data)
        {
          type: 'line' as const,
          label: '50% Line',
          data: Array(perGameMetrics.length).fill(50),
          borderColor: 'rgba(0,0,0,0.15)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0,
          datalabels: {
            display: false
          },
          order: 10
        },
        {
          label: `${team} Rush Rate`,
          data: perGameMetrics.map(g => {
            const gameTeamPlays = (perGamePlays.get(g.gameId) || []).filter(p => p.offense === team);
            const rushPlays = gameTeamPlays.filter(p =>
              p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run')
            );
            return gameTeamPlays.length > 0 ? (rushPlays.length / gameTeamPlays.length) * 100 : 0;
          }),
          borderColor: teamColors.success,
          backgroundColor: teamColors.light,
          borderWidth: 2.5,
          pointRadius: 4,
          fill: true,
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 1
        },
        {
          label: 'Opp Rush Rate',
          data: perGameMetrics.map(g => {
            const gameOppPlays = (perGamePlays.get(g.gameId) || []).filter(p => p.offense !== team);
            const rushPlays = gameOppPlays.filter(p =>
              p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run')
            );
            return gameOppPlays.length > 0 ? (rushPlays.length / gameOppPlays.length) * 100 : 0;
          }),
          borderColor: '#9CA3AF',
          backgroundColor: 'rgba(243, 244, 246, 0.65)',
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 2
        }
      ]
    };

    // Rush vs Pass SR by Game
    const rushPassByGame = {
      labels,
      datasets: [
        // NCAA Average reference area (must be first to appear behind other data)
        {
          type: 'line' as const,
          label: 'NCAA Avg SR',
          data: Array(perGameMetrics.length).fill(NCAA_AVERAGE_SR * 100),
          backgroundColor: 'rgba(0,0,0,0.03)',
          borderColor: 'transparent',
          pointRadius: 0,
          fill: 'origin',
          tension: 0,
          datalabels: {
            display: false
          },
          order: 10
        },
        {
          label: `${team} Rush SR`,
          data: perGameMetrics.map(g => {
            const gameTeamPlays = (perGamePlays.get(g.gameId) || []).filter(p => p.offense === team);
            const rushPlays = gameTeamPlays.filter(p =>
              p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run')
            );
            const rushSuccessful = rushPlays.filter(p => p.success).length;
            return rushPlays.length > 0 ? (rushSuccessful / rushPlays.length) * 100 : 0;
          }),
          borderColor: teamColors.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointStyle: 'circle',
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 1
        },
        {
          label: `${team} Pass SR`,
          data: perGameMetrics.map(g => {
            const gameTeamPlays = (perGamePlays.get(g.gameId) || []).filter(p => p.offense === team);
            const passPlays = gameTeamPlays.filter(p =>
              p.playType?.toLowerCase().includes('pass') ||
              p.playType?.toLowerCase().includes('sack') ||
              p.playType?.toLowerCase().includes('interception')
            );
            const passSuccessful = passPlays.filter(p => p.success).length;
            return passPlays.length > 0 ? (passSuccessful / passPlays.length) * 100 : 0;
          }),
          borderColor: teamColors.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [4, 4],
          pointRadius: 5,
          pointStyle: 'triangle',
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 2
        },
        {
          label: 'Opp Rush SR',
          data: perGameMetrics.map(g => {
            const gameOppPlays = (perGamePlays.get(g.gameId) || []).filter(p => p.offense !== team);
            const rushPlays = gameOppPlays.filter(p =>
              p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run')
            );
            const rushSuccessful = rushPlays.filter(p => p.success).length;
            return rushPlays.length > 0 ? (rushSuccessful / rushPlays.length) * 100 : 0;
          }),
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointStyle: 'circle',
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 3
        },
        {
          label: 'Opp Pass SR',
          data: perGameMetrics.map(g => {
            const gameOppPlays = (perGamePlays.get(g.gameId) || []).filter(p => p.offense !== team);
            const passPlays = gameOppPlays.filter(p =>
              p.playType?.toLowerCase().includes('pass') ||
              p.playType?.toLowerCase().includes('sack') ||
              p.playType?.toLowerCase().includes('interception')
            );
            const passSuccessful = passPlays.filter(p => p.success).length;
            return passPlays.length > 0 ? (passSuccessful / passPlays.length) * 100 : 0;
          }),
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 4,
          pointStyle: 'triangle',
          tension: 0.15,
          datalabels: {
            display: false
          },
          order: 4
        }
      ]
    };

    // ===== PLAYER CHARTS (Season Aggregates) =====

    const playerStats = aggregateSeasonPlayerStats(allSeasonPlays, team);

    // Add team colors to each player
    const topRushers = playerStats.topRushers.map(p => ({
      ...p,
      team,
      teamColors: teamPlayerColors
    }));

    const topPassers = playerStats.topPassers.map(p => ({
      ...p,
      team,
      teamColors: teamPlayerColors
    }));

    const topReceivers = playerStats.topReceivers.map(p => ({
      ...p,
      team,
      teamColors: teamPlayerColors
    }));

    return {
      seasonMetrics,
      aggregateOppMetrics,
      perGameMetrics,
      overallPerformance,
      performanceByDown,
      performanceByQuarter,
      performanceByPlayType,
      performanceByFieldPosition,
      performanceByDistance,
      srxrByGame,
      rushRateByGame,
      rushPassByGame,
      topRushers,
      topPassers,
      topReceivers
    };
  }, [allSeasonPlays, perGamePlays, games, team, selectedTeamColor]);
};
