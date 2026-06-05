import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { AlertCircle, GitCompareArrows, Play } from 'lucide-react';
import type { PlayData } from '../types';
import { fetchGamesForTeam, type Team, type TeamGame } from '../services/api';
import type { Game as BoxScoreGame } from '../services/boxScoreApi';
import { fetchSeasonPlayByPlayData, fetchSeasonBoxScores } from '../services/seasonApi';
import { processPlayData } from '../utils/metrics';
import { calculateAveragedBoxScore, type BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { createPlayerData } from '../utils/chartHelpers';
import { createPlayerOptions } from '../utils/chartOptions';
import { initializeChartDefaults } from '../utils/chartConfig';
import { useTeams } from '../hooks/useTeams';
import { useCompareChartData, type CompareSide } from '../hooks/useCompareChartData';
import { readParams, writeParams, encodeGameSelection, decodeGameSelection } from '../utils/trendsUrl';
import TeamPicker from './TeamPicker';
import GameMultiSelect from './GameMultiSelect';
import CompareBoxScore from './CompareBoxScore';
import TrendsChartsGrid from './TrendsChartsGrid';

initializeChartDefaults();

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];

const sortGames = (a: TeamGame, b: TeamGame) => {
  if (a.seasonType !== b.seasonType) return a.seasonType === 'regular' ? -1 : 1;
  return a.week - b.week;
};

// Load and process one team's selected games (plays + per-game plays).
const loadTeamSeason = async (
  year: number,
  team: string,
  selectedGames: TeamGame[],
): Promise<CompareSide> => {
  const result = await fetchSeasonPlayByPlayData({
    year,
    team,
    selectedGameIds: selectedGames.map((g) => g.id),
    games: selectedGames,
  });

  const allPlays = processPlayData(result.allPlays);
  const perGamePlays = new Map<number, PlayData[]>();
  result.perGamePlays.forEach((plays, id) => perGamePlays.set(id, processPlayData(plays)));

  return { team, games: result.games, allPlays, perGamePlays };
};

type PlayerFilter = 'both' | 'a' | 'b';
type PlayerCount = number | 'all';

interface CompareResult {
  a: CompareSide;
  b: CompareSide;
  year: number;
}

// Small styled <select> used by the player-chart filters. Defined at module
// scope so its identity is stable across renders (otherwise the dropdown would
// remount and close mid-interaction).
const FILTER_SELECT_CLASS =
  'text-sm px-2.5 py-1 bg-white border border-neutral-300 rounded-md text-neutral-700 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-[length:1.2em_1.2em] bg-[position:calc(100%-0.6rem)_center] bg-no-repeat';
const FILTER_SELECT_STYLE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
  paddingRight: '2rem',
};

const FilterSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={FILTER_SELECT_CLASS}
    style={FILTER_SELECT_STYLE}
  >
    {children}
  </select>
);

const PlayerTeamFilter: React.FC<{
  value: PlayerFilter;
  onChange: (v: PlayerFilter) => void;
  teamAName: string;
  teamBName: string;
}> = ({ value, onChange, teamAName, teamBName }) => (
  <FilterSelect value={value} onChange={(v) => onChange(v as PlayerFilter)}>
    <option value="both">Both teams</option>
    <option value="a">{teamAName}</option>
    <option value="b">{teamBName}</option>
  </FilterSelect>
);

const PlayerCountFilter: React.FC<{
  value: PlayerCount;
  onChange: (v: PlayerCount) => void;
}> = ({ value, onChange }) => (
  <FilterSelect value={String(value)} onChange={(v) => onChange(v === 'all' ? 'all' : Number(v))}>
    <option value="all">All</option>
    {[1, 2, 3, 4, 5].map((n) => (
      <option key={n} value={n}>
        Top {n}
      </option>
    ))}
  </FilterSelect>
);

