import { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { AlertCircle, GitCompareArrows, Play } from 'lucide-react';
import type { PlayData, SeasonMetrics, PerGameMetric } from '../types';
import { fetchGamesForTeam, type Team } from '../services/api';
import { fetchSeasonPlayByPlayData } from '../services/seasonApi';
import { processPlayData } from '../utils/metrics';
import { calculateSeasonMetrics, calculatePerGameMetrics } from '../utils/seasonMetrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { useTeams } from '../hooks/useTeams';
import { initializeChartDefaults, percentCallback } from '../utils/chartConfig';
import TeamPicker from './TeamPicker';

initializeChartDefaults();

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];

interface TeamSeason {
  team: string;
  metrics: SeasonMetrics;
  perGame: PerGameMetric[];
}

const loadTeamSeason = async (year: number, team: string): Promise<TeamSeason> => {
  const games = await fetchGamesForTeam({ year, team });
  const completedIds = games.filter((g) => g.completed).map((g) => g.id);
  const result = await fetchSeasonPlayByPlayData({ year, team, selectedGameIds: completedIds });

  const allProcessed = processPlayData(result.allPlays);
  const perGameProcessed = new Map<number, PlayData[]>();
  result.perGamePlays.forEach((plays, id) => perGameProcessed.set(id, processPlayData(plays)));

  return {
    team,
    metrics: calculateSeasonMetrics(allProcessed, team),
    perGame: calculatePerGameMetrics(perGameProcessed, result.games, team),
  };
};

const formatPct = (value: number) => `${(value * 100).toFixed(1)}%`;

