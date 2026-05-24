import { fetchAllGames, TeamGame } from '../services/api';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];
const TOP_N = 15;

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

const matchupLabel = (g: TeamGame): string => {
  const sep = g.neutralSite ? 'vs' : '@';
  return `${g.awayTeam} ${sep} ${g.homeTeam} (W${g.week})`;
};

const finalScoreText = (g: TeamGame): string =>
  `${g.awayTeam} ${g.awayPoints} — ${g.homeTeam} ${g.homePoints}`;

export const topExcitementDetector: Detector = {
  id: 'top-excitement',
  title: 'Most exciting games',
  description:
    'Games ranked by ESPN-style excitement index — a measure of how much win probability swung during the game.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const games = await cachedFetch(`all-games:${filters.year}`, () => fetchAllGames(filters.year));

    const filtered = games.filter(g =>
      g.completed &&
      g.homeClassification === 'fbs' &&
      g.awayClassification === 'fbs' &&
      g.excitementIndex != null &&
      (!filters.team || g.homeTeam === filters.team || g.awayTeam === filters.team) &&
      passesConferenceFilter(g.homeConference, g.awayConference, filters.conference)
    );

    filtered.sort((a, b) => (b.excitementIndex ?? 0) - (a.excitementIndex ?? 0));
    const top = filtered.slice(0, TOP_N);

    if (top.length === 0) {
      return {
        headline: 'No excitement-index data yet',
        subtext: 'The selected season has no completed games with excitement-index values.',
        chart: { type: 'bar', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } },
      };
    }

    const maxEi = top[0].excitementIndex ?? 0;
    const labels = top.map(matchupLabel);
    const data = top.map(g => Number((g.excitementIndex ?? 0).toFixed(2)));
    const winnerOf = (g: TeamGame): string =>
      g.homePoints > g.awayPoints ? g.homeTeam : g.awayTeam;
    const bgColors = top.map(g => getDisplayTeamColors(winnerOf(g), 'default').success);
    const borderColors = top.map(g => {
      const c = getDisplayTeamColors(winnerOf(g), 'default');
      return c.color || c.success;
    });

    return {
      headline: `${top.length} most exciting games`,
      subtext: `${filters.year} season • Highest excitement-index swings`,
      chart: {
        type: 'bar',
        height: Math.max(360, top.length * 32),
        data: {
          labels,
          datasets: [
            {
              label: 'Excitement index',
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
          layout: { padding: { right: 40 } },
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: 'end',
              align: 'end',
              clip: false,
              color: '#374151',
              font: { weight: 'bold', size: 11 },
              formatter: (v: number) => v.toFixed(2),
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
            tooltip: {
              callbacks: {
                title: (items: any) => items[0]?.label ?? '',
                label: (item: any) => {
                  const g = top[item.dataIndex];
                  if (!g) return '';
                  return [
                    `Excitement index: ${(g.excitementIndex ?? 0).toFixed(2)}`,
                    `Final: ${finalScoreText(g)}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: maxEi * 1.1,
              title: { display: true, text: 'Excitement index' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      },
      rows: top.map(g => ({
        label: matchupLabel(g),
        value: finalScoreText(g),
        hint: `Excitement ${(g.excitementIndex ?? 0).toFixed(2)}`,
      })),
    };
  },
};
