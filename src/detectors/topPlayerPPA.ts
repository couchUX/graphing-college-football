import { API_BASE_URL, getApiHeaders } from '../config/api';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];
const TOP_N = 15;

interface PlayerPPA {
  season: number;
  id?: string;
  name: string;
  position?: string;
  team: string;
  conference?: string;
  countablePlays?: number;
  averagePPA?: { all?: number };
  totalPPA?: { all?: number };
}

const fetchPlayerPPA = async (year: number): Promise<PlayerPPA[]> => {
  // CFBD requires either a team OR an excludeGarbageTime/threshold param; year alone works.
  const url = `${API_BASE_URL}/ppa/players/season?year=${year}`;
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching player PPA`);
  return res.json();
};

const isInConference = (conf: string | undefined, filter?: string): boolean => {
  if (!conf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(conf);
  return conf === filter;
};

export const topPlayerPPADetector: Detector = {
  id: 'top-player-ppa',
  title: 'Top players by total PPA',
  description:
    'Individual players ranked by total Predicted Points Added across the season. Counts every play the player was involved in — passing, rushing, and receiving — weighted by impact on scoring expectation.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const all = await cachedFetch(`player-ppa:${filters.year}`, () =>
      fetchPlayerPPA(filters.year)
    );

    interface Row {
      name: string;
      team: string;
      conference: string;
      position: string;
      total: number;
      avg: number;
      plays: number;
    }

    const rows: Row[] = [];
    for (const p of all) {
      if (!p.name || !p.team) continue;
      if (!isInConference(p.conference, filters.conference)) continue;
      if (filters.team && p.team !== filters.team) continue;
      const total = p.totalPPA?.all;
      if (total == null) continue;
      rows.push({
        name: p.name,
        team: p.team,
        conference: p.conference || '',
        position: p.position || '',
        total,
        avg: p.averagePPA?.all ?? 0,
        plays: p.countablePlays ?? 0,
      });
    }

    rows.sort((a, b) => b.total - a.total);
    const top = rows.slice(0, TOP_N);

    if (top.length === 0) {
      return {
        headline: 'No player PPA data',
        subtext: 'Player PPA hasn\'t been published for this season yet.',
        chart: { type: 'bar', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } },
      };
    }

    const labels = top.map(r => `${r.name} (${r.position || '—'}, ${r.team})`);
    const data = top.map(r => Number(r.total.toFixed(1)));
    const bg = top.map(r => getDisplayTeamColors(r.team, 'default').success);
    const border = top.map(r => {
      const c = getDisplayTeamColors(r.team, 'default');
      return c.color || c.success;
    });
    const maxVal = data[0];

    return {
      headline: `${top.length} top players by total PPA`,
      subtext: `${filters.year} season • Sum of every play's Predicted Points Added value. Volume + efficiency combined — a QB with lots of snaps and good per-play value lands high here.`,
      chart: {
        type: 'bar',
        height: Math.max(360, top.length * 32),
        data: {
          labels,
          datasets: [
            {
              label: 'Total PPA',
              data,
              backgroundColor: bg,
              borderColor: border,
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 48 } },
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: 'end',
              align: 'end',
              clip: false,
              color: '#374151',
              font: { weight: 'bold', size: 11 },
              formatter: (v: number) => v.toFixed(0),
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
            tooltip: {
              callbacks: {
                title: (items: any) => items[0]?.label ?? '',
                label: (item: any) => {
                  const r = top[item.dataIndex];
                  if (!r) return '';
                  return [
                    `Total PPA: ${r.total.toFixed(1)}`,
                    `Avg PPA/play: ${r.avg.toFixed(3)}`,
                    `Countable plays: ${r.plays}`,
                    `Team: ${r.team} (${r.conference})`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: maxVal * 1.1,
              title: { display: true, text: 'Total Predicted Points Added (season)' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } },
          },
        },
      },
      rows: top.map(r => ({
        label: `${r.name} · ${r.position || '—'} · ${r.team}`,
        value: `${r.total.toFixed(1)} total PPA`,
        hint: `${r.plays} plays · ${r.avg.toFixed(3)} per play`,
      })),
    };
  },
};