const TeamCompareView: React.FC = () => {
  const { teams, loading: loadingTeams } = useTeams();
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [year, setYear] = useState<number>(2025);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ a: TeamSeason; b: TeamSeason; year: number } | null>(null);

  const canCompare =
    !!teamA && !!teamB && teamA.school !== teamB.school && !loading;

  const handleCompare = async () => {
    if (!teamA || !teamB || teamA.school === teamB.school) return;
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        loadTeamSeason(year, teamA.school),
        loadTeamSeason(year, teamB.school),
      ]);
      setResult({ a, b, year });
    } catch (err) {
      console.error(err);
      setError('Failed to load comparison data. Please try again.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const colorsA = useMemo(
    () => (result ? getDisplayTeamColors(result.a.team, 'default') : null),
    [result],
  );
  const colorsB = useMemo(
    () => (result ? getDisplayTeamColors(result.b.team, 'default') : null),
    [result],
  );

  const rateBarData = useMemo<ChartData<'bar'> | null>(() => {
    if (!result || !colorsA || !colorsB) return null;
    return {
      labels: ['Success rate', 'Explosiveness'],
      datasets: [
        {
          label: result.a.team,
          data: [result.a.metrics.successRate, result.a.metrics.explosivenessRate],
          backgroundColor: colorsA.success,
        },
        {
          label: result.b.team,
          data: [result.b.metrics.successRate, result.b.metrics.explosivenessRate],
          backgroundColor: colorsB.success,
        },
      ],
    };
  }, [result, colorsA, colorsB]);

  const rateBarOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'center' },
        datalabels: {
          display: true,
          color: 'white',
          formatter: (value: number) => (value > 0 ? percentCallback(value) : null),
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${percentCallback(ctx.parsed.y as number)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 1, ticks: { callback: (v) => percentCallback(v as number) } },
      },
    }),
    [],
  );

  const srTrendData = useMemo<ChartData<'line'> | null>(() => {
    if (!result || !colorsA || !colorsB) return null;
    const maxGames = Math.max(result.a.perGame.length, result.b.perGame.length);
    const labels = Array.from({ length: maxGames }, (_, i) => `Gm ${i + 1}`);
    return {
      labels,
      datasets: [
        {
          label: result.a.team,
          data: labels.map((_, i) => result.a.perGame[i]?.teamSR ?? null),
          borderColor: colorsA.success,
          backgroundColor: colorsA.success,
          borderWidth: 2,
          spanGaps: true,
        },
        {
          label: result.b.team,
          data: labels.map((_, i) => result.b.perGame[i]?.teamSR ?? null),
          borderColor: colorsB.success,
          backgroundColor: colorsB.success,
          borderWidth: 2,
          spanGaps: true,
        },
      ],
    };
  }, [result, colorsA, colorsB]);

  const srTrendOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'center' },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const team = ctx.dataset.label;
              const perGame = team === result?.a.team ? result?.a.perGame : result?.b.perGame;
              const game = perGame?.[ctx.dataIndex];
              const oppText = game ? ` (${game.isHome ? 'vs' : '@'} ${game.opponent})` : '';
              return `${team}: ${percentCallback(ctx.parsed.y as number)}${oppText}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 1, ticks: { callback: (v) => percentCallback(v as number) } },
      },
    }),
    [result],
  );

  const metricRows = result
    ? [
        {
          label: 'Total plays',
          a: String(result.a.metrics.totalPlays),
          b: String(result.b.metrics.totalPlays),
          aWins: result.a.metrics.totalPlays > result.b.metrics.totalPlays,
          bWins: result.b.metrics.totalPlays > result.a.metrics.totalPlays,
        },
        {
          label: 'Success rate',
          a: formatPct(result.a.metrics.successRate),
          b: formatPct(result.b.metrics.successRate),
          aWins: result.a.metrics.successRate > result.b.metrics.successRate,
          bWins: result.b.metrics.successRate > result.a.metrics.successRate,
        },
        {
          label: 'Explosiveness',
          a: formatPct(result.a.metrics.explosivenessRate),
          b: formatPct(result.b.metrics.explosivenessRate),
          aWins: result.a.metrics.explosivenessRate > result.b.metrics.explosivenessRate,
          bWins: result.b.metrics.explosivenessRate > result.a.metrics.explosivenessRate,
        },
        {
          label: 'Yards / play',
          a: result.a.metrics.avgYardsPerPlay.toFixed(1),
          b: result.b.metrics.avgYardsPerPlay.toFixed(1),
          aWins: result.a.metrics.avgYardsPerPlay > result.b.metrics.avgYardsPerPlay,
          bWins: result.b.metrics.avgYardsPerPlay > result.a.metrics.avgYardsPerPlay,
        },
      ]
    : [];

  return (
    <div>
      {/* Inputs */}
      <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
        <div className="flex flex-wrap items-end gap-4">
          <TeamPicker
            label="Team A"
            value={teamA}
            onChange={setTeamA}
            teams={teams}
            loading={loadingTeams}
          />
          <TeamPicker
            label="Team B"
            value={teamB}
            onChange={setTeamB}
            teams={teams}
            loading={loadingTeams}
            placeholder="e.g., Georgia"
          />
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-2.5 shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleCompare}
              disabled={!canCompare}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-900 disabled:bg-neutral-400 text-white font-medium rounded-lg shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {loading ? <span>Comparing...</span> : (
                <>
                  <span>Compare</span>
                  <Play className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
        {teamA && teamB && teamA.school === teamB.school && (
          <p className="text-sm text-amber-700 mt-3">Pick two different teams to compare.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-6 mb-8">
          <p className="text-neutral-700 font-medium">
            Loading season data for both teams... this can take a moment.
          </p>
        </div>
      )}

      {!loading && result && (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">
              {result.a.team} vs. {result.b.team}
            </h2>
            <p className="text-neutral-600">{result.year} season • offensive efficiency</p>
          </div>

          {/* Metric comparison table */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden mb-8">
            <div className="grid grid-cols-3 bg-neutral-100 text-sm font-semibold text-neutral-700">
              <div className="px-4 py-3">{result.a.team}</div>
              <div className="px-4 py-3 text-center text-neutral-500">Metric</div>
              <div className="px-4 py-3 text-right">{result.b.team}</div>
            </div>
            {metricRows.map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-t border-neutral-200 items-center">
                <div className={`px-4 py-3 text-lg font-bold ${row.aWins ? 'text-neutral-900' : 'text-neutral-400'}`}>
                  {row.a}
                </div>
                <div className="px-4 py-3 text-center text-sm text-neutral-500">{row.label}</div>
                <div className={`px-4 py-3 text-right text-lg font-bold ${row.bWins ? 'text-neutral-900' : 'text-neutral-400'}`}>
                  {row.b}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm pt-5 px-4 pb-4 sm:px-6 sm:pb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Efficiency rates</h3>
              <div className="h-80">{rateBarData && <Bar data={rateBarData} options={rateBarOptions} />}</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm pt-5 px-4 pb-4 sm:px-6 sm:pb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Success rate by game</h3>
              <div className="h-80">{srTrendData && <Line data={srTrendData} options={srTrendOptions} />}</div>
            </div>
          </div>
        </>
      )}

      {!loading && !result && !error && (
        <div className="text-center py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-16">
            <GitCompareArrows className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">Compare two teams' seasons</h3>
            <p className="text-neutral-600 max-w-md mx-auto">
              Pick two teams and a year, then click Compare to see their offensive success rate,
              explosiveness, and per-game trends side by side.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCompareView;
