import { useMemo } from 'react';
import { PlayData } from '../types';
import { TeamGame } from '../services/api';
import {
  getDisplayTeamColors,
  getDisplayTeamColorsForPlayerChart,
} from '../utils/displayTeamColors';
import { calculateSeasonMetrics, calculatePerGameMetrics } from '../utils/seasonMetrics';
import { createTeamVsOpponentBarData } from '../utils/chartHelpers';
import { NCAA_AVERAGE_SR } from '../utils/chartConfig';
import { aggregateSeasonPlayerStats } from '../utils/seasonPlayerStats';

// One side of a Team vs. Team comparison: the processed season for a single team.
export interface CompareSide {
  team: string;
  games: TeamGame[];
  allPlays: PlayData[];
  perGamePlays: Map<number, PlayData[]>;
}

const isRushPlay = (p: PlayData) =>
  !!p.playType &&
  (p.playType.toLowerCase().includes('rush') || p.playType.toLowerCase().includes('run'));

const isPassPlay = (p: PlayData) =>
  !!p.playType &&
  (p.playType.toLowerCase().includes('pass') ||
    p.playType.toLowerCase().includes('sack') ||
    p.playType.toLowerCase().includes('interception'));

// Per-game offensive splits for one team, ordered by that team's games.
const perGameSplits = (side: CompareSide) =>
  side.games.map((game) => {
    const teamPlays = (side.perGamePlays.get(game.id) || []).filter((p) => p.offense === side.team);
    const rush = teamPlays.filter(isRushPlay);
    const pass = teamPlays.filter(isPassPlay);
    const pct = (n: number, d: number): number | null => (d > 0 ? (n / d) * 100 : null);
    return {
      rushRate: pct(rush.length, teamPlays.length),
      rushSR: pct(rush.filter((p) => p.success).length, rush.length),
      passSR: pct(pass.filter((p) => p.success).length, pass.length),
    };
  });

/**
 * Builds the same chart-data shape as useSeasonChartData, but comparing two
 * specific teams (A vs B) instead of a team vs. its average opponent. The 8
 * aggregate/per-game charts feed straight into TrendsChartsGrid; per-game line
 * charts use generic "Game N" labels since the two teams don't share a schedule.
 */
