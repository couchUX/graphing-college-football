import type React from 'react';
import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { AlertCircle, GitCompareArrows, Play } from 'lucide-react';
import type { PlayData } from '../types';
import { fetchGamesForTeam, type Team } from '../services/api';
import type { Game as BoxScoreGame } from '../services/boxScoreApi';
import { fetchSeasonPlayByPlayData, fetchSeasonBoxScores } from '../services/seasonApi';
import { processPlayData } from '../utils/metrics';
import { calculateAveragedBoxScore, type BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { getTeamColors } from '../utils/teamColors';
import { type ColorOption } from '../utils/colorPalette';
import { createPlayerData } from '../utils/chartHelpers';
import { createPlayerOptions } from '../utils/chartOptions';
import { initializeChartDefaults } from '../utils/chartConfig';
import { useTeams } from '../hooks/useTeams';
import { useCompareChartData, type CompareSide } from '../hooks/useCompareChartData';
import TeamPicker from './TeamPicker';
import ColorPicker from './ColorPicker';
import TrendsChartsGrid from './TrendsChartsGrid';
import SeasonAdvancedBoxScore from './SeasonAdvancedBoxScore';

initializeChartDefaults();

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];

const formatPct = (value: number) => `${(value * 100).toFixed(1)}%`;

// The "default" swatch for ColorPicker, derived from a team's real colors so
// the picker matches the /games experience (default + curated palette).
const defaultColorOption = (team: Team | null): ColorOption => ({
  id: 'default',
  primary: team ? getTeamColors(team.school).success : '#6B7280',
  light: '',
  dark: '',
});

// Load and process one team's full season (plays + per-game plays + schedule).
const loadTeamSeason = async (year: number, team: string): Promise<CompareSide> => {
  const schedule = await fetchGamesForTeam({ year, team });
  const completed = schedule.filter((g) => g.completed);
  const completedIds = completed.map((g) => g.id);
  // Forward the already-fetched schedule so the season fetch doesn't re-request it.
  const result = await fetchSeasonPlayByPlayData({
    year,
    team,
    selectedGameIds: completedIds,
    games: completed,
  });

  const allPlays = processPlayData(result.allPlays);
  const perGamePlays = new Map<number, PlayData[]>();
  result.perGamePlays.forEach((plays, id) => perGamePlays.set(id, processPlayData(plays)));

  return { team, games: result.games, allPlays, perGamePlays };
};

type PlayerFilter = 'both' | 'a' | 'b';

interface CompareResult {
  a: CompareSide;
  b: CompareSide;
  year: number;
}

