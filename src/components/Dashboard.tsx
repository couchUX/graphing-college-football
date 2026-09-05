import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BarChart3, Database, ChevronDown, BookOpen, AlertCircle, Link, Download, TrendingUp, Flame, Ruler } from 'lucide-react';
import GameSelector from './GameSelector';
import ChartsGrid from './ChartsGrid';
import BoxScoreContainer from './BoxScoreContainer';
import AppShell from './AppShell';
import { MetricRow, Metric } from './MetricCard';
import { MetaTags } from './MetaTags';
import { PlayData } from '../types';
import { fetchPlayByPlayData, fetchWinProbabilityData } from '../services/api';
import { fetchPassingPlays, PassingPlay } from '../services/passingApi';
import { processPlayData } from '../utils/metrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { applyAccent } from '../utils/accent';
import { classifyPlayType } from '../utils/playType';
import { track } from '../utils/analytics';
import { useBoxScore } from '../hooks/useBoxScore';
import { useToast } from '../hooks/useToast';
import { createShareableUrl, copyToClipboard } from '../services/urlShortener';
import { playsToCsv, downloadCsv, buildPlaysCsvFilename } from '../utils/playsCsv';

interface GameParams {
  year: number;
  week: number;
  seasonType: string;
  team: string;
  gameId?: string;
}