export const useCompareChartData = (
  a: CompareSide | null,
  b: CompareSide | null,
  colorA: string,
  colorB: string,
) => {
  return useMemo(() => {
    if (!a || !b || !a.allPlays.length || !b.allPlays.length) return null;

    const colorsA = getDisplayTeamColors(a.team, colorA);
    const colorsB = getDisplayTeamColors(b.team, colorB);
    const playerColorsA = getDisplayTeamColorsForPlayerChart(a.team, colorA);
    const playerColorsB = getDisplayTeamColorsForPlayerChart(b.team, colorB);

    const metricsA = calculateSeasonMetrics(a.allPlays, a.team);
    const metricsB = calculateSeasonMetrics(b.allPlays, b.team);
    const perGameA = calculatePerGameMetrics(a.perGamePlays, a.games, a.team);
    const perGameB = calculatePerGameMetrics(b.perGamePlays, b.games, b.team);

    const aPlays = a.allPlays.filter((p) => p.offense === a.team);
    const bPlays = b.allPlays.filter((p) => p.offense === b.team);

    // ===== Bar charts (season aggregates) =====
    const overallPerformance = {
      labels: [a.team, b.team],
      datasets: [
        {
          label: 'Explosiveness Rate (XR)',
          data: [metricsA.explosivenessRate, metricsB.explosivenessRate],
          backgroundColor: [colorsA.explosive, colorsB.explosive],
          stack: 'SRXR',
          datalabels: { display: false },
        },
        {
          label: 'Success Rate (SR)',
          data: [metricsA.successRate, metricsB.successRate],
          backgroundColor: [colorsA.success, colorsB.success],
          stack: 'SRXR',
          datalabels: {
            display: true,
            formatter: (_value: number, context: any) =>
              context.dataIndex === 0 ? metricsA.totalPlays : metricsB.totalPlays,
          },
        },
        {
          type: 'line' as const,
          data: [NCAA_AVERAGE_SR, NCAA_AVERAGE_SR],
          label: 'NCAA Avg SR',
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [3, 3],
          pointRadius: 0,
          datalabels: { display: false },
        },
        {
          type: 'line' as const,
          data: [null, null],
          label: '# Plays',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: 0,
          pointRadius: 0,
          datalabels: { display: false },
        },
      ],
    };

    const bar = (category: 'quarter' | 'down' | 'playType' | 'redZone' | 'distance') =>
      createTeamVsOpponentBarData(category, aPlays, bPlays, a.team, b.team, colorsA, colorsB);

    const performanceByDown = bar('down');
    const performanceByQuarter = bar('quarter');
    const performanceByPlayType = bar('playType');
    const performanceByFieldPosition = bar('redZone');
    const performanceByDistance = bar('distance');

    // ===== Line charts (per-game trends, generic "Game N" labels) =====
    const maxGames = Math.max(perGameA.length, perGameB.length);
    const labels = Array.from({ length: maxGames }, (_, i) => `Game ${i + 1}`);
    const splitsA = perGameSplits(a);
    const splitsB = perGameSplits(b);

    // One game per team: a single point per series reads better as grouped
    // columns (Team A vs Team B per metric) than as one-dot lines.
    const singleGame = maxGames <= 1;
    const barCompare = (
      catLabels: string[],
      aVals: (number | null)[],
      bVals: (number | null)[],
    ) => ({
      labels: catLabels,
      datasets: [
        { label: a.team, data: aVals, backgroundColor: colorsA.success, datalabels: { display: false } },
        { label: b.team, data: bVals, backgroundColor: colorsB.success, datalabels: { display: false } },
      ],
    });

    const srSeries = (perGame: typeof perGameA, key: 'teamSR' | 'teamXR') =>
      labels.map((_, i) => (i < perGame.length ? perGame[i][key] * 100 : null));
    const splitSeries = (splits: ReturnType<typeof perGameSplits>, key: 'rushRate' | 'rushSR' | 'passSR') =>
      labels.map((_, i) => (i < splits.length ? splits[i][key] : null));

    // Fresh instance per chart — Chart.js can attach internal state to dataset
    // objects, so the NCAA reference area must not be shared across charts.
    const ncaaArea = () => ({
      type: 'line' as const,
      label: 'NCAA Avg SR',
      data: Array(maxGames).fill(NCAA_AVERAGE_SR * 100),
      backgroundColor: 'rgba(0,0,0,0.03)',
      borderColor: 'transparent',
      pointRadius: 0,
      fill: 'origin' as const,
      tension: 0,
      datalabels: { display: false },
      order: 10,
    });

    const srxrByGame = singleGame
      ? barCompare(
          ['Success rate', 'Explosiveness'],
          [perGameA[0].teamSR * 100, perGameA[0].teamXR * 100],
          [perGameB[0].teamSR * 100, perGameB[0].teamXR * 100],
        )
      : {
      labels,
      datasets: [
        ncaaArea(),
        {
          label: `${a.team} SR`,
          data: srSeries(perGameA, 'teamSR'),
          borderColor: colorsA.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: colorsA.success,
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 1,
        },
        {
          label: `${a.team} XR`,
          data: srSeries(perGameA, 'teamXR'),
          borderColor: colorsA.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [5, 3],
          pointRadius: 4,
          pointBackgroundColor: colorsA.explosive,
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 2,
        },
        {
          label: `${b.team} SR`,
          data: srSeries(perGameB, 'teamSR'),
          borderColor: colorsB.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: colorsB.success,
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 3,
        },
        {
          label: `${b.team} XR`,
          data: srSeries(perGameB, 'teamXR'),
          borderColor: colorsB.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [5, 3],
          pointRadius: 4,
          pointBackgroundColor: colorsB.explosive,
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 4,
        },
      ],
    };

    const rushRateByGame = singleGame
      ? barCompare(['Rush rate'], [splitsA[0].rushRate], [splitsB[0].rushRate])
      : {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: '50% Line',
          data: Array(maxGames).fill(50),
          borderColor: 'rgba(0,0,0,0.15)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0,
          datalabels: { display: false },
          order: 10,
        },
        {
          label: `${a.team} Rush Rate`,
          data: splitSeries(splitsA, 'rushRate'),
          borderColor: colorsA.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 1,
        },
        {
          label: `${b.team} Rush Rate`,
          data: splitSeries(splitsB, 'rushRate'),
          borderColor: colorsB.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 2,
        },
      ],
    };

    const rushPassByGame = singleGame
      ? barCompare(
          ['Rush SR', 'Pass SR'],
          [splitsA[0].rushSR, splitsA[0].passSR],
          [splitsB[0].rushSR, splitsB[0].passSR],
        )
      : {
      labels,
      datasets: [
        ncaaArea(),
        {
          label: `${a.team} Rush SR`,
          data: splitSeries(splitsA, 'rushSR'),
          borderColor: colorsA.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointStyle: 'circle',
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 1,
        },
        {
          label: `${a.team} Pass SR`,
          data: splitSeries(splitsA, 'passSR'),
          borderColor: colorsA.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [4, 4],
          pointRadius: 5,
          pointStyle: 'triangle',
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 2,
        },
        {
          label: `${b.team} Rush SR`,
          data: splitSeries(splitsB, 'rushSR'),
          borderColor: colorsB.success,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointStyle: 'circle',
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 3,
        },
        {
          label: `${b.team} Pass SR`,
          data: splitSeries(splitsB, 'passSR'),
          borderColor: colorsB.explosive,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [4, 4],
          pointRadius: 5,
          pointStyle: 'triangle',
          spanGaps: false,
          tension: 0.15,
          datalabels: { display: false },
          order: 4,
        },
      ],
    };

    // ===== Player charts (both teams, tagged for per-team filtering) =====
    const statsA = aggregateSeasonPlayerStats(a.allPlays, a.team);
    const statsB = aggregateSeasonPlayerStats(b.allPlays, b.team);
    const tag = (players: any[], team: string, teamColors: any) =>
      players.map((p) => ({ ...p, team, teamColors }));

    const allRushers = [
      ...tag(statsA.topRushers, a.team, playerColorsA),
      ...tag(statsB.topRushers, b.team, playerColorsB),
    ];
    const allPassers = [
      ...tag(statsA.topPassers, a.team, playerColorsA),
      ...tag(statsB.topPassers, b.team, playerColorsB),
    ];
    const allReceivers = [
      ...tag(statsA.topReceivers, a.team, playerColorsA),
      ...tag(statsB.topReceivers, b.team, playerColorsB),
    ];

    return {
      teamA: a.team,
      teamB: b.team,
      perGameChartType: (singleGame ? 'bar' : 'line') as 'bar' | 'line',
      colorsA,
      colorsB,
      metricsA,
      metricsB,
      perGameA,
      perGameB,
      overallPerformance,
      performanceByDown,
      performanceByQuarter,
      performanceByPlayType,
      performanceByFieldPosition,
      performanceByDistance,
      srxrByGame,
      rushRateByGame,
      rushPassByGame,
      allRushers,
      allPassers,
      allReceivers,
    };
  }, [a, b, colorA, colorB]);
};
