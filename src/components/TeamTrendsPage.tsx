import React, { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, Award, AlertCircle, Info, Flame, Ruler, Copy, Check } from 'lucide-react';
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
import logo from '../assets/graphing-cfb-logo-2.png';

const TeamTrendsPage: React.FC = () => {
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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [copiedPlayerChart, setCopiedPlayerChart] = useState<string | null>(null);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    email: '',
    message: ''
  });

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

  const handleContactFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingContact(true);

    try {
      const response = await fetch('https://formspree.io/f/xwpknllo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactFormData)
      });

      if (response.ok) {
        setShowContactModal(false);
        setContactFormData({ email: '', message: '' });
        alert('Message sent successfully! I\'ll get back to you soon.');
      } else {
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSubmittingContact(false);
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
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Mobile: Two rows (Title/Info, then Nav) */}
          {/* Desktop: One row (Title/Subtitle on left, Nav + Info on right) */}
          <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
            {/* Row 1 on mobile, Left side on desktop: Title/Subtitle + Info Button (mobile only) */}
            <div className="flex items-center justify-between sm:justify-start">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
                  Graphing College Football
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 mt-0">
                  Advanced play-by-play metrics<span className="hidden sm:inline"> and visualizations</span>
                </p>
              </div>

              {/* Info Button - visible on mobile only */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="sm:hidden flex items-center justify-center w-10 h-10 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-all duration-200"
                title="About this project"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>

            {/* Row 2 on mobile, Right side on desktop: Navigation Toggle + Info Button (desktop only) */}
            <div className="flex items-center gap-3">
              {/* Navigation Toggle */}
              <div className="flex w-full sm:w-auto border border-neutral-300 rounded-lg overflow-hidden h-10">
                <a
                  href="/games"
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors bg-white text-neutral-700 hover:bg-neutral-50"
                  title="Games"
                >
                  <BarChart3 className="h-5 w-5" />
                  <span>Games</span>
                </a>
                <a
                  href="/ratings"
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors border-l border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  title="SP+ Ratings"
                >
                  <Award className="h-5 w-5" />
                  <span>Ratings</span>
                </a>
                <a
                  href="/trends"
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors border-l border-neutral-300 bg-neutral-200 text-neutral-600 cursor-default"
                  title="Team Trends"
                >
                  <TrendingUp className="h-5 w-5" />
                  <span>Trends</span>
                </a>
              </div>

              {/* Info Button - visible on desktop only */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="hidden sm:flex items-center justify-center w-10 h-10 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-all duration-200"
                title="About this project"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Data Input */}
          <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
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
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900">
                {currentParams.team} - {currentParams.year} Season
              </h2>
              <p className="text-neutral-600">
                Showing {currentParams.selectedGameIds.length} of {seasonGames.length} games
              </p>
            </div>
          )}

          {/* Season Metrics Summary Cards */}
          {chartData && teamColors && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-6 border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Total Plays</p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">
                      {chartData.seasonMetrics.totalPlays}
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: teamColors.light }}
                  >
                    <BarChart3 className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Success Rate</p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">
                      {(chartData.seasonMetrics.successRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: teamColors.light }}
                  >
                    <TrendingUp className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Explosiveness Rate</p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">
                      {(chartData.seasonMetrics.explosivenessRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: teamColors.light }}
                  >
                    <Flame className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Avg Yards/Play</p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">
                      {chartData.seasonMetrics.avgYardsPerPlay.toFixed(1)}
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: teamColors.light }}
                  >
                    <Ruler className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>
            </div>
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
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-6">Player charts</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column - Rushers and Passers stacked */}
                <div className="space-y-6">
                  {/* Top Rushers */}
                  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                      <h3 className="text-lg font-semibold text-neutral-900">
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
                      <h3 className="text-lg font-semibold text-neutral-900">
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
                    <h3 className="text-lg font-semibold text-neutral-900">
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
                <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Select a team and year to view season trends
                </h3>
                <p className="text-neutral-600 max-w-md mx-auto">
                  Choose your team, year, and click "Fetch Season Data" to explore season-wide performance metrics.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-lg font-medium text-neutral-900">About This Project</p>
              <p className="text-sm leading-relaxed max-w-3xl text-neutral-700">
                This tool is the culmination of 10+ years of work! I'm a <a href="https://medium.com/alex-couch-s-portfolio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">product designer</a> by day, and I write an advanced analytics column for <a href="https://rollbamaroll.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">RollBamaRoll.com</a>. I love data viz, and am a big fan of college football from growing up.
              </p>
            </div>

            <div>
              <p className="text-sm mb-5 text-neutral-700">
                If you find this useful, feel free to buy me a coffee to support continued development!
              </p>
              <div className="space-y-3">
                <a
                  href="https://buymeacoffee.com/alexcouch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  ☕ Support this project
                </a>
                <div>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Get in touch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-neutral-900">About This Project</h2>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <p className="leading-relaxed text-neutral-700">
                  This tool is the culmination of 10+ years of work! I'm a{' '}
                  <a href="https://medium.com/alex-couch-s-portfolio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                    product designer
                  </a>
                  {' '}by day, and I write an advanced analytics column for{' '}
                  <a href="https://rollbamaroll.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                    RollBamaRoll.com
                  </a>
                  . I love data visualization, and am a big fan of college football from growing up.
                </p>

                <p className="text-neutral-700">
                  If you find this useful, feel free to buy me a coffee to support continued development!
                </p>

                <div className="pt-2 space-y-3">
                  <a
                    href="https://buymeacoffee.com/alexcouch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    ☕ Support this project
                  </a>
                  <div>
                    <button
                      onClick={() => {
                        setShowInfoModal(false);
                        setShowContactModal(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Get in touch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <form onSubmit={handleContactFormSubmit}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-neutral-900">Get in Touch</h3>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={contactFormData.email}
                    onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-neutral-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={contactFormData.message}
                    onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Your message..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-900 disabled:bg-neutral-400 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {isSubmittingContact ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default TeamTrendsPage;
