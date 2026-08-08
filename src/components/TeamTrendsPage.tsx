import React, { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertCircle, Flame, Ruler, Copy, Check, Download } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import SeasonSelector from './SeasonSelector';
import TrendsChartsGrid from './TrendsChartsGrid';
import SeasonAdvancedBoxScore from './SeasonAdvancedBoxScore';
import { MetaTags } from './MetaTags';
import { PlayData } from '../types';
import { TeamGame, ApiPlayData } from '../services/api';
import { Game as BoxScoreGame } from '../services/boxScoreApi';
import { fetchSeasonPlayByPlayData, fetchSeasonBoxScores } from '../services/seasonApi';
import { processPlayData } from '../utils/metrics';
import { useSeasonChartData } from '../hooks/useSeasonChartData';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { createPlayerData } from '../utils/chartHelpers';
import { generateTrendsEmbedCode } from '../utils/trendsEmbedGenerator';
import { createPlayerOptions } from '../utils/chartOptions';
import { calculateAveragedBoxScore, BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { playsToCsv, downloadCsv, buildPlaysCsvFilename } from '../utils/playsCsv';
import MultiYearSpTrends from './MultiYearSpTrends';
import TeamCompareView from './TeamCompareView';
import AppShell from './AppShell';
import { MetricRow } from './MetricCard';
import SubTabs from './SubTabs';
import { readParams, writeParams } from '../utils/trendsUrl';

type TrendsView = 'season' | 'spTrends' | 'compare';

const TRENDS_TABS: { id: TrendsView; label: string }[] = [
  { id: 'season', label: 'Season trends' },
  { id: 'compare', label: 'Team vs. Team' },
  { id: 'spTrends', label: 'Multi-year SP+' },
];

const TeamTrendsPage: React.FC = () => {
  const [trendsView, setTrendsView] = useState<TrendsView>(() => {
    const v = readParams().get('view');
    return v === 'compare' || v === 'spTrends' ? v : 'season';
  });

  // Persist the active sub-tab in the URL (omit for the default 'season').
  const handleViewChange = (view: TrendsView) => {
    setTrendsView(view);
    writeParams({ view: view === 'season' ? null : view });
  };
  const [seasonGames, setSeasonGames] = useState<TeamGame[]>([]);
  const [allSeasonPlays, setAllSeasonPlays] = useState<PlayData[]>([]);
  const [perGamePlays, setPerGamePlays] = useState<Map<number, PlayData[]>>(new Map());
  const [boxScores, setBoxScores] = useState<BoxScoreGame[]>([]);
  const [boxScoreMode, setBoxScoreMode] = useState<BoxScoreMode>('averages');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [loadingBoxScores, setLoadingBoxScores] = useState<boolean>(false);
  const [boxScoreProgress, setBoxScoreProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [failedGames, setFailedGames] = useState<number[]>([]);
  const [selectedTeamColor, setSelectedTeamColor] = useState<string>('default');
  const [currentParams, setCurrentParams] = useState<{
    year: number;
    team: string;
    selectedGameIds: number[];
  } | null>(null);
  const [copiedPlayerChart, setCopiedPlayerChart] = useState<string | null>(null);

  const handleFetchSeasonData = async (params: {
    year: number;
    team: string;
    selectedGameIds: number[];
  }) => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: 0 });
    setBoxScoreProgress({ current: 0, total: 0 });
    setCurrentParams(params);

    try {
      // Fetch season data with progress tracking
      const result = await fetchSeasonPlayByPlayData(
        params,
        (current, total) => setLoadingProgress({ current, total })
      );

      // Process all plays
      const processedPlays = processPlayData(result.allPlays);

      // Process plays per game
      const processedPerGamePlays = new Map<number, PlayData[]>();
      result.perGamePlays.forEach((apiPlays: ApiPlayData[], gameId: number) => {
        const processed = processPlayData(apiPlays);
        processedPerGamePlays.set(gameId, processed);
      });

      setSeasonGames(result.games);
      setAllSeasonPlays(processedPlays);
      setPerGamePlays(processedPerGamePlays);
      setFailedGames(result.failedGames);

      // Fetch box scores for all games
      setLoadingBoxScores(true);
      const boxScoreResult = await fetchSeasonBoxScores(
        result.games,
        params.team,
        (current, total) => setBoxScoreProgress({ current, total })
      );
      setBoxScores(boxScoreResult.boxScores);
      setLoadingBoxScores(false);

      // Track successful fetch in Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'season_data_fetch', {
          'event_category': 'user_interaction',
          'event_label': `${params.team}_${params.year}_${params.selectedGameIds.length}_games`,
          'custom_parameter_team': params.team,
          'custom_parameter_year': params.year,
          'custom_parameter_games_selected': params.selectedGameIds.length,
          'custom_parameter_games_fetched': result.games.length - result.failedGames.length
        });
      }
    } catch (err) {
      setError('Failed to load season data. Please try again.');
      console.error('Error fetching season data:', err);
      setLoadingBoxScores(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle copy embed for player charts
  const handleCopyPlayerEmbed = async (
    chartId: string,
    title: string,
    data: any
  ) => {
    if (!currentParams) return;

    setCopiedPlayerChart(chartId);

    try {
      const embedCode = generateTrendsEmbedCode(
        chartId,
        title,
        data,
        'bar',
        currentParams.team,
        currentParams.year,
        seasonGames.length,
        selectedTeamColor
      );

      await navigator.clipboard.writeText(embedCode);

      setTimeout(() => {
        setCopiedPlayerChart(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy player chart embed code:', err);
      setCopiedPlayerChart(null);
    }
  };

  const handleDownloadCsv = () => {
    if (!currentParams || allSeasonPlays.length === 0) return;
    const csv = playsToCsv(allSeasonPlays, seasonGames);
    downloadCsv(buildPlaysCsvFilename(currentParams.team, currentParams.year), csv);
  };

  // Get chart data (hooks must be called unconditionally)
  const chartData = useSeasonChartData(
    allSeasonPlays,
    perGamePlays,
    seasonGames,
    currentParams?.team || '',
    selectedTeamColor
  );

  // Get team colors for summary cards
  const teamColors = currentParams ? getDisplayTeamColors(currentParams.team, selectedTeamColor) : null;

  // Get player options for charts
  const playerOptions = createPlayerOptions();

  // Calculate averaged box score
  const averagedBoxScore = useMemo(() => {
    if (!currentParams || boxScores.length === 0) return null;
    return calculateAveragedBoxScore(boxScores, currentParams.team, boxScoreMode);
  }, [boxScores, currentParams, boxScoreMode]);

  // Update canonical URL when params or colors change
  useEffect(() => {
    // Remove existing canonical tag if present
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }

    // Create new canonical URL based on current state
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';

    if (currentParams) {
      // Build URL with current parameters
      const params = new URLSearchParams();
      params.set('year', currentParams.year.toString());
      params.set('team', currentParams.team);

      // Use indices for games - match what's in the URL
      // Only add 'games' parameter if not all games are selected (default is all)
      if (currentParams.selectedGameIds.length > 0 && seasonGames.length > 0) {
        const allGameIds = seasonGames.map(g => g.id);
        const selectedIndices = currentParams.selectedGameIds
          .map(id => allGameIds.indexOf(id))
          .filter(index => index !== -1)
          .sort((a, b) => a - b);

        // Only include games parameter when specific games are selected (not all)
        if (selectedIndices.length !== seasonGames.length) {
          params.set('games', selectedIndices.join(','));
        }
      }

      if (selectedTeamColor !== 'default') {
        params.set('teamColor', selectedTeamColor);
      }
      canonical.href = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    } else {
      // Default to base URL if no params
      canonical.href = `${window.location.origin}${window.location.pathname}`;
    }

    document.head.appendChild(canonical);
  }, [currentParams, selectedTeamColor, seasonGames]);

  return (
    <>
      <MetaTags
        title="Team Trends - Graphing College Football"
        description="Track college football team performance trends across entire seasons with advanced metrics, success rate trends, explosiveness charts, and comprehensive season analytics."
        image="https://cfb-adv-metrics-dashboard.vercel.app/gcf_team-trends_open-graph.jpg"
        url="https://cfb-adv-metrics-dashboard.vercel.app/trends"
      />
      <AppShell current="trends">
        <div>
          <SubTabs
            items={TRENDS_TABS}
            value={trendsView}
            onChange={handleViewChange}
            label="Team Trends views"
            className="mb-6 sm:mb-7"
          />

          {trendsView === 'season' && (
            <>
          {/* Data Input */}
          <div className="config-panel mb-7 sm:mb-8">
            <SeasonSelector
              onFetchData={handleFetchSeasonData}
              isLoading={isLoading}
              loadingProgress={loadingProgress}
              selectedTeamColor={selectedTeamColor}
              setSelectedTeamColor={setSelectedTeamColor}
            />
          </div>

          {/* Failed Games Warning */}
          {failedGames.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-900 font-medium">
                  Warning: {failedGames.length} game(s) failed to load
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  Showing {seasonGames.length - failedGames.length} of {seasonGames.length} games.
                  Some data may be incomplete.
                </p>
              </div>
            </div>
          )}

          {/* Season Info Banner */}
          {chartData && currentParams && (
            <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="headline text-[26px] text-ink">
                  {currentParams.team} - {currentParams.year} Season
                </h2>
                <p className="text-neutral-600">
                  Showing {currentParams.selectedGameIds.length} of {seasonGames.length} games
                </p>
              </div>
              {allSeasonPlays.length > 0 && (
                <button
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors self-start"
                  title="Download all plays as a CSV file"
                >
                  <Download className="h-4 w-4" />
                  <span>Download plays CSV</span>
                </button>
              )}
            </div>
          )}

          {/* Season summary */}
          {chartData && teamColors && (
            <MetricRow
              className="mb-8"
              metrics={[
                {
                  label: 'Total plays',
                  value: chartData.seasonMetrics.totalPlays,
                  icon: <BarChart3 className="h-5 w-5" />,
                  iconBg: teamColors.light,
                  iconColor: teamColors.colorDark || teamColors.explosive,
                },
                {
                  label: 'Success rate',
                  value: `${(chartData.seasonMetrics.successRate * 100).toFixed(1)}%`,
                  icon: <TrendingUp className="h-5 w-5" />,
                  iconBg: teamColors.light,
                  iconColor: teamColors.colorDark || teamColors.explosive,
                },
                {
                  label: 'Explosiveness rate',
                  value: `${(chartData.seasonMetrics.explosivenessRate * 100).toFixed(1)}%`,
                  icon: <Flame className="h-5 w-5" />,
                  iconBg: teamColors.light,
                  iconColor: teamColors.colorDark || teamColors.explosive,
                },
                {
                  label: 'Avg yards/play',
                  value: chartData.seasonMetrics.avgYardsPerPlay.toFixed(1),
                  icon: <Ruler className="h-5 w-5" />,
                  iconBg: teamColors.light,
                  iconColor: teamColors.colorDark || teamColors.explosive,
                },
              ]}
            />
          )}

          {/* Advanced Box Score */}
          {averagedBoxScore && currentParams && (
            <SeasonAdvancedBoxScore
              team={currentParams.team}
              year={currentParams.year}
              firstTableStats={averagedBoxScore.firstTableStats}
              secondTableStats={averagedBoxScore.secondTableStats}
              selectedTeamColor={selectedTeamColor}
              gamesCount={boxScores.length}
              mode={boxScoreMode}
              onModeChange={setBoxScoreMode}
            />
          )}

          {/* Box Score Loading State */}
          {loadingBoxScores && (
            <div className="mb-8 bg-neutral-100 border border-neutral-300 rounded-lg p-6">
              <p className="text-neutral-700 font-medium">
                Loading box scores... ({boxScoreProgress.current}/{boxScoreProgress.total})
              </p>
            </div>
          )}

          {/* Charts Grid */}
          {chartData && currentParams && (
            <TrendsChartsGrid
              chartData={chartData}
              team={currentParams.team}
              year={currentParams.year}
              gamesCount={seasonGames.length}
              selectedTeamColor={selectedTeamColor}
            />
          )}

          {/* Player Charts Section */}
          {chartData && chartData.topRushers && chartData.topPassers && chartData.topReceivers && (
            <div>
              <h2 className="rule-section headline mb-6 text-[22px] text-ink">Player charts</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column - Rushers and Passers stacked */}
                <div className="space-y-6">
                  {/* Top Rushers */}
                  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                      <h3 className="headline text-[20px] font-bold text-ink">
                        Top rushers
                      </h3>
                      <button
                        onClick={() => handleCopyPlayerEmbed('top-rushers', 'Top Rushers', createPlayerData(chartData.topRushers, 'rush'))}
                        className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                          copiedPlayerChart === 'top-rushers'
                            ? 'border-green-300 bg-green-50'
                            : 'border-neutral-300 hover:bg-neutral-50'
                        }`}
                        title={copiedPlayerChart === 'top-rushers' ? "Copied!" : "Copy embed code"}
                      >
                        {copiedPlayerChart === 'top-rushers' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-neutral-600" />
                        )}
                      </button>
                    </div>
                    <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                      <div className="h-80">
                        <Bar data={createPlayerData(chartData.topRushers, 'rush') as any} options={playerOptions} />
                      </div>
                    </div>
                  </div>

                  {/* Top Passers */}
                  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                      <h3 className="headline text-[20px] font-bold text-ink">
                        Top passers
                      </h3>
                      <button
                        onClick={() => handleCopyPlayerEmbed('top-passers', 'Top Passers', createPlayerData(chartData.topPassers, 'pass'))}
                        className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                          copiedPlayerChart === 'top-passers'
                            ? 'border-green-300 bg-green-50'
                            : 'border-neutral-300 hover:bg-neutral-50'
                        }`}
                        title={copiedPlayerChart === 'top-passers' ? "Copied!" : "Copy embed code"}
                      >
                        {copiedPlayerChart === 'top-passers' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-neutral-600" />
                        )}
                      </button>
                    </div>
                    <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
                      <div className="h-50" style={{ height: '200px' }}>
                        <Bar data={createPlayerData(chartData.topPassers, 'pass') as any} options={playerOptions} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column - Receivers spanning full height */}
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <h3 className="headline text-[20px] font-bold text-ink">
                      Top receivers
                    </h3>
                    <button
                      onClick={() => handleCopyPlayerEmbed('top-receivers', 'Top Receivers', createPlayerData(chartData.topReceivers, 'receive'))}
                      className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                        copiedPlayerChart === 'top-receivers'
                          ? 'border-green-300 bg-green-50'
                          : 'border-neutral-300 hover:bg-neutral-50'
                      }`}
                      title={copiedPlayerChart === 'top-receivers' ? "Copied!" : "Copy embed code"}
                    >
                      {copiedPlayerChart === 'top-receivers' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-neutral-600" />
                      )}
                    </button>
                  </div>
                  <div className="pt-5 px-6 pb-6 sm:pt-5 sm:px-6 sm:pb-6">
                    <div className="h-[640px]">
                      <Bar data={createPlayerData(chartData.topReceivers, 'receive') as any} options={playerOptions} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-900 font-medium">Error loading season data</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!chartData && !isLoading && !error && (
            <div className="text-center py-8">
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-16">
                <TrendingUp className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
                <h3 className="headline text-[22px] font-bold text-ink mb-2">
                  Select a team and year to view season trends
                </h3>
                <p className="text-neutral-600 max-w-md mx-auto">
                  Choose your team, year, and click "Fetch Season Data" to explore season-wide performance metrics.
                </p>
              </div>
            </div>
          )}
            </>
          )}

          {trendsView === 'spTrends' && <MultiYearSpTrends />}

          {trendsView === 'compare' && <TeamCompareView />}
        </div>
      </AppShell>
    </>
  );
};

export default TeamTrendsPage;