const TeamCompareView: React.FC = () => {
  const { teams, loading: loadingTeams } = useTeams();
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [colorA, setColorA] = useState<string>('default');
  const [colorB, setColorB] = useState<string>('default');
  const [year, setYear] = useState<number>(2025);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [boxScoresA, setBoxScoresA] = useState<BoxScoreGame[]>([]);
  const [boxScoresB, setBoxScoresB] = useState<BoxScoreGame[]>([]);
  const [boxScoreMode, setBoxScoreMode] = useState<BoxScoreMode>('averages');
  const [rushersFilter, setRushersFilter] = useState<PlayerFilter>('both');
  const [passersFilter, setPassersFilter] = useState<PlayerFilter>('both');
  const [receiversFilter, setReceiversFilter] = useState<PlayerFilter>('both');

  const canCompare = !!teamA && !!teamB && teamA.school !== teamB.school && !loading;

  const handleCompare = async () => {
    if (!teamA || !teamB || teamA.school === teamB.school) return;
    setLoading(true);
    setError(null);
    try {
      // Load each team sequentially to keep the request burst (and rate-limit
      // pressure) close to a single-team season fetch.
      const a = await loadTeamSeason(year, teamA.school);
      const b = await loadTeamSeason(year, teamB.school);
      const boxA = await fetchSeasonBoxScores(a.games, a.team, () => {});
      const boxB = await fetchSeasonBoxScores(b.games, b.team, () => {});
      setResult({ a, b, year });
      setBoxScoresA(boxA.boxScores);
      setBoxScoresB(boxB.boxScores);
      setRushersFilter('both');
      setPassersFilter('both');
      setReceiversFilter('both');
    } catch (err) {
      console.error(err);
      setError('Failed to load comparison data. Please try again.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useCompareChartData(result?.a ?? null, result?.b ?? null, colorA, colorB);

  const averagedA = useMemo(
    () =>
      result && boxScoresA.length
        ? calculateAveragedBoxScore(boxScoresA, result.a.team, boxScoreMode)
        : null,
    [boxScoresA, result, boxScoreMode],
  );
  const averagedB = useMemo(
    () =>
      result && boxScoresB.length
        ? calculateAveragedBoxScore(boxScoresB, result.b.team, boxScoreMode)
        : null,
    [boxScoresB, result, boxScoreMode],
  );

  const metricRows = chartData
    ? [
        {
          label: 'Total plays',
          a: String(chartData.metricsA.totalPlays),
          b: String(chartData.metricsB.totalPlays),
          aWins: chartData.metricsA.totalPlays > chartData.metricsB.totalPlays,
          bWins: chartData.metricsB.totalPlays > chartData.metricsA.totalPlays,
        },
        {
          label: 'Success rate',
          a: formatPct(chartData.metricsA.successRate),
          b: formatPct(chartData.metricsB.successRate),
          aWins: chartData.metricsA.successRate > chartData.metricsB.successRate,
          bWins: chartData.metricsB.successRate > chartData.metricsA.successRate,
        },
        {
          label: 'Explosiveness',
          a: formatPct(chartData.metricsA.explosivenessRate),
          b: formatPct(chartData.metricsB.explosivenessRate),
          aWins: chartData.metricsA.explosivenessRate > chartData.metricsB.explosivenessRate,
          bWins: chartData.metricsB.explosivenessRate > chartData.metricsA.explosivenessRate,
        },
        {
          label: 'Yards / play',
          a: chartData.metricsA.avgYardsPerPlay.toFixed(1),
          b: chartData.metricsB.avgYardsPerPlay.toFixed(1),
          aWins: chartData.metricsA.avgYardsPerPlay > chartData.metricsB.avgYardsPerPlay,
          bWins: chartData.metricsB.avgYardsPerPlay > chartData.metricsA.avgYardsPerPlay,
        },
      ]
    : [];

  const playerOptions = createPlayerOptions();

  // Filter combined (both-team) player lists down to a single team when chosen.
  const filterPlayers = (players: any[], filter: PlayerFilter) => {
    if (!result || filter === 'both') return players;
    const team = filter === 'a' ? result.a.team : result.b.team;
    return players.filter((p) => p.team === team);
  };

  const PlayerTeamFilter: React.FC<{
    value: PlayerFilter;
    onChange: (value: PlayerFilter) => void;
  }> = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PlayerFilter)}
      className="text-sm px-2.5 py-1 bg-white border border-neutral-300 rounded-md text-neutral-700 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-[length:1.2em_1.2em] bg-[position:calc(100%-0.6rem)_center] bg-no-repeat"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        paddingRight: '2rem',
      }}
    >
      <option value="both">Both teams</option>
      {result && <option value="a">{result.a.team}</option>}
      {result && <option value="b">{result.b.team}</option>}
    </select>
  );

  return (
    <div>
      {/* Inputs */}
      <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex items-end gap-2 w-full sm:w-auto">
            <div className="flex-1 min-w-0">
              <TeamPicker
                label="Team A"
                value={teamA}
                onChange={setTeamA}
                teams={teams}
                loading={loadingTeams}
              />
            </div>
            {teamA && (
              <div className="flex-shrink-0 pb-0.5">
                <ColorPicker
                  selectedColorId={colorA}
                  onColorChange={setColorA}
                  defaultColor={defaultColorOption(teamA)}
                />
              </div>
            )}
          </div>
          <div className="flex items-end gap-2 w-full sm:w-auto">
            <div className="flex-1 min-w-0">
              <TeamPicker
                label="Team B"
                value={teamB}
                onChange={setTeamB}
                teams={teams}
                loading={loadingTeams}
                placeholder="e.g., Georgia"
              />
            </div>
            {teamB && (
              <div className="flex-shrink-0 pb-0.5">
                <ColorPicker
                  selectedColorId={colorB}
                  onColorChange={setColorB}
                  defaultColor={defaultColorOption(teamB)}
                />
              </div>
            )}
          </div>
          <div className="w-full sm:w-auto sm:flex-shrink-0">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full sm:w-auto bg-white border border-neutral-300 rounded-lg px-3 py-2.5 shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:flex-shrink-0">
            <button
              onClick={handleCompare}
              disabled={!canCompare}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-900 disabled:bg-neutral-400 text-white font-medium rounded-lg shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Comparing...</span>
              ) : (
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

      {!loading && result && chartData && (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">
              {result.a.team} vs. {result.b.team}
            </h2>
            <p className="text-neutral-600">{result.year} season</p>
          </div>

          {/* Head-to-head metric table */}
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

          {/* Advanced box scores (one per team) */}
          {averagedA && (
            <SeasonAdvancedBoxScore
              team={result.a.team}
              year={result.year}
              firstTableStats={averagedA.firstTableStats}
              secondTableStats={averagedA.secondTableStats}
              selectedTeamColor={colorA}
              gamesCount={boxScoresA.length}
              mode={boxScoreMode}
              onModeChange={setBoxScoreMode}
            />
          )}
          {averagedB && (
            <SeasonAdvancedBoxScore
              team={result.b.team}
              year={result.year}
              firstTableStats={averagedB.firstTableStats}
              secondTableStats={averagedB.secondTableStats}
              selectedTeamColor={colorB}
              gamesCount={boxScoresB.length}
              mode={boxScoreMode}
              onModeChange={setBoxScoreMode}
            />
          )}

          {/* Comparison charts (same grid/order as Season trends) */}
          <TrendsChartsGrid
            chartData={chartData}
            team={`${result.a.team} vs. ${result.b.team}`}
            year={result.year}
            gamesCount={Math.max(result.a.games.length, result.b.games.length)}
            selectedTeamColor={colorA}
          />

          {/* Player charts (both teams, per-team picker per chart) */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">Player charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column - Rushers and Passers stacked */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-900">Top rushers</h3>
                    <PlayerTeamFilter value={rushersFilter} onChange={setRushersFilter} />
                  </div>
                  <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                    <div className="h-80">
                      <Bar
                        data={createPlayerData(filterPlayers(chartData.allRushers, rushersFilter), 'rush') as any}
                        options={playerOptions}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-900">Top passers</h3>
                    <PlayerTeamFilter value={passersFilter} onChange={setPassersFilter} />
                  </div>
                  <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                    <div className="h-50" style={{ height: '200px' }}>
                      <Bar
                        data={createPlayerData(filterPlayers(chartData.allPassers, passersFilter), 'pass') as any}
                        options={playerOptions}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column - Receivers spanning full height */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-900">Top receivers</h3>
                  <PlayerTeamFilter value={receiversFilter} onChange={setReceiversFilter} />
                </div>
                <div className="pt-5 px-6 pb-6 sm:pt-5 sm:px-6 sm:pb-6">
                  <div className="h-[640px]">
                    <Bar
                      data={createPlayerData(filterPlayers(chartData.allReceivers, receiversFilter), 'receive') as any}
                      options={playerOptions}
                    />
                  </div>
                </div>
              </div>
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
              Pick two teams and a year, then click Compare to see the same season-trends charts —
              success rate, explosiveness, play-type splits, per-game trends, and player charts —
              with one team set against the other.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCompareView;
