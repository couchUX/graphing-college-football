import { API_BASE_URL, getApiHeaders } from '../config/api';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];
const TOP_N = 15;

interface ReturningProduction {
  season: number;
  team: string;
  conference?: string;
  totalPPA?: number;
  totalPassingPPA?: number;
  totalReceivingPPA?: number;
  totalRushingPPA?: number;
  percentPPA?: number;            // overall returning percentage
  percentPassingPPA?: number;
  percentReceivingPPA?: number;
  percentRushingPPA?: number;
  usage?: number;
  passingUsage?: number;
  receivingUsage?: number;
  rushingUsage?: number;
}

const fetchReturning = async (year: number): Promise<ReturningProduction[]> => {
  const url = `${API_BASE_URL}/player/returning?year=${year}`;
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching returning production`);
  return res.json();
};

const isInConference = (conf: string | undefined, filter?: string): boolean => {
  if (!conf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(conf);
  return conf === filter;
};

export const returningProductionDetector: Detector = {
  id: 'returning-production',
  title: 'Returning production leaders',
  description:
    'Teams returning the highest share of last year\'s production-weighted PPA. These are the rosters with the most continuity — typically the offseason favorites to take a leap.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const all = await cachedFetch(`returning:${filters.year}`, () => fetchReturning(filters.year));

    const filtered = all
      .filter(r => r.team && r.percentPPA != null && isInConference(r.conference, filters.conference))
      .filter(r => !filters.team || r.team === filters.team);

    filtered.sort((a, b) => (b.percentPPA ?? 0) - (a.percentPPA ?? 0));
    const top = filtered.slice(0, TOP_N);

    if (top.length === 0) {
      return {
        headline: 'No returning production data',
        subtext: 'The selected season has no returning-production records yet.',
        chart: { type: 'bar', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } },
      };
    }

    const labels = top.map(t => t.team);
    const data = top.map(t => Number(((t.percentPPA ?? 0) * 100).toFixed(1)));
    const bg = top.map(t => getDisplayTeamColors(t.team, 'default').success);
    const border = top.map(t => {
      const c = getDisplayTeamColors(t.team, 'default');
      return c.color || c.success;
    });
    const maxVal = data[0];

    return {
      headline: `${top.length} returning-production leaders`,
      subtext: `${filters.year} returning rosters • % of prior season's PPA back on the team`,
      chart: {
        type: 'bar',
        height: Math.max(360, top.length * 32),
        data: {
          labels,
          datasets: [
            {
              label: 'Returning PPA %',
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
          layout: { padding: { right: 40 } },
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: 'end',
              align: 'end',
              clip: false,
              color: '#374151',
              font: { weight: 'bold', size: 11 },
              formatter: (v: number) => `${v.toFixed(0)}%`,
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
            tooltip: {
              callbacks: {
                title: (items: any) => items[0]?.label ?? '',
                label: (item: any) => {
                  const t = top[item.dataIndex];
                  if (!t) return '';
                  const lines = [`Overall: ${((t.percentPPA ?? 0) * 100).toFixed(1)}%`];
                  if (t.percentPassingPPA != null)
                    lines.push(`Passing: ${(t.percentPassingPPA * 100).toFixed(1)}%`);
                  if (t.percentReceivingPPA != null)
                    lines.push(`Receiving: ${(t.percentReceivingPPA * 100).toFixed(1)}%`);
                  if (t.percentRushingPPA != null)
                    lines.push(`Rushing: ${(t.percentRushingPPA * 100).toFixed(1)}%`);
                  return lines;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: Math.min(110, maxVal * 1.1),
              title: { display: true, text: 'Returning production (% of prior season PPA)' },
              grid: { color: 'rgba(0,0,0,0.06)' },
              ticks: { callback: (v: any) => `${v}%` },
            },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      },
      rows: top.map(t => {
        const parts: string[] = [];
        if (t.percentPassingPPA != null) parts.push(`pass ${(t.percentPassingPPA * 100).toFixed(0)}%`);
        if (t.percentReceivingPPA != null) parts.push(`rec ${(t.percentReceivingPPA * 100).toFixed(0)}%`);
        if (t.percentRushingPPA != null) parts.push(`rush ${(t.percentRushingPPA * 100).toFixed(0)}%`);
        return {
          label: t.team,
          value: `${((t.percentPPA ?? 0) * 100).toFixed(1)}% overall`,
          hint: parts.join(' · ') || t.conference || '',
        };
      }),
    };
  },
};