const Dashboard: React.FC = () => {
  const [plays, setPlays] = useState<PlayData[]>([]);
  const [rawApiData, setRawApiData] = useState<Record<string, any>[]>([]);
  const [winProbabilityData, setWinProbabilityData] = useState<Record<string, any>[]>([]);
  const [passingPlays, setPassingPlays] = useState<PassingPlay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Open by default — it's the thing people scroll down for. Still collapsible.
  const [showAllPlays, setShowAllPlays] = useState<boolean>(true);
  const [showRawPlays, setShowRawPlays] = useState<boolean>(false);
  const [showDataDefinitions, setShowDataDefinitions] = useState<boolean>(false);
  const [selectedTeamColor, setSelectedTeamColor] = useState<string>('default');
  const [selectedOpponentColor, setSelectedOpponentColor] = useState<string>('default');
  const [currentParams, setCurrentParams] = useState<GameParams | null>(null);

  const { showToast: notify } = useToast();

  // Guards against a slower earlier request painting over a newer one when the
  // user switches games quickly.
  const requestRef = useRef(0);

  const opponentTeam =
    plays.find(p => p.offense !== currentParams?.team && p.defense !== currentParams?.team)?.offense ||
    plays.find(p => p.defense !== currentParams?.team)?.defense ||
    'Opponent';

  const { boxScoreData, loading: boxScoreLoading, error: boxScoreError } = useBoxScore(
    currentParams,
    plays,
    opponentTeam
  );

  // getDisplayTeamColors builds a fresh object for custom colors, so these are
  // memoized: otherwise the accent effect below re-ran on every render and
  // rewrote a document-level CSS variable with 16 canvases mounted.
  const teamColors = useMemo(
    () => (currentParams ? getDisplayTeamColors(currentParams.team, selectedTeamColor) : null),
    [currentParams, selectedTeamColor]
  );
  const opponentColors = useMemo(
    () => getDisplayTeamColors(opponentTeam, selectedOpponentColor),
    [opponentTeam, selectedOpponentColor]
  );

  // The selected team's color becomes the page's editorial accent.
  useEffect(() => {
    applyAccent(teamColors ? teamColors.color || teamColors.success : null);
  }, [teamColors]);

  const handleCopyPageLink = async () => {
    if (!currentParams) {
      notify('No game data available to share');
      return;
    }

    const shareableUrl = createShareableUrl({
      year: currentParams.year,
      team: currentParams.team,
      gameId: currentParams.gameId,
      teamColor: selectedTeamColor !== 'default' ? selectedTeamColor : undefined,
      opponentColor: selectedOpponentColor !== 'default' ? selectedOpponentColor : undefined,
    });

    notify((await copyToClipboard(shareableUrl)) ? 'Page link copied to clipboard' : 'Failed to copy link');
  };

  const handleDownloadCsv = () => {
    if (!currentParams || plays.length === 0) return;
    const gameId = plays[0]?.gameId;
    // Raw API plays carry home/away team names (and a wallclock we can use as the
    // game date) so the per-game CSV's home_team/away_team/date columns aren't
    // blank like the season export's.
    const raw = rawApiData[0];
    const games = gameId
      ? [{
          id: gameId,
          season: currentParams.year,
          week: currentParams.week,
          seasonType: currentParams.seasonType,
          startDate: raw?.wallclock || plays[0]?.wallclock || undefined,
          homeTeam: raw?.home,
          awayTeam: raw?.away,
          // The CFBD plays endpoint doesn't carry neutral_site, so this column
          // is left blank rather than silently always-empty from a missing
          // field. Populating it would require a separate /games lookup.
          neutralSite: undefined,
        }]
      : [];
    const weekLabel =
      currentParams.seasonType === 'regular'
        ? `week-${currentParams.week}`
        : `postseason-week-${currentParams.week}`;
    downloadCsv(
      buildPlaysCsvFilename(currentParams.team, currentParams.year, `${weekLabel}-vs-${opponentTeam}`),
      playsToCsv(plays, games)
    );
  };

  // Keep the canonical link in step with the game on screen.
  useEffect(() => {
    document.querySelector('link[rel="canonical"]')?.remove();

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';

    if (currentParams) {
      const params = new URLSearchParams({
        year: String(currentParams.year),
        seasonType: currentParams.seasonType,
        week: String(currentParams.week),
        team: currentParams.team,
      });
      if (currentParams.gameId) params.set('gameId', String(currentParams.gameId));
      if (selectedTeamColor !== 'default') params.set('teamColor', selectedTeamColor);
      if (selectedOpponentColor !== 'default') params.set('opponentColor', selectedOpponentColor);
      canonical.href = `${window.location.origin}${window.location.pathname}?${params}`;
    } else {
      canonical.href = `${window.location.origin}${window.location.pathname}`;
    }

    document.head.appendChild(canonical);
  }, [currentParams, selectedTeamColor, selectedOpponentColor]);

  const handleFetchData = async (params: Omit<GameParams, 'gameId'>) => {
    track('fetch_data', {
      event_category: 'user_interaction',
      event_label: `${params.team}_${params.year}_week${params.week}_${params.seasonType}`,
      custom_parameter_team: params.team,
      custom_parameter_year: params.year,
      custom_parameter_week: params.week,
      custom_parameter_season_type: params.seasonType,
    });

    const requestId = ++requestRef.current;

    setIsLoading(true);
    setError(null);
    // Clear existing data immediately to hide color selectors during team switch
    setPlays([]);
    setRawApiData([]);
    setWinProbabilityData([]);
    setPassingPlays([]);

    const gameId = new URLSearchParams(window.location.search).get('gameId');
    setCurrentParams({ ...params, gameId: gameId || undefined });

    try {
      // Passing data is a bonus, not a dependency: an older season may have no
      // charted attempts at all, and the rest of the page must still render.
      const [apiPlays, winProbData, passes] = await Promise.all([
        fetchPlayByPlayData({ ...params, gameId: gameId || undefined }),
        gameId ? fetchWinProbabilityData(gameId) : Promise.resolve([]),
        fetchPassingPlays({ year: params.year, team: params.team, gameId: gameId || undefined }).catch(
          (err) => {
            console.warn('Passing data unavailable for this game:', err);
            return [] as PassingPlay[];
          }
        ),
      ]);

      // A newer request started while this one was in flight — drop the result.
      if (requestId !== requestRef.current) return;

      setRawApiData(apiPlays);
      setWinProbabilityData(winProbData);
      setPassingPlays(passes);
      setPlays(processPlayData(apiPlays));
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError('Failed to load play data. Please check your parameters and try again.');
      setPlays([]);
      setRawApiData([]);
      setWinProbabilityData([]);
      setPassingPlays([]);
      console.error('Error loading data:', err);
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  };

  // Plays are already filtered to rush/pass in processPlayData
  const sortedRawApiData = useMemo(
    () => [...rawApiData].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    [rawApiData]
  );

  const teamPlays = plays.filter(p => p.offense === currentParams?.team);
  const opponentPlays = plays.filter(p => p.offense === opponentTeam);

  const buildMetrics = (
    sidePlays: PlayData[],
    colors: { light: string; colorDark?: string; explosive: string }
  ): Metric[] => {
    const total = sidePlays.length;
    const rate = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0.0%');
    const iconBg = colors.light;
    const iconColor = colors.colorDark || colors.explosive;
    return [
      { label: 'Total plays', value: total, icon: <BarChart3 className="h-5 w-5" />, iconBg, iconColor },
      { label: 'Success rate', value: rate(sidePlays.filter(p => p.success).length), icon: <TrendingUp className="h-5 w-5" />, iconBg, iconColor },
      { label: 'Explosiveness rate', value: rate(sidePlays.filter(p => p.explosiveness).length), icon: <Flame className="h-5 w-5" />, iconBg, iconColor },
      {
        label: 'Avg yards/play',
        value: total > 0 ? (sidePlays.reduce((sum, p) => sum + p.yardsGained, 0) / total).toFixed(1) : '0.0',
        icon: <Ruler className="h-5 w-5" />,
        iconBg,
        iconColor,
      },
    ];
  };

  const hasGame = plays.length > 0 && currentParams;

  /**
   * Game date for the subtitle. The plays endpoint has no kickoff field, so
   * this comes from the first play's wallclock — accurate to the day, which is
   * all the subtitle shows. Falls back to the season year if it's missing.
   */
  const gameDateLabel = (() => {
    const wallclock = rawApiData[0]?.wallclock || plays[0]?.wallclock;
    if (wallclock) {
      const date = new Date(wallclock);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    return currentParams ? String(currentParams.year) : '';
  })();

  return (
    <>
      <MetaTags
        title="Games - Graphing College Football"
        description="Advanced college football analytics dashboard featuring success rate, explosiveness, play-by-play analysis, and interactive charts for every CFB team and game."
        image="https://cfb-adv-metrics-dashboard.vercel.app/gcf_games_open-graph.jpg"
        url="https://cfb-adv-metrics-dashboard.vercel.app/games"
      />
      <AppShell current="games">
        {/* Game picker */}
        <div className="mb-7 border-b border-hairline pb-6 sm:mb-8">
          <GameSelector
            onFetchData={handleFetchData}
            isLoading={isLoading}
            selectedTeamColor={selectedTeamColor}
            setSelectedTeamColor={setSelectedTeamColor}
            selectedOpponentColor={selectedOpponentColor}
            setSelectedOpponentColor={setSelectedOpponentColor}
            currentParams={currentParams}
            opponentTeam={opponentTeam}
            hasDataBeenFetched={plays.length > 0}
          />
        </div>

        {hasGame && (
          <div className="mb-8">
            {/* Matchup headline */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="headline text-[30px] leading-tight text-ink sm:text-[34px]">
                  {currentParams.team}
                  <span className="text-neutral-400"> vs. </span>
                  {opponentTeam}
                </h2>
                <p className="mt-1 text-sm text-byline">
                  {gameDateLabel} · Week {currentParams.week} ·{' '}
                  {currentParams.seasonType === 'regular' ? 'Regular season' : 'Postseason'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPageLink}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-byline transition-colors hover:border-neutral-400 hover:text-ink"
                  title="Copy short link to this page"
                  aria-label="Copy short link to this page"
                >
                  <Link className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="flex h-9 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-ink"
                  title="Download this game's plays as a CSV file"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download CSV</span>
                </button>
              </div>
            </div>

            {/* Headline stats, both teams */}
            {teamColors && (
              <div className="mt-7 space-y-6">
                <MetricRow
                  title={currentParams.team}
                  // Team names are set as text, so they take the darker variant.
                  titleColor={teamColors.colorDark || teamColors.explosive}
                  metrics={buildMetrics(teamPlays, teamColors)}
                />
                <MetricRow
                  title={opponentTeam}
                  titleColor={opponentColors.colorDark || opponentColors.explosive}
                  metrics={buildMetrics(opponentPlays, opponentColors)}
                />
              </div>
            )}
          </div>
        )}

        {/* Box score */}
        {boxScoreData && (
          <div className="mt-8">
            <BoxScoreContainer
              firstTableStats={boxScoreData.firstTableStats}
              secondTableStats={boxScoreData.secondTableStats}
              team1Name={boxScoreData.team1Name}
              team2Name={boxScoreData.team2Name}
              selectedTeamColor={selectedTeamColor}
              selectedOpponentColor={selectedOpponentColor}
              onCopyEmbed={notify}
              currentParams={currentParams}
              plays={plays}
            />
          </div>
        )}

        {boxScoreLoading && currentParams && (
          <div className="plate mt-8 p-5">
            <h2 className="headline text-[20px] font-bold text-ink">Box score</h2>
            <p className="mt-3 text-sm text-byline">Loading box score…</p>
          </div>
        )}

        {boxScoreError && currentParams && plays.length > 0 && (
          <div className="plate mt-8 p-5">
            <h2 className="headline text-[20px] font-bold text-ink">Box score</h2>
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {boxScoreError}
            </p>
          </div>
        )}

        {/* Charts */}
        {hasGame && (
          <ChartsGrid
            plays={plays}
            team={currentParams.team}
            selectedTeamColor={selectedTeamColor}
            selectedOpponentColor={selectedOpponentColor}
            currentParams={currentParams}
            winProbabilityData={winProbabilityData}
            rawApiData={rawApiData}
            passingPlays={passingPlays}
          />
        )}

        {/* Reference material */}
        {hasGame && (
          <div className="rule-section space-y-4">
            <section className="plate">
              <button
                onClick={() => setShowDataDefinitions(!showDataDefinitions)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
                aria-expanded={showDataDefinitions}
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="h-[18px] w-[18px] text-byline" />
                  <span className="headline text-[17px] font-bold text-ink">Definitions and notes</span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-none text-byline transition-transform ${showDataDefinitions ? 'rotate-180' : ''}`}
                />
              </button>

              {showDataDefinitions && (
                <div className="grid grid-cols-1 gap-x-10 gap-y-8 border-t border-hairline px-4 py-6 lg:grid-cols-2 sm:px-5">
                  <div>
                    <h3 className="headline text-[18px] font-bold text-ink">Data definitions</h3>
                    <dl className="mt-4 space-y-4 text-[15px] leading-relaxed">
                      <div>
                        <dt className="font-semibold text-ink">Analytics foundation</dt>
                        <dd className="text-neutral-700">
                          This analysis is based roughly on the{' '}
                          <a
                            href="https://www.sbnation.com/college-football/2017/10/13/16457830/college-football-advanced-stats-analytics-rankings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline underline-offset-2"
                          >
                            SP+ analytic system
                          </a>
                          , which provides a foundation for evaluating team performance through success rate and
                          explosiveness metrics.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Success rate (SR)</dt>
                        <dd className="text-neutral-700">
                          The percentage of plays that gain enough yards to be considered successful, based on down
                          and distance: 50% of needed yards on 1st down, 70% on 2nd, and 100% on 3rd and 4th.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Explosiveness rate (XR)</dt>
                        <dd className="text-neutral-700">
                          The percentage of plays that gain more than 15 yards, regardless of down and distance —
                          the big plays that can change the momentum of a game.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Rush rate (RR)</dt>
                        <dd className="text-neutral-700">
                          The percentage of offensive plays that are rushing attempts versus passing attempts. A 50%
                          rush rate indicates a perfectly balanced offense.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Cumulative metrics</dt>
                        <dd className="text-neutral-700">
                          Charts showing cumulative data display running averages that update after each play,
                          showing how team performance evolves throughout the game.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Red zone</dt>
                        <dd className="text-neutral-700">
                          The area of the field within 20 yards of the opponent&apos;s goal line. Success rates often
                          change dramatically here due to the compressed field.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Play types</dt>
                        <dd className="text-neutral-700">
                          Rush covers any designed running play or quarterback scramble. Pass covers any forward pass
                          attempt, including completions, incompletions and sacks — unlike traditional statistics,
                          sacks are counted as pass attempts with negative yardage rather than rushes.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Excluded plays</dt>
                        <dd className="text-neutral-700">
                          Penalties that result in no play are excluded, as are all special teams plays (punts,
                          kickoffs, field goals), extra points and two-point conversions.
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="headline text-[18px] font-bold text-ink">Notes</h3>
                    <dl className="mt-4 space-y-4 text-[15px] leading-relaxed">
                      <div>
                        <dt className="font-semibold text-ink">Data accuracy</dt>
                        <dd className="text-neutral-700">
                          There may be occasional errors in the charts as data is pulled from play-by-play records,
                          which vary slightly between stadiums and can be subject to human error when recorded.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">NCAA average reference line</dt>
                        <dd className="text-neutral-700">
                          The average success rate changes year over year but tends to hover around 42–43%. This
                          benchmark is marked on most charts as a dashed line.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Team color conflicts</dt>
                        <dd className="text-neutral-700">
                          Having trouble distinguishing between opponents with similar colors? Use the team color
                          override controls in the team selection area up top.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Explosive plays visualization</dt>
                        <dd className="text-neutral-700">
                          Bar charts display explosive plays as a subset of successful plays for visual clarity, even
                          though rare edge cases exist where an explosive play might not meet success criteria (for
                          example, gaining 17 yards on 4th and 20). This affects less than 1% of plays.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Drive chart play counts</dt>
                        <dd className="text-neutral-700">
                          Drive charts use a secondary Y-axis to show the number of plays per drive while maintaining
                          the 0–100% scale for success and explosiveness rates.
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Embed buttons</dt>
                        <dd className="text-neutral-700">
                          Each chart has an embed button that generates HTML you can paste into other websites or
                          services like WordPress and blog posts, keeping the chart interactive.
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}
            </section>

            <section className="plate">
              <button
                onClick={() => setShowAllPlays(!showAllPlays)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
                aria-expanded={showAllPlays}
              >
                <span className="flex items-center gap-2.5">
                  <Database className="h-[18px] w-[18px] text-byline" />
                  <span className="headline text-[17px] font-bold text-ink">All plays data</span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-none text-byline transition-transform ${showAllPlays ? 'rotate-180' : ''}`}
                />
              </button>

              {showAllPlays && (
                <div className="space-y-5 border-t border-hairline px-4 py-5 sm:px-5">
                  <div className="rounded-lg border border-hairline bg-neutral-50 p-3">
                    <button
                      onClick={() => setShowRawPlays(!showRawPlays)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                      aria-expanded={showRawPlays}
                    >
                      <span className="text-[15px] font-semibold text-ink">
                        Raw API plays ({rawApiData.length} total)
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 flex-none text-byline transition-transform ${showRawPlays ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showRawPlays && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <h4 className="mb-2 text-sm font-medium text-neutral-700">
                            Sample (first play, to check field names)
                          </h4>
                          <div className="max-h-48 overflow-auto rounded-lg border border-hairline bg-surface p-3">
                            <pre className="text-xs text-neutral-700">
                              {JSON.stringify(rawApiData[0] || {}, null, 2)}
                            </pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-medium text-neutral-700">Complete table</h4>
                          <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
                            <div className="max-h-96 overflow-auto">
                              <table className="min-w-full divide-y divide-hairline text-sm">
                                <thead className="sticky top-0 bg-neutral-100">
                                  <tr>
                                    {['ID', 'Drive', 'Play in drive', 'Quarter', 'Down', 'Distance', 'Offense', 'Defense', 'Play type', 'Yards', 'Play text'].map(h => (
                                      <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-byline">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                  {sortedRawApiData.map((play, index) => (
                                    <tr key={play.id || index} className={index % 2 === 0 ? 'bg-surface' : 'bg-neutral-50'}>
                                      <td className="whitespace-nowrap px-3 py-2">{play.id || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.drive_number || play.driveNumber || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.play_number || play.playNumber || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.quarter || play.period || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.down || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.distance || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.offense || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.defense || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">{play.play_type || play.playType || '—'}</td>
                                      <td className="whitespace-nowrap px-3 py-2">
                                        {play.yards_gained ?? play.yardsGained ?? '—'}
                                      </td>
                                      <td className="max-w-2xl truncate px-3 py-2" title={play.play_text || play.playText || ''}>
                                        {play.play_text || play.playText || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-[15px] font-semibold text-ink">
                      Processed plays — rush and pass only, with player names ({plays.length} total)
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
                      <div className="max-h-[456px] overflow-auto">
                        <table className="min-w-full divide-y divide-hairline text-sm">
                          <thead className="sticky top-0 bg-neutral-100">
                            <tr>
                              {['Play #', 'Team play #', 'ID', 'Drive', 'Play in drive', 'Quarter', 'Down', 'Distance', 'Offense', 'Defense', 'Play type', 'Rusher', 'Passer', 'Receiver', 'Yards', 'Success', 'Explosive', 'Team SR', 'Team XR', 'Rush rate', 'Rush SR', 'Pass SR', 'Play text'].map(h => (
                                <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-byline">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline">
                            {plays.map((play, index) => (
                              <tr key={play.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-neutral-50'}>
                                <td className="whitespace-nowrap px-3 py-2">{play.playNumber}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.teamPlayNumber}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.id}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.driveNumber}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.playInDrive}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.quarter}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.down}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.distance}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.offense}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.defense}</td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-neutral-700">
                                    {classifyPlayType(play.playType)}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">{play.rusher || '—'}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.passer || '—'}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.receiver || '—'}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.yardsGained}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.success ? 'Yes' : 'No'}</td>
                                <td className="whitespace-nowrap px-3 py-2">{play.explosiveness ? 'Yes' : 'No'}</td>
                                <td className="whitespace-nowrap px-3 py-2">{(play.teamCumulativeSR * 100).toFixed(1)}%</td>
                                <td className="whitespace-nowrap px-3 py-2">{(play.teamCumulativeXR * 100).toFixed(1)}%</td>
                                <td className="whitespace-nowrap px-3 py-2">{(play.teamCumulativeRushRate * 100).toFixed(1)}%</td>
                                <td className="whitespace-nowrap px-3 py-2">{(play.teamRushCumulativeSR * 100).toFixed(1)}%</td>
                                <td className="whitespace-nowrap px-3 py-2">{(play.teamPassCumulativeSR * 100).toFixed(1)}%</td>
                                <td className="max-w-2xl truncate px-3 py-2" title={play.playText}>
                                  {play.playText}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {plays.length === 0 && !isLoading && (
          <div className="plate px-6 py-16 text-center">
            {currentParams ? (
              <>
                <AlertCircle className="mx-auto mb-4 h-9 w-9 text-neutral-400" />
                <h3 className="headline text-[22px] font-bold text-ink">No data available for this game</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-byline">
                  We couldn&apos;t find play-by-play data for {currentParams.team} in{' '}
                  {currentParams.seasonType === 'regular'
                    ? `Week ${currentParams.week}`
                    : `postseason week ${currentParams.week}`}
                  , {currentParams.year}.
                  {error
                    ? ' There was an error retrieving the data.'
                    : ' This game may not have occurred yet, or data may not be available.'}
                </p>
              </>
            ) : (
              <>
                <BarChart3 className="mx-auto mb-4 h-9 w-9 text-neutral-400" />
                <h3 className="headline text-[22px] font-bold text-ink">Find a game to load the charts</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-byline">
                  Pick a year, team and game above, then load it to start exploring the play-by-play analytics.
                </p>
              </>
            )}
          </div>
        )}
      </AppShell>

    </>
  );
};

export default Dashboard;
