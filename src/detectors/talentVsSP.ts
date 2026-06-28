import { API_BASE_URL, getApiHeaders } from '../config/api';
import { fetchSPRatings, SPRating } from '../services/ratingsApi';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { buildQuadrantTicks } from '../utils/axisTicks';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];

interface Talent {
  year: number;
  team: string;
  talent: string | number;
}

const fetchTalent = async (year: number): Promise<Talent[]> => {
  const url = `${API_BASE_URL}/talent?year=${year}`;
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching talent`);
  return res.json();
};

const isInConference = (conf: string | undefined, filter?: string): boolean => {
  if (!conf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(conf);
  return conf === filter;
};

interface Pt {
  team: string;
  conference: string;
  talent: number;
  rating: number;
}

const linreg = (pts: Pt[]): { slope: number; intercept: number } => {
  const n = pts.length;
  if (!n) return { slope: 0, intercept: 0 };
  const mx = pts.reduce((s, p) => s + p.talent, 0) / n;
  const my = pts.reduce((s, p) => s + p.rating, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) {
    num += (p.talent - mx) * (p.rating - my);
    den += (p.talent - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
};

export const talentVsSPDetector: Detector = {
  id: 'talent-vs-sp',
  title: 'Talent vs SP+ (overachievers)',
  description:
    'Each team plotted by 247Sports Composite roster talent (x) against final SP+ rating (y). Teams sitting well above the trend line are punching above their talent — typically great coaching or scheme. Teams below the line are underperforming the talent they recruited.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const [talentRaw, ratings] = await Promise.all([
      cachedFetch(`talent:${filters.year}`, () => fetchTalent(filters.year)),
      cachedFetch(`sp-ratings:${filters.year}`, () => fetchSPRatings(filters.year)),
    ]);

    const talentByTeam = new Map<string, number>();
    talentRaw.forEach(t => {
      const v = typeof t.talent === 'string' ? parseFloat(t.talent) : t.talent;
      if (!Number.isFinite(v)) return;
      talentByTeam.set(t.team, v as number);
    });

    const points: Pt[] = [];
    ratings.forEach((r: SPRating) => {
      if (!r.team || r.team.toLowerCase().includes('average')) return;
      if (!isInConference(r.conference, filters.conference)) return;
      const t = talentByTeam.get(r.team);
      if (t == null) return;
      points.push({
        team: r.team,
        conference: r.conference || '',
        talent: t,
        rating: r.rating,
      });
    });

    if (points.length < 4) {
      return {
        headline: 'Not enough overlap to plot',
        subtext: 'Either SP+ ratings or 247Sports talent composite is missing for this season.',
        chart: { type: 'scatter', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } },
      };
    }

    const { slope, intercept } = linreg(points);
    const residuals = points.map(p => ({
      ...p,
      residual: p.rating - (slope * p.talent + intercept),
    }));

    const overachievers = [...residuals].sort((a, b) => b.residual - a.residual).slice(0, 5);
    const underachievers = [...residuals].sort((a, b) => a.residual - b.residual).slice(0, 5);

    const pointBg = points.map(p => getDisplayTeamColors(p.team, 'default').success);
    const pointBd = points.map(p => {
      const c = getDisplayTeamColors(p.team, 'default');
      return c.color || c.success;
    });

    const tMin = Math.min(...points.map(p => p.talent));
    const tMax = Math.max(...points.map(p => p.talent));
    // Evenly-spaced x ticks with a guaranteed center line (rough quadrants).
    const xTicks = buildQuadrantTicks(tMin, tMax);

    // Span the trend line to the axis edges (not raw data bounds) so it doesn't
    // float with whitespace on each side now that the axis extends a full step out.
    const trend = [
      { x: xTicks.min, y: slope * xTicks.min + intercept },
      { x: xTicks.max, y: slope * xTicks.max + intercept },
    ];

    return {
      headline: 'Talent vs SP+ (overachievers)',
      subtext: `${filters.year} season • ${points.length} teams • Above the trend line = punching above talent; below = underperforming.`,
      chart: {
        type: 'scatter',
        height: 460,
        searchable: { placeholder: 'Search a team to highlight (e.g. Alabama)', matchField: 'team' },
        data: {
          datasets: [
            {
              label: 'Teams',
              data: points.map(p => ({ x: p.talent, y: p.rating, team: p.team })) as any,
              backgroundColor: pointBg,
              borderColor: pointBd,
              borderWidth: 1,
              pointRadius: 5,
              pointHoverRadius: 8,
            },
            {
              label: 'Trend',
              type: 'line' as any,
              data: trend as any,
              borderColor: '#9ca3af',
              borderWidth: 1.5,
              borderDash: [4, 4],
              pointRadius: 0,
              showLine: true,
              fill: false,
              order: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: { display: false },
            tooltip: {
              callbacks: {
                label: (item: any) => {
                  const d = item.raw;
                  if (d?.team) {
                    return `${d.team}: talent ${d.x.toFixed(1)}, SP+ ${d.y.toFixed(1)}`;
                  }
                  return '';
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              min: xTicks.min,
              max: xTicks.max,
              title: { display: true, text: '247Sports Composite talent score' },
              ticks: { stepSize: xTicks.stepSize },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: {
              title: { display: true, text: 'SP+ overall rating' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
          },
        },
      },
      rows: [
        ...overachievers.map(t => ({
          label: `${t.team} (${t.conference})`,
          value: `Overachiever: +${t.residual.toFixed(1)} SP+ vs expected`,
          hint: `Talent ${t.talent.toFixed(1)} · SP+ ${t.rating.toFixed(1)}`,
        })),
        ...underachievers.map(t => ({
          label: `${t.team} (${t.conference})`,
          value: `Underachiever: ${t.residual.toFixed(1)} SP+ vs expected`,
          hint: `Talent ${t.talent.toFixed(1)} · SP+ ${t.rating.toFixed(1)}`,
        })),
      ],
    };
  },
};
