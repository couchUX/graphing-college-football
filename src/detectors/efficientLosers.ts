import { fetchAllGames, TeamGame } from '../services/api';
import { API_BASE_URL, getApiHeaders } from '../config/api';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];
const TOP_N = 15;

interface AdvancedGameStat {
  gameId: number;
  week: number;
  team: string;
  opponent: string;
  offense?: { successRate?: number; explosiveness?: number; ppa?: number };
  defense?: { successRate?: number; explosiveness?: number; ppa?: number };
}

const fetchSeasonAdvancedStats = async (year: number): Promise<AdvancedGameStat[]> => {
  const url = `${API_BASE_URL}/stats/game/advanced?year=${year}`;
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching advanced stats`);
  return res.json();
};

const isInConference = (conf: string | undefined, filter?: string): boolean => {
  if (!conf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(conf);
  return conf === filter;
};

const passesConferenceFilter = (
  homeConf: string | undefined,
  awayConf: string | undefined,
  filter?: string
): boolean => {
  if (!filter || filter === 'all') return true;
  return isInConference(homeConf, filter) || isInConference(awayConf, filter);
};

interface EfficientLossRow {
  game: TeamGame;
  winner: string;
  loser: string;
  winnerSR: number;
  loserSR: number;
  gapPP: number; // (loserSR - winnerSR) * 100
  winnerScore: number;
  loserScore: number;
}

export const efficientLosersDetector: Detector = {
  id: 'efficient-losers',
  title: 'Most efficient losses',
  description:
    'Games where the LOSING team had a higher offensive success rate than the winning team. Turnovers, special teams, or a few explosive plays swung the scoreboard against the team that moved the ball better.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const [games, advancedStats] = await Promise.all([
      cachedFetch(`all-games:${filters.year}`, () => fetchAllGames(filters.year)),
      cachedFetch(`adv-game-stats:${filters.year}`, () => fetchSeasonAdvancedStats(filters.year)),
    ]);

    // Build (gameId, team) -> stat map.
    const statByGameTeam = new Map<string, AdvancedGameStat>();
    advancedStats.forEach(s => {
      if (s.gameId && s.team) {
        statByGameTeam.set(`${s.gameId}:${s.team}`, s);
      }
    });

    const rows: EfficientLossRow[] = [];

    for (const g of games) {
      if (!g.completed) continue;
      if (g.homeClassification !== 'fbs' || g.awayClassification !== 'fbs') continue;
      if (g.homePoints == null || g.awayPoints == null) continue;
      if (g.homePoints === g.awayPoints) continue; // No "loser" in a tie.
      if (filters.team && g.homeTeam !== filters.team && g.awayTeam !== filters.team) continue;
      if (!passesConferenceFilter(g.homeConference, g.awayConference, filters.conference)) continue;

      const winnerTeam = g.homePoints > g.awayPoints ? g.homeTeam : g.awayTeam;
      const loserTeam = winnerTeam === g.homeTeam ? g.awayTeam : g.homeTeam;
      const winnerScore = winnerTeam === g.homeTeam ? g.homePoints : g.awayPoints;
      const loserScore = winnerTeam === g.homeTeam ? g.awayPoints : g.homePoints;

      const winnerStat = statByGameTeam.get(`${g.id}:${winnerTeam}`);
      const loserStat = statByGameTeam.get(`${g.id}:${loserTeam}`);
      const wSR = winnerStat?.offense?.successRate;
      const lSR = loserStat?.offense?.successRate;
      if (wSR == null || lSR == null) continue;

      const gapPP = (lSR - wSR) * 100;
      if (gapPP <= 0) continue; // We want games where the LOSER had higher SR.

      rows.push({
        game: g,
        winner: winnerTeam,
        loser: loserTeam,
        winnerSR: wSR,
        loserSR: lSR,
        gapPP,
        winnerScore,
        loserScore,
      });
    }

    rows.sort((a, b) => b.gapPP - a.gapPP);
    const top = rows.slice(0, TOP_N);

    if (top.length === 0) {
      return {
        headline: 'No efficient losses found',
        subtext: 'No completed FBS games yet for this season, or the advanced-stats data isn\'t published yet.',
        chart: {
          type: 'bar',
          data: { labels: [], datasets: [] },
          options: { responsive: true, maintainAspectRatio: false },
        },
      };
    }

    // For a horizontal bar chart, labels[0] sits at the top — so reverse so biggest gap is on top.
    const chartRows = top;
    const maxGap = chartRows[0].gapPP;

    const labels = chartRows.map(r => `${r.loser} vs ${r.winner} (W${r.game.week})`);
    const data = chartRows.map(r => Number(r.gapPP.toFixed(1)));
    const bgColors = chartRows.map(r => {
      const c = getDisplayTeamColors(r.loser, 'default');
      return c.success;
    });
    const borderColors = chartRows.map(r => {
      const c = getDisplayTeamColors(r.loser, 'default');
      return c.color || c.success;
    });

    return {
      headline: `${top.length} most efficient losses`,
      subtext: `${filters.year} season • Losing team's offensive SR exceeded the winner's by up to ${maxGap.toFixed(1)} pp`,
      chart: {
        type: 'bar',
        height: Math.max(360, chartRows.length * 32),
        data: {
          labels,
          datasets: [
            {
              label: 'SR gap (loser − winner, pp)',
              data,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 36 } },
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: 'end',
              align: 'end',
              clip: false,
              color: '#374151',
              font: { weight: 'bold', size: 11 },
              formatter: (v: number) => `+${v.toFixed(1)} pp`,
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
            tooltip: {
              callbacks: {
                title: (items: any) => items[0]?.label ?? '',
                label: (item: any) => {
                  const r = chartRows[item.dataIndex];
                  if (!r) return '';
                  return [
                    `Loser SR: ${(r.loserSR * 100).toFixed(1)}% (${r.loser})`,
                    `Winner SR: ${(r.winnerSR * 100).toFixed(1)}% (${r.winner})`,
                    `Final: ${r.loser} ${r.loserScore} — ${r.winner} ${r.winnerScore}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: maxGap * 1.15,
              title: { display: true, text: 'Loser SR advantage (percentage points)' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      },
      rows: top.map(r => ({
        label: `${r.loser} vs ${r.winner} (W${r.game.week})`,
        value: `${r.loser} ${r.loserScore} — ${r.winner} ${r.winnerScore}`,
        hint: `Loser SR ${(r.loserSR * 100).toFixed(1)}% vs Winner ${(r.winnerSR * 100).toFixed(1)}% (+${r.gapPP.toFixed(1)} pp)`,
      })),
    };
  },
};