const TeamCompareView: React.FC = () => {
  const { teams, loading: loadingTeams } = useTeams();
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [colorA, setColorA] = useState<string>('default');
  const [colorB, setColorB] = useState<string>('default');
  const [year, setYear] = useState<number>(2025);

  const [gamesA, setGamesA] = useState<TeamGame[]>([]);
  const [gamesB, setGamesB] = useState<TeamGame[]>([]);
  const [selectedA, setSelectedA] = useState<number[]>([]);
  const [selectedB, setSelectedB] = useState<number[]>([]);
  const [loadingGamesA, setLoadingGamesA] = useState(false);
  const [loadingGamesB, setLoadingGamesB] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [boxScoresA, setBoxScoresA] = useState<BoxScoreGame[]>([]);
  const [boxScoresB, setBoxScoresB] = useState<BoxScoreGame[]>([]);
  const [boxScoreMode, setBoxScoreMode] = useState<BoxScoreMode>('averages');

  const [rushersFilter, setRushersFilter] = useState<PlayerFilter>('both');
  const [passersFilter, setPassersFilter] = useState<PlayerFilter>('both');
  const [receiversFilter, setReceiversFilter] = useState<PlayerFilter>('both');
  const [rushersCount, setRushersCount] = useState<PlayerCount>('all');
  const [passersCount, setPassersCount] = useState<PlayerCount>('all');
  const [receiversCount, setReceiversCount] = useState<PlayerCount>('all');

  // URL restore/persist plumbing. pendingGames* hold a game selection read from
  // the URL until that team's schedule loads and the indices can be resolved.
  const [pendingGamesA, setPendingGamesA] = useState<string | null>(null);
  const [pendingGamesB, setPendingGamesB] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const autoCompareRef = useRef(false);
  const urlReadyRef = useRef(false);

  // Load each team's completed games when the team or year changes.
  useEffect(() => {
    let active = true;
    if (!teamA) {
      setGamesA([]);
      setSelectedA([]);
      return;
    }
    setLoadingGamesA(true);
    fetchGamesForTeam({ year, team: teamA.school })
      .then((games) => {
        if (!active) return;
        const completed = games.filter((g) => g.completed).sort(sortGames);
        setGamesA(completed);
        setSelectedA(
          pendingGamesA !== null
            ? decodeGameSelection(pendingGamesA, completed)
            : completed.map((g) => g.id),
        );
        setPendingGamesA(null);
      })
      .catch(() => {
        if (active) {
          setGamesA([]);
          setSelectedA([]);
        }
      })
      .finally(() => {
        if (active) setLoadingGamesA(false);
      });
    return () => {
      active = false;
    };
  }, [teamA, year]);

  useEffect(() => {
    let active = true;
    if (!teamB) {
      setGamesB([]);
      setSelectedB([]);
      return;
    }
    setLoadingGamesB(true);
    fetchGamesForTeam({ year, team: teamB.school })
      .then((games) => {
        if (!active) return;
        const completed = games.filter((g) => g.completed).sort(sortGames);
        setGamesB(completed);
        setSelectedB(
          pendingGamesB !== null
            ? decodeGameSelection(pendingGamesB, completed)
            : completed.map((g) => g.id),
        );
        setPendingGamesB(null);
      })
      .catch(() => {
        if (active) {
          setGamesB([]);
          setSelectedB([]);
        }
      })
      .finally(() => {
        if (active) setLoadingGamesB(false);
      });
    return () => {
      active = false;
    };
  }, [teamB, year]);

  // Restore teams / colors / year / game selections from the URL once the team
  // list is available; auto-run the comparison when both teams are present.
  useEffect(() => {
    if (restoredRef.current || teams.length === 0) return;
    restoredRef.current = true;
    const p = readParams();
    const find = (school: string | null) =>
      school ? teams.find((t) => t.school.toLowerCase() === school.toLowerCase()) ?? null : null;
    const a = find(p.get('aTeam'));
    const b = find(p.get('bTeam'));
    const y = Number(p.get('year'));
    if (Number.isInteger(y) && y > 0) setYear(y);
    const ac = p.get('aColor');
    if (ac) setColorA(ac);
    const bc = p.get('bColor');
    if (bc) setColorB(bc);
    if (a) {
      setPendingGamesA(p.get('aGames'));
      setTeamA(a);
    }
    if (b) {
      setPendingGamesB(p.get('bGames'));
      setTeamB(b);
    }
    if (a && b) {
      autoCompareRef.current = true;
    } else {
      urlReadyRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const canCompare =
    !!teamA &&
    !!teamB &&
    teamA.school !== teamB.school &&
    selectedA.length > 0 &&
    selectedB.length > 0 &&
    !loading;

  const handleCompare = async () => {
    if (!teamA || !teamB || teamA.school === teamB.school) return;
    setLoading(true);
    setError(null);
    try {
      const selGamesA = gamesA.filter((g) => selectedA.includes(g.id));
      const selGamesB = gamesB.filter((g) => selectedB.includes(g.id));
      // Sequentially to keep request bursts close to a single-team season fetch.
      const a = await loadTeamSeason(year, teamA.school, selGamesA);
      const b = await loadTeamSeason(year, teamB.school, selGamesB);
      const boxA = await fetchSeasonBoxScores(a.games, a.team, () => {});
      const boxB = await fetchSeasonBoxScores(b.games, b.team, () => {});
      setResult({ a, b, year });
      setBoxScoresA(boxA.boxScores);
      setBoxScoresB(boxB.boxScores);
      setRushersFilter('both');
      setPassersFilter('both');
      setReceiversFilter('both');
      setRushersCount('all');
      setPassersCount('all');
      setReceiversCount('all');
    } catch (err) {
      console.error(err);
      setError('Failed to load comparison data. Please try again.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useCompareChartData(result?.a ?? null, result?.b ?? null, colorA, colorB);

  // Auto-run the comparison after a URL restore, once both teams' games have
  // loaded and any pending game selection has been applied.
  useEffect(() => {
    if (!autoCompareRef.current) return;
    if (!teamA || !teamB) return;
    if (loadingGamesA || loadingGamesB) return;
    if (pendingGamesA !== null || pendingGamesB !== null) return;
    if (gamesA.length === 0 || gamesB.length === 0) return;
    if (selectedA.length === 0 || selectedB.length === 0) return;
    autoCompareRef.current = false;
    urlReadyRef.current = true;
    void handleCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamA, teamB, gamesA, gamesB, selectedA, selectedB, loadingGamesA, loadingGamesB, pendingGamesA, pendingGamesB]);

  // Persist the comparison inputs to the URL (namespaced so they don't collide
  // with the single-team Season trends params).
  useEffect(() => {
    if (!urlReadyRef.current) return;
    writeParams({
      aTeam: teamA?.school ?? null,
      bTeam: teamB?.school ?? null,
      year: String(year),
      aColor: colorA === 'default' ? null : colorA,
      bColor: colorB === 'default' ? null : colorB,
      aGames: teamA ? encodeGameSelection(selectedA, gamesA) : null,
      bGames: teamB ? encodeGameSelection(selectedB, gamesB) : null,
    });
  }, [teamA, teamB, year, colorA, colorB, selectedA, selectedB, gamesA, gamesB]);

  const averagedA = useMemo(
    () => (result && boxScoresA.length ? calculateAveragedBoxScore(boxScoresA, result.a.team, boxScoreMode) : null),
    [boxScoresA, result, boxScoreMode],
  );
  const averagedB = useMemo(
    () => (result && boxScoresB.length ? calculateAveragedBoxScore(boxScoresB, result.b.team, boxScoreMode) : null),
    [boxScoresB, result, boxScoreMode],
  );

  const playerOptions = createPlayerOptions();

  // Take the top-N per included team, then concatenate (players come pre-sorted
  // by total within each team). count 'all' shows every player for the team.
  const selectPlayers = (players: any[], filter: PlayerFilter, count: PlayerCount) => {
    if (!result) return players;
    const teamsToShow =
      filter === 'both'
        ? [result.a.team, result.b.team]
        : filter === 'a'
          ? [result.a.team]
          : [result.b.team];
    return teamsToShow.flatMap((team) => {
      const forTeam = players.filter((p) => p.team === team);
      return count === 'all' ? forTeam : forTeam.slice(0, count);
    });
  };

  return (
    <div>
      {/* Inputs: a row per team, then year + compare */}
      <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
        <div className="flex flex-col gap-4">
          {/* Team A */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <TeamPicker
              label="Team A"
              value={teamA}
              onChange={setTeamA}
              teams={teams}
              loading={loadingTeams}
              colorId={colorA}
              onColorChange={setColorA}
            />
            <GameMultiSelect
              label="Team A games"
              teamName={teamA?.school ?? ''}
              games={gamesA}
              selectedIds={selectedA}
              onChange={setSelectedA}
              loading={loadingGamesA}
              disabled={!teamA}
            />
          </div>
          {/* Team B */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <TeamPicker
              label="Team B"
              value={teamB}
              onChange={setTeamB}
              teams={teams}
              loading={loadingTeams}
              placeholder="e.g., Georgia"
              colorId={colorB}
              onColorChange={setColorB}
            />
            <GameMultiSelect
              label="Team B games"
              teamName={teamB?.school ?? ''}
              games={gamesB}
              selectedIds={selectedB}
              onChange={setSelectedB}
              loading={loadingGamesB}
              disabled={!teamB}
            />
          </div>
          {/* Year + Compare */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full sm:w-auto bg-white border border-neutral-300 rounded-lg px-4 py-3 shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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

          {/* Consolidated box score: the two teams compared directly */}
          {averagedA && averagedB && (
            <CompareBoxScore
              teamA={result.a.team}
              teamB={result.b.team}
              statsA={averagedA}
              statsB={averagedB}
              colorA={colorA}
              colorB={colorB}
              year={result.year}
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
            perGameChartType={chartData.perGameChartType}
            perGameMessage={
              chartData.perGameChartType === 'bar'
                ? 'Not available for a single-game selection.'
                : undefined
            }
          />

          {/* Player charts (both teams; per-team filter + top-N per chart) */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">Player charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-900">Top rushers</h3>
                    <PlayerTeamFilter
                      value={rushersFilter}
                      onChange={setRushersFilter}
                      teamAName={result.a.team}
                      teamBName={result.b.team}
                    />
                    <PlayerCountFilter value={rushersCount} onChange={setRushersCount} />
                  </div>
                  <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                    <div className="h-80">
                      <Bar
                        data={createPlayerData(selectPlayers(chartData.allRushers, rushersFilter, rushersCount), 'rush') as any}
                        options={playerOptions}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-900">Top passers</h3>
                    <PlayerTeamFilter
                      value={passersFilter}
                      onChange={setPassersFilter}
                      teamAName={result.a.team}
                      teamBName={result.b.team}
                    />
                    <PlayerCountFilter value={passersCount} onChange={setPassersCount} />
                  </div>
                  <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                    <div style={{ height: '200px' }}>
                      <Bar
                        data={createPlayerData(selectPlayers(chartData.allPassers, passersFilter, passersCount), 'pass') as any}
                        options={playerOptions}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-900">Top receivers</h3>
                  <PlayerTeamFilter
                    value={receiversFilter}
                    onChange={setReceiversFilter}
                    teamAName={result.a.team}
                    teamBName={result.b.team}
                  />
                  <PlayerCountFilter value={receiversCount} onChange={setReceiversCount} />
                </div>
                <div className="pt-5 px-6 pb-6 sm:pt-5 sm:px-6 sm:pb-6">
                  <div className="h-[640px]">
                    <Bar
                      data={createPlayerData(selectPlayers(chartData.allReceivers, receiversFilter, receiversCount), 'receive') as any}
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
              Pick two teams, choose which games to include for each, then click Compare to see the
              same season-trends charts — box score, success rate, explosiveness, play-type splits,
              and player charts — with one team set directly against the other.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCompareView;
