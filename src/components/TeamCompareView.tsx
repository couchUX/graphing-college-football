import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { AlertCircle, Check, Copy, GitCompareArrows, Play } from 'lucide-react';
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
import { CURRENT_SEASON, SEASON_YEARS } from '../constants/seasons';
import { useCompareChartData, type CompareSide } from '../hooks/useCompareChartData';
import { readParams, writeParams, encodeGameSelection, decodeGameSelection } from '../utils/trendsUrl';
import { generateTrendsEmbedCode } from '../utils/trendsEmbedGenerator';
import TeamPicker from './TeamPicker';
import GameMultiSelect from './GameMultiSelect';
import CompareBoxScore from './CompareBoxScore';
import TrendsChartsGrid from './TrendsChartsGrid';

initializeChartDefaults();

const sortGames = (a: TeamGame, b: TeamGame) => {
  if (a.seasonType !== b.seasonType) return a.seasonType === 'regular' ? -1 : 1;
  return a.week - b.week;
};

// Load and process one team's selected games (plays + per-game plays).
// fullSchedule is the team's complete completed schedule so the per-game charts
// can place each game at its real slot even when a subset is selected.
const loadTeamSeason = async (
  year: number,
  team: string,
  selectedGames: TeamGame[],
  fullSchedule: TeamGame[],
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

  return {
    team,
    games: result.games,
    allPlays,
    perGamePlays,
    allGameIds: fullSchedule.map((g) => g.id),
  };
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
  'select-field w-auto py-1 pl-2.5 pr-8 text-sm text-neutral-700';

const FilterSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={FILTER_SELECT_CLASS}
   
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

// Copy-embed button for the player charts. Module scope (like the filters
// above) so its identity is stable across renders.
const PlayerEmbedButton: React.FC<{
  chartId: string;
  title: string;
  data: unknown;
  copiedChartId: string | null;
  onCopy: (chartId: string, title: string, data: unknown) => void;
}> = ({ chartId, title, data, copiedChartId, onCopy }) => {
  const copied = copiedChartId === chartId;
  return (
    <button
      onClick={() => onCopy(chartId, title, data)}
      className={`ml-auto flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
        copied ? 'border-green-300 bg-green-50' : 'border-neutral-300 hover:bg-neutral-50'
      }`}
      title={copied ? 'Copied!' : 'Copy embed code'}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-neutral-600" />
      )}
    </button>
  );
};

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
  const { teams, loading: loadingTeams, error: teamsError } = useTeams();
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [colorA, setColorA] = useState<string>('default');
  const [colorB, setColorB] = useState<string>('default');
  const [year, setYear] = useState<number>(CURRENT_SEASON);

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

  const [copiedPlayerChart, setCopiedPlayerChart] = useState<string | null>(null);
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
      // Clearing a team mid-restore must drop any pending URL selection and
      // cancel auto-compare so stale indices aren't applied to the next pick.
      setPendingGamesA(null);
      autoCompareRef.current = false;
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
      setPendingGamesB(null);
      autoCompareRef.current = false;
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
    const y = Number(p.get('compareYear'));
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
     
  }, [teams]);

  const canCompare =
    !!teamA &&
    !!teamB &&
    teamA.school !== teamB.school &&
    selectedA.length > 0 &&
    selectedB.length > 0 &&
    !loadingGamesA &&
    !loadingGamesB &&
    !loading;

  const handleCompare = async () => {
    if (!teamA || !teamB || teamA.school === teamB.school) return;
    setLoading(true);
    setError(null);
    try {
      const selGamesA = gamesA.filter((g) => selectedA.includes(g.id));
      const selGamesB = gamesB.filter((g) => selectedB.includes(g.id));
      // Sequentially to keep request bursts close to a single-team season fetch.
      const a = await loadTeamSeason(year, teamA.school, selGamesA, gamesA);
      const b = await loadTeamSeason(year, teamB.school, selGamesB, gamesB);
      // useCompareChartData returns null (blank UI) if either side has no plays,
      // so fail loudly with a clear message instead of rendering nothing.
      if (!a.allPlays.length || !b.allPlays.length) {
        throw new Error('No play-by-play data found for the selected games.');
      }
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
      compareYear: String(year),
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

  // Embed overrides shared by the grid + player charts: link back to this
  // comparison (same params the page persists to its URL) with compare wording.
  const compareEmbedOptions = useMemo(() => {
    if (!result) return undefined;
    const params = new URLSearchParams();
    params.set('view', 'compare');
    params.set('aTeam', result.a.team);
    params.set('bTeam', result.b.team);
    params.set('compareYear', String(result.year));
    if (colorA !== 'default') params.set('aColor', colorA);
    if (colorB !== 'default') params.set('bColor', colorB);
    const aGames = encodeGameSelection(result.a.games.map((g) => g.id), gamesA);
    if (aGames) params.set('aGames', aGames);
    const bGames = encodeGameSelection(result.b.games.map((g) => g.id), gamesB);
    if (bGames) params.set('bGames', bGames);
    return {
      url: `https://graphingcollegefootball.com/trends?${params.toString()}`,
      subtitle: `${result.a.team} vs. ${result.b.team} - ${result.year} Season`,
      mode: 'compare' as const,
    };
  }, [result, colorA, colorB, gamesA, gamesB]);

  const handleCopyPlayerEmbed = async (chartId: string, title: string, data: unknown) => {
    if (!result) return;
    if (!navigator.clipboard?.writeText) {
      console.error('Clipboard not available in this browser');
      return;
    }
    try {
      const embedCode = generateTrendsEmbedCode(
        chartId,
        title,
        data,
        'bar',
        `${result.a.team} vs. ${result.b.team}`,
        result.year,
        Math.max(result.a.games.length, result.b.games.length),
        colorA,
        compareEmbedOptions
      );
      await navigator.clipboard.writeText(embedCode);
      setCopiedPlayerChart(chartId);
      setTimeout(() => setCopiedPlayerChart(null), 2000);
    } catch (err) {
      console.error('Failed to copy player chart embed code:', err);
      setCopiedPlayerChart(null);
    }
  };

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
      <div className="config-panel mb-7 sm:mb-8">
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
                className="select-field w-full sm:w-auto"
              >
                {SEASON_YEARS.map((y) => (
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
                className="btn-ink w-full sm:w-auto"
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
        {teamsError && (
          <p className="text-sm text-red-700 mt-3">
            Couldn't load the team list. Check your connection and refresh to try again.
          </p>
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
            <h2 className="headline text-[26px] text-ink">
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
            hidePerGameLines={chartData.perGameChartType === 'bar'}
            embedOptions={compareEmbedOptions}
          />

          {/* Player charts (both teams; per-team filter + top-N per chart) */}
          <div className="mt-8">
            <h2 className="headline text-[26px] text-ink mb-6">Player charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-neutral-200">
                    <h3 className="headline relative top-px text-[17px] font-bold text-ink">Top rushers</h3>
                    <PlayerTeamFilter
                      value={rushersFilter}
                      onChange={setRushersFilter}
                      teamAName={result.a.team}
                      teamBName={result.b.team}
                    />
                    <PlayerCountFilter value={rushersCount} onChange={setRushersCount} />
                    <PlayerEmbedButton
                      chartId="top-rushers"
                      title="Top Rushers"
                      data={createPlayerData(selectPlayers(chartData.allRushers, rushersFilter, rushersCount), 'rush')}
                      copiedChartId={copiedPlayerChart}
                      onCopy={handleCopyPlayerEmbed}
                    />
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
                    <h3 className="headline relative top-px text-[17px] font-bold text-ink">Top passers</h3>
                    <PlayerTeamFilter
                      value={passersFilter}
                      onChange={setPassersFilter}
                      teamAName={result.a.team}
                      teamBName={result.b.team}
                    />
                    <PlayerCountFilter value={passersCount} onChange={setPassersCount} />
                    <PlayerEmbedButton
                      chartId="top-passers"
                      title="Top Passers"
                      data={createPlayerData(selectPlayers(chartData.allPassers, passersFilter, passersCount), 'pass')}
                      copiedChartId={copiedPlayerChart}
                      onCopy={handleCopyPlayerEmbed}
                    />
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
                  <h3 className="headline relative top-px text-[17px] font-bold text-ink">Top receivers</h3>
                  <PlayerTeamFilter
                    value={receiversFilter}
                    onChange={setReceiversFilter}
                    teamAName={result.a.team}
                    teamBName={result.b.team}
                  />
                  <PlayerCountFilter value={receiversCount} onChange={setReceiversCount} />
                  <PlayerEmbedButton
                    chartId="top-receivers"
                    title="Top Receivers"
                    data={createPlayerData(selectPlayers(chartData.allReceivers, receiversFilter, receiversCount), 'receive')}
                    copiedChartId={copiedPlayerChart}
                    onCopy={handleCopyPlayerEmbed}
                  />
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
            <GitCompareArrows className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="headline text-[22px] font-bold text-ink mb-2">Compare two teams' seasons</h3>
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
