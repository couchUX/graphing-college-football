import { API_BASE_URL, getApiHeaders } from '../config/api';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];
const TOP_N = 15;

interface TeamPPA {
  season: number;
  team: string;
  conference?: string;
  offense?: { overall?: number; passing?: number; rushing?: number };
  defense?: { overall?: number; passing?: number; rushing?: number };
}

const fetchTeamPPA = async (year: number): Promise<TeamPPA[]> => {
  const url = `${API_BASE_URL}/ppa/teams?year=${year}`;
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching team PPA`);
  return res.json();
};

const isInConference = (conf: string | undefined, filter?: string): boolean => {
  if (!conf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(conf);
  return conf === filter;
};

export const teamPPADetector: Detector = {
  id: 'team-ppa-leaderboard',
  title: 'PPA leaders (net efficiency)',
  description:
    'Top teams by net PPA per play — offensive PPA minus defensive PPA allowed. The modern, opponent-aware version of point differential.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const all = await cachedFetch(`team-ppa:${filters.year}`, () => fetchTeamPPA(filters.year));

    interface Row {
      team: string;
      conference: string;
      offense: number;
      defense: number;
      net: number;
    }

    const rows: Row[] = [];
    all.forEach(t => {
      if (!t.team) return;
      if (!isInConference(t.conference, filters.conference)) return;
      if (filters.team && t.team !== filters.team) return;
      const off = t.offense?.overall;
      const def = t.defense?.overall;
      if (off == null || def == null) return;
      rows.push({
        team: t.team,
        conference: t.conference || '',
        offense: off,
        defense: def,
        net: off - def,
      });
    });

    rows.sort((a, b) => b.net - a.net);
    const top = rows.slice(0, TOP_N);

    if (top.length === 0) {
      return {
        headline: 'No PPA data available',
        subtext: 'PPA data isn\'t published yet for this season.',
        chart: { type: 'bar', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } },
      };
    }

    const labels = top.map(r => r.team);
    const data = top.map(r => Number(r.net.toFixed(3)));
    const bg = top.map(r => getDisplayTeamColors(r.team, 'default').success);
    const border = top.map(r => {
      const c = getDisplayTeamColors(r.team, 'default');
      return c.color || c.success;
    });

    const maxVal = data[0];
    const minVal = data[data.length - 1];

    return {
      headline: `${top.length} net PPA leaders`,
      subtext: `${filters.year} season • Offensive PPA minus defensive PPA per play`,
      chart: {
        type: 'bar',
        height: Math.max(360, top.length * 32),
        data: {
          labels,
          datasets: [
            {
              label: 'Net PPA per play',
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
              formatter: (v: number) => v.toFixed(2),
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
                    `Net: ${r.net.toFixed(3)}`,
                    `Off: ${r.offense.toFixed(3)}`,
                    `Def: ${r.defense.toFixed(3)} (lower = better)`,
                    `Conference: ${r.conference}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              suggestedMin: Math.min(0, minVal * 1.1),
              suggestedMax: maxVal * 1.15,
              title: { display: true, text: 'Net PPA per play (offense − defense)' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      },
      rows: top.map(r => ({
        label: `${r.team} (${r.conference})`,
        value: `Net ${r.net.toFixed(3)}`,
        hint: `Off ${r.offense.toFixed(3)} · Def ${r.defense.toFixed(3)}`,
      })),
    };
  },
};
