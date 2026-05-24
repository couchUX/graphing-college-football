import { API_BASE_URL, getApiHeaders } from '../config/api';
import { fetchSPRatings, SPRating } from '../services/ratingsApi';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorFilters, DetectorResult } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];

interface SeasonAdvanced {
  season: number;
  team: string;
  conference?: string;
  offense?: { havoc?: { total?: number; frontSeven?: number; db?: number } };
  defense?: {
    havoc?: { total?: number; frontSeven?: number; db?: number };
  };
}

const fetchSeasonAdvanced = async (year: number): Promise<SeasonAdvanced[]> => {
  const url = `${API_BASE_URL}/stats/season/advanced?year=${year}`;
  const res = await fetch(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching season advanced stats`);
  return res.json();
};

const isInConference = (conf: string | undefined, filter?: string): boolean => {
  if (!conf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(conf);
  return conf === filter;
};

interface TeamPoint {
  team: string;
  conference: string;
  havoc: number; // defensive havoc rate
  spDefense: number; // SP+ defense rating (lower = better)
}

// Compute linear regression slope/intercept on (x, y).
const linearRegression = (pts: { x: number; y: number }[]): { slope: number; intercept: number } => {
  const n = pts.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const meanX = pts.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
};

export const havocVsSPDetector: Detector = {
  id: 'havoc-vs-sp-defense',
  title: 'Havoc rate vs SP+ defense',
  description:
    'Defensive havoc — TFLs, PBUs, and forced fumbles as a share of plays — plotted against SP+ defensive rating. Teams above the trend line are "better than their havoc would suggest" (fundamentals, tackling, situational defense). Teams below are "less than the sum of their flashy plays".',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const [ratings, advanced] = await Promise.all([
      cachedFetch(`sp-ratings:${filters.year}`, () => fetchSPRatings(filters.year)),
      cachedFetch(`season-adv:${filters.year}`, () => fetchSeasonAdvanced(filters.year)),
    ]);

    const havocByTeam = new Map<string, SeasonAdvanced>();
    advanced.forEach(a => havocByTeam.set(a.team, a));

    const points: TeamPoint[] = [];
    ratings.forEach((r: SPRating) => {
      if (
        !r.team ||
        r.team.toLowerCase().includes('average') ||
        !r.defense?.rating
      )
        return;
      if (!isInConference(r.conference, filters.conference)) return;
      const adv = havocByTeam.get(r.team);
      const havoc = adv?.defense?.havoc?.total;
      if (havoc == null) return;
      points.push({
        team: r.team,
        conference: r.conference || '',
        havoc,
        spDefense: r.defense.rating,
      });
    });

    if (points.length < 4) {
      return {
        headline: 'Not enough teams to plot',
        subtext: 'Either SP+ or havoc data isn\'t available for this season yet.',
        chart: { type: 'scatter', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false } },
      };
    }

    // Regression: predict spDefense from havoc. Residual = actual - predicted.
    // Note: lower spDefense = better, so positive residual means "worse than havoc predicts".
    const { slope, intercept } = linearRegression(
      points.map(p => ({ x: p.havoc, y: p.spDefense }))
    );

    const residuals = points.map(p => {
      const predicted = slope * p.havoc + intercept;
      return { ...p, residual: p.spDefense - predicted };
    });

    // "Better than havoc predicts" → most negative residuals (allowed fewer points than havoc suggested)
    const better = [...residuals].sort((a, b) => a.residual - b.residual).slice(0, 5);
    // "Worse than havoc predicts" → most positive residuals
    const worse = [...residuals].sort((a, b) => b.residual - a.residual).slice(0, 5);

    // Build scatter dataset.
    const pointBackground = points.map(p => getDisplayTeamColors(p.team, 'default').success);
    const pointBorder = points.map(p => {
      const c = getDisplayTeamColors(p.team, 'default');
      return c.color || c.success;
    });

    const havocMin = Math.min(...points.map(p => p.havoc));
    const havocMax = Math.max(...points.map(p => p.havoc));
    const havocRange = havocMax - havocMin || 0.01;
    const havocPadding = havocRange * 0.06;

    const trendLineData = [
      { x: havocMin, y: slope * havocMin + intercept },
      { x: havocMax, y: slope * havocMax + intercept },
    ];

    return {
      headline: 'Havoc rate vs SP+ defense',
      subtext: `${filters.year} season • ${points.length} teams • Y-axis inverted so "up = better defense"`,
      chart: {
        type: 'scatter',
        height: 460,
        data: {
          datasets: [
            {
              label: 'Teams',
              data: points.map(p => ({ x: p.havoc, y: p.spDefense, team: p.team })) as any,
              backgroundColor: pointBackground,
              borderColor: pointBorder,
              borderWidth: 1,
              pointRadius: 5,
              pointHoverRadius: 8,
            },
            {
              label: 'Trend',
              type: 'line' as any,
              data: trendLineData as any,
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
                    return `${d.team}: havoc ${(d.x * 100).toFixed(1)}%, SP+ def ${d.y.toFixed(1)}`;
                  }
                  return '';
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              min: havocMin - havocPadding,
              max: havocMax + havocPadding,
              title: { display: true, text: 'Defensive havoc rate' },
              ticks: { callback: (v: any) => `${(v * 100).toFixed(0)}%` },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: {
              reverse: true, // lower SP+ defense = better → put it at the top
              title: { display: true, text: 'SP+ defense rating (lower = better)' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
          },
        },
      },
      rows: [
        ...better.map(t => ({
          label: `${t.team} (${t.conference})`,
          value: `Better than havoc predicts (${t.residual >= 0 ? '+' : ''}${t.residual.toFixed(1)})`,
          hint: `Havoc ${(t.havoc * 100).toFixed(1)}% · SP+ def ${t.spDefense.toFixed(1)}`,
        })),
        ...worse.map(t => ({
          label: `${t.team} (${t.conference})`,
          value: `Worse than havoc predicts (+${t.residual.toFixed(1)})`,
          hint: `Havoc ${(t.havoc * 100).toFixed(1)}% · SP+ def ${t.spDefense.toFixed(1)}`,
        })),
      ],
    };
  },
};
