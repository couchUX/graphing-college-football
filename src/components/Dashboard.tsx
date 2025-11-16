import React, { useState, useEffect } from 'react';
import { BarChart3, Database, ChevronDown, BookOpen, Flame, Ruler, Settings, Info, AlertCircle, Link } from 'lucide-react';
import GameSelector from './GameSelector';
import ChartsGrid from './ChartsGrid';
import BoxScoreContainer from './BoxScoreContainer';
import Toast from './Toast';
import { PlayData } from '../types';
import { fetchPlayByPlayData, fetchWinProbabilityData } from '../services/api';
import { processPlayData } from '../utils/metrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { useBoxScore } from '../hooks/useBoxScore';
import { createShareableUrl, copyToClipboard } from '../services/urlShortener';
import logo from '../assets/graphing-cfb-logo-2.png';

const Dashboard: React.FC = () => {
  const [plays, setPlays] = useState<PlayData[]>([]);
  const [rawApiData, setRawApiData] = useState<any[]>([]);
  const [winProbabilityData, setWinProbabilityData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllPlays, setShowAllPlays] = useState<boolean>(false);
  const [showRawPlays, setShowRawPlays] = useState<boolean>(false);
  const [showDataDefinitions, setShowDataDefinitions] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState<boolean>(false);
  const [selectedTeamColor, setSelectedTeamColor] = useState<string>('default');
  const [selectedOpponentColor, setSelectedOpponentColor] = useState<string>('default');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [currentParams, setCurrentParams] = useState<{
    year: number;
    week: number;
    seasonType: string;
    team: string;
    gameId?: string;
  } | null>(null);

  // Toast handler for embed copying
  const handleCopyEmbed = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  // Handler for copying page link
  const handleCopyPageLink = async () => {
    if (!currentParams) {
      setToastMessage('No game data available to share');
      setShowToast(true);
      return;
    }

    const params = {
      year: currentParams.year,
      team: currentParams.team,
      gameId: currentParams.gameId,
      teamColor: selectedTeamColor !== 'default' ? selectedTeamColor : undefined,
      opponentColor: selectedOpponentColor !== 'default' ? selectedOpponentColor : undefined
    };

    const shareableUrl = createShareableUrl(params);
    const success = await copyToClipboard(shareableUrl);

    if (success) {
      setToastMessage('Page link copied to clipboard!');
    } else {
      setToastMessage('Failed to copy link');
    }

    setShowToast(true);
  };

  // Contact form handlers
  const handleContactFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContactFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmittingContact) return;
    
    setIsSubmittingContact(true);
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm),
      });

      const result = await response.json();

      if (response.ok) {
        // Success
        setContactForm({ name: '', email: '', message: '' });
        setShowContactModal(false);
        setToastMessage('Message sent successfully! I\'ll get back to you soon.');
        setShowToast(true);
      } else {
        // Server returned an error
        setToastMessage(result.error || 'Failed to send message. Please try again.');
        setShowToast(true);
      }
    } catch (error) {
      // Network or other error
      console.error('Contact form error:', error);
      setToastMessage('Failed to send message. Please try again later.');
      setShowToast(true);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Dynamic canonical URL management
  useEffect(() => {
    // Remove existing canonical link
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
      params.set('seasonType', currentParams.seasonType);
      params.set('week', currentParams.week.toString());
      params.set('team', currentParams.team);
      if (currentParams.gameId) {
        params.set('gameId', currentParams.gameId.toString());
      }
      if (selectedTeamColor !== 'default') {
        params.set('teamColor', selectedTeamColor);
      }
      if (selectedOpponentColor !== 'default') {
        params.set('opponentColor', selectedOpponentColor);
      }
      canonical.href = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    } else {
      // Default to base URL if no params
      canonical.href = `${window.location.origin}${window.location.pathname}`;
    }
    
    document.head.appendChild(canonical);
  }, [currentParams, selectedTeamColor, selectedOpponentColor]);

  // Box score hook
  // Get opponent team
  const opponentTeam = plays.find(p => p.offense !== currentParams?.team && p.defense !== currentParams?.team)?.offense || 
                      plays.find(p => p.defense !== currentParams?.team)?.defense || 'Opponent';

  const { boxScoreData, loading: boxScoreLoading, error: boxScoreError } = useBoxScore(currentParams, plays, opponentTeam);

  const handleFetchData = async (params: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
  }) => {
    // Track Google Analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'fetch_data', {
        'event_category': 'user_interaction',
        'event_label': `${params.team}_${params.year}_week${params.week}_${params.seasonType}`,
        'custom_parameter_team': params.team,
        'custom_parameter_year': params.year,
        'custom_parameter_week': params.week,
        'custom_parameter_season_type': params.seasonType
      });
    }
    
    setIsLoading(true);
    setError(null);
    
    // Clear existing data immediately to hide color selectors during team switch
    setPlays([]);
    setRawApiData([]);
    setWinProbabilityData([]);
    
    // Get gameId from URL if available
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');
    
    setCurrentParams({
      ...params,
      gameId: gameId || undefined
    });
    
    try {
      // Fetch both play-by-play data and win probability data in parallel
      const [apiPlays, winProbData] = await Promise.all([
        fetchPlayByPlayData({
          ...params,
          gameId: gameId || undefined
        }),
        gameId ? fetchWinProbabilityData(gameId) : Promise.resolve([])
      ]);

      setRawApiData(apiPlays); // Store raw API data for debugging
      setWinProbabilityData(winProbData); // Store win probability data
      const processedPlays = processPlayData(apiPlays);
      setPlays(processedPlays);
    } catch (err) {
      setError('Failed to load play data. Please check your parameters and try again.');
      setPlays([]); // Clear existing plays data on error
      setRawApiData([]); // Clear existing raw API data on error
      setWinProbabilityData([]); // Clear existing win probability data on error
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to determine if a play is rush or pass - UPDATED TO INCLUDE SACKS AND INTERCEPTIONS AS PASS
  const getPlayType = (playType: string): string => {
    const lowerPlayType = playType.toLowerCase();
    if (lowerPlayType.includes('rush') || lowerPlayType.includes('run')) {
      return 'Rush';
    } else if (lowerPlayType.includes('pass') || lowerPlayType.includes('completion') || lowerPlayType.includes('incompletion') || lowerPlayType.includes('sack') || lowerPlayType.includes('interception')) {
      return 'Pass';
    }
    return 'Other';
  };

  // Plays are already filtered to rush/pass in processPlayData
  const filteredPlays = plays;

  // Sort raw API data by ascending ID for display
  const sortedRawApiData = [...rawApiData].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Calculate metrics for both teams
  const teamPlays = filteredPlays.filter(p => p.offense === currentParams?.team);
  const opponentPlays = filteredPlays.filter(p => p.offense === opponentTeam);

  const teamSuccessfulPlays = teamPlays.filter(p => p.success).length;
  const teamExplosivePlays = teamPlays.filter(p => p.explosiveness).length;
  const teamTotalYards = teamPlays.reduce((sum, p) => sum + p.yardsGained, 0);

  const opponentSuccessfulPlays = opponentPlays.filter(p => p.success).length;
  const opponentExplosivePlays = opponentPlays.filter(p => p.explosiveness).length;
  const opponentTotalYards = opponentPlays.reduce((sum, p) => sum + p.yardsGained, 0);

  // Get team colors
  const teamColors = currentParams ? getDisplayTeamColors(currentParams.team, selectedTeamColor) : null;
  const opponentColors = getDisplayTeamColors(opponentTeam, selectedOpponentColor);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start md:items-center sm:space-x-3">
              <div className="hidden sm:flex items-center justify-center w-15 h-15">
                <img 
                  src={logo} 
                  alt="Graphing College Football Logo" 
                  className="h-14 w-14 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 mt-0.5 sm:mt-0">
                  Graphing College Football
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 mt-0">
                  Advanced play-by-play metrics<span className="hidden sm:inline"> and visualizations</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Navigation Link */}
              <a
                href="/ratings"
                className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 transition-all duration-200 text-sm font-medium"
              >
                SP+ Ratings
              </a>

              {/* Info Button */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex items-center justify-center w-10 h-10 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-all duration-200"
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
          <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow-sm sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
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

        {/* Game Info Banner */}
        {plays.length > 0 && currentParams && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold text-neutral-900">
                {currentParams.team} vs. {opponentTeam}
              </h3>
              <button
                onClick={handleCopyPageLink}
                className="flex items-center justify-center w-8 h-8 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 transition-all duration-200 group"
                title="Copy short link to this page"
              >
                <Link className="h-4 w-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>
            <p className="text-neutral-600 mb-6">
              {currentParams.year} • Week {currentParams.week} • {currentParams.seasonType === 'regular' ? 'Regular Season' : 'Postseason'}
            </p>

            {/* Data Definitions and Notes Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-4">
              <button
                onClick={() => setShowDataDefinitions(!showDataDefinitions)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-5 w-5 text-neutral-600" />
                  <h2 className="text-xl font-semibold text-neutral-900">
                    <span className="hidden sm:inline">Data </span>Definitions and Notes
                  </h2>
                </div>
                <ChevronDown className={`h-6 w-6 text-neutral-500 transition-transform ${showDataDefinitions ? 'rotate-180' : ''}`} />
              </button>
              
              {showDataDefinitions && (
                <div className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Data Definitions */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-6 pt-2">Data Definitions</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Analytics foundation</h4>
                            <p className="text-neutral-600 leading-tight">This analysis is based roughly on the <a href="https://www.sbnation.com/college-football/2017/10/13/16457830/college-football-advanced-stats-analytics-rankings" target="_blank" rel="noopener noreferrer" className="text-neutral-600 underline hover:text-neutral-800">SP+ analytic system</a>, which provides a foundation for evaluating team performance through success rate and explosiveness metrics.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Success Rate (SR):</h4>
                            <p className="text-neutral-600 leading-tight mb-2">The percentage of plays that gain enough yards to be considered "successful" based on down and distance:</p>
                            <ul className="list-disc list-inside space-y-1 text-neutral-600 leading-tight ml-4">
                              <li><strong>1st down:</strong> Successful if the play gains at least 50% of the yards needed for a first down</li>
                              <li><strong>2nd down:</strong> Successful if the play gains at least 70% of the yards needed for a first down</li>
                              <li><strong>3rd & 4th down:</strong> Successful if the play gains 100% of the yards needed (achieves a first down or touchdown)</li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Explosiveness Rate (XR):</h4>
                            <p className="text-neutral-600 leading-tight">The percentage of plays that gain more than 15 yards, regardless of down and distance. These are the "big plays" that can change the momentum of a game.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Rush Rate (RR):</h4>
                            <p className="text-neutral-600 leading-tight">The percentage of offensive plays that are rushing attempts versus passing attempts. A 50% rush rate indicates a perfectly balanced offense.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Cumulative Metrics:</h4>
                            <p className="text-neutral-600 leading-tight">Charts showing "cumulative" data display running averages that update after each play. This shows how team performance evolves throughout the game.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Red Zone:</h4>
                            <p className="text-neutral-600 leading-tight">The area of the field within 20 yards of the opponent's goal line. Success rates often change dramatically in this area due to the compressed field.</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Play Types:</h4>
                        <ul className="list-disc list-inside space-y-1 text-neutral-600 leading-tight ml-4">
                          <li><strong>Rush:</strong> Any designed running play or quarterback scramble</li>
                          <li><strong>Pass:</strong> Any forward pass attempt, including completions, incompletions, and <strong>sacks</strong> (Note: Unlike traditional statistics that count sacks as rushing plays, this analysis correctly categorizes them as pass attempts with negative yardage)</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Excluded Plays:</h4>
                        <p className="text-neutral-600 leading-tight">Penalties that result in no play occurring are excluded from the analysis, as are all special teams plays (punts, kickoffs, field goals) and extra point attempts.</p>
                      </div>
                    </div>

                    {/* Right Column - Notes */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-6 pt-2">Notes</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Data accuracy:</h4>
                            <p className="text-neutral-600 leading-tight">There may be occasional errors in the charts as data is pulled from play-by-play records, which vary slightly between stadiums and can be subject to human error when recorded.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">NCAA average reference line:</h4>
                            <p className="text-neutral-600 leading-tight">The average Success Rate for teams changes year over year, but tends to hover around 42-43%. This benchmark is marked on most charts as a dashed line for reference.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Team color conflicts:</h4>
                            <p className="text-neutral-600 leading-tight">Having trouble distinguishing between opponents with similar colors? Use the team color override controls in the team selection area up top.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Explosive plays visualization:</h4>
                            <p className="text-neutral-600 leading-tight">Bar charts display explosive plays as a subset of successful plays for visual clarity, even though rare edge cases exist where an explosive play might not meet success criteria (e.g., gaining 17 yards on 4th and 20). This simplification affects less than 1% of plays.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Special teams and scoring plays</h4>
                            <p className="text-neutral-600 leading-tight">are excluded from this analysis to focus on standard offensive efficiency. Two-point conversions are also excluded.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Drive chart play counts</h4>
                            <p className="text-neutral-600 leading-tight">use a secondary Y-axis to show the number of plays per drive while maintaining the 0-100% scale for success and explosiveness rates.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-neutral-900 mt-5 mb-0.5">Embed buttons</h4>
                            <p className="text-neutral-600 leading-tight">Each chart has an "Embed" button that generates HTML code you can copy and paste into other websites or services like WordPress, blog posts, or social media. This allows you to share specific charts while keeping them interactive and up-to-date.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* All Plays Data Section - Reorganized */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-8">
              <button
                onClick={() => setShowAllPlays(!showAllPlays)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-neutral-600" />
                  <h2 className="text-xl font-semibold text-neutral-900">
                    All plays data
                  </h2>
                </div>
                <ChevronDown className={`h-6 w-6 text-neutral-500 transition-transform ${showAllPlays ? 'rotate-180' : ''}`} />
              </button>
              
              {showAllPlays && (
                <div className="mt-6 space-y-6">
                  {/* Raw API Plays in Sub-Accordion */}
                  <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-4">
                    <button
                      onClick={() => setShowRawPlays(!showRawPlays)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h3 className="text-lg font-medium text-neutral-900">
                        Raw API Plays ({rawApiData.length} total)
                      </h3>
                      <ChevronDown className={`h-5 w-5 text-neutral-500 transition-transform ${showRawPlays ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showRawPlays && (
                      <div className="mt-4 space-y-4">
                        {/* Raw API Data Sample */}
                        <div>
                          <h4 className="text-md font-medium text-slate-800 mb-2">
                            Sample (First play to check field names):
                          </h4>
                          <div className="bg-white rounded-lg p-3 overflow-auto max-h-48 border border-neutral-200">
                            <pre className="text-sm text-neutral-700">
                              {JSON.stringify(rawApiData[0] || {}, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* All Plays Table - Using Raw API Data */}
                        <div>
                          <h4 className="text-md font-medium text-slate-800 mb-2">
                            Complete Table:
                          </h4>
                          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                            <div className="overflow-x-auto max-h-96">
                              <table className="min-w-full divide-y divide-neutral-200">
                                <thead className="bg-neutral-100 sticky top-0">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Drive #</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play in Drive</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Quarter</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Down</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Distance</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Offense</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Defense</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Yards</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play Text</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-neutral-200">
                                  {sortedRawApiData.map((play, index) => (
                                    <tr key={play.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.id || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.drive_number || play.driveNumber || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.play_number || play.playNumber || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.quarter || play.period || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.down || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.distance || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.offense || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.defense || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.play_type || play.playType || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                        {play.yards_gained !== undefined ? play.yards_gained : (play.yardsGained !== undefined ? play.yardsGained : 'N/A')}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-neutral-900 max-w-xs truncate" title={play.play_text || play.playText || ''}>
                                        {play.play_text || play.playText || 'N/A'}
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

                  {/* Processed Plays Table - Always Open */}
                  <div>
                    <h3 className="text-lg font-medium text-neutral-900 mb-3">
                      Processed Plays - Rush and Pass Only with Player Names ({filteredPlays.length} total):
                    </h3>
                    <div className="bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden">
                      <div className="overflow-x-auto max-h-[456px]">
                        <table className="min-w-full divide-y divide-neutral-200">
                          <thead className="bg-neutral-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Team Play #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Drive #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play in Drive</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Quarter</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Down</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Distance</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Offense</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Defense</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play Type</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rusher</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Passer</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Receiver</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Yards</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Success</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Explosive</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Team SR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Team XR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rush Rate</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rush SR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pass SR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Play Text</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-neutral-200">
                            {filteredPlays.map((play, index) => (
                              <tr key={play.id} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.playNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.teamPlayNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.driveNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.playInDrive}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.quarter}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.down}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.distance}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.offense}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.defense}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    getPlayType(play.playType) === 'Rush' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {getPlayType(play.playType)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.rusher || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.passer || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.receiver || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">{play.yardsGained}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    play.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {play.success ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    play.explosiveness ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {play.explosiveness ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                  {(play.teamCumulativeSR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                  {(play.teamCumulativeXR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                  {(play.teamCumulativeRushRate * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                  {(play.teamRushCumulativeSR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900">
                                  {(play.teamPassCumulativeSR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-sm text-neutral-900 max-w-xs truncate" title={play.playText}>
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
            </div>
          </div>
        )}

        {/* Box Score */}
        {boxScoreData && (
          <BoxScoreContainer
            firstTableStats={boxScoreData.firstTableStats}
            secondTableStats={boxScoreData.secondTableStats}
            team1Name={boxScoreData.team1Name}
            team2Name={boxScoreData.team2Name}
            selectedTeamColor={selectedTeamColor}
            selectedOpponentColor={selectedOpponentColor}
            onCopyEmbed={handleCopyEmbed}
            currentParams={currentParams}
            plays={plays}
          />
        )}

        {/* Box Score Loading */}
        {boxScoreLoading && currentParams && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-8">
            <h2 className="text-xl font-semibold text-neutral-900 mb-6">Box Score</h2>
            <div className="flex items-center justify-center py-8">
              <div className="text-neutral-600">Loading box score...</div>
            </div>
          </div>
        )}

        {/* Box Score Error - Only show if main play data loaded successfully */}
        {boxScoreError && currentParams && plays.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-8">
            <h2 className="text-xl font-semibold text-neutral-900 mb-6">Box Score</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 font-medium">{boxScoreError}</p>
            </div>
          </div>
        )}

        {/* Metrics Summary for Both Teams */}
        {plays.length > 0 && currentParams && teamColors && (
          <div className="mb-8">
            {/* Desktop: Two Rows */}
            <div className="hidden md:block space-y-4">
              {/* Team Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{currentParams.team} Plays</p>
                      <p className="text-2xl font-bold text-neutral-900">{teamPlays.length}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                      <BarChart3 className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{currentParams.team} SR</p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {teamPlays.length > 0 ? ((teamSuccessfulPlays / teamPlays.length) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                      <Settings className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{currentParams.team} XR</p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {teamPlays.length > 0 ? ((teamExplosivePlays / teamPlays.length) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                      <Flame className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{currentParams.team} YPP</p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {teamPlays.length > 0 ? (teamTotalYards / teamPlays.length).toFixed(1) : '0.0'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                      <Ruler className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Opponent Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{opponentTeam} Plays</p>
                      <p className="text-2xl font-bold text-neutral-900">{opponentPlays.length}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                      <BarChart3 className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{opponentTeam} SR</p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {opponentPlays.length > 0 ? ((opponentSuccessfulPlays / opponentPlays.length) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                      <Settings className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{opponentTeam} XR</p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {opponentPlays.length > 0 ? ((opponentExplosivePlays / opponentPlays.length) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                      <Flame className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600">{opponentTeam} YPP</p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {opponentPlays.length > 0 ? (opponentTotalYards / opponentPlays.length).toFixed(1) : '0.0'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                      <Ruler className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Alternating Pattern */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {/* Team 1 Plays */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{currentParams.team} Plays</p>
                    <p className="text-2xl font-bold text-neutral-900">{teamPlays.length}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <BarChart3 className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 2 Plays */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{opponentTeam} Plays</p>
                    <p className="text-2xl font-bold text-neutral-900">{opponentPlays.length}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <BarChart3 className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 1 SR */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{currentParams.team} SR</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {teamPlays.length > 0 ? ((teamSuccessfulPlays / teamPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <Settings className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 2 SR */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{opponentTeam} SR</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {opponentPlays.length > 0 ? ((opponentSuccessfulPlays / opponentPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <Settings className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 1 XR */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{currentParams.team} XR</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {teamPlays.length > 0 ? ((teamExplosivePlays / teamPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <Flame className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 2 XR */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{opponentTeam} XR</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {opponentPlays.length > 0 ? ((opponentExplosivePlays / opponentPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <Flame className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 1 YPP */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{currentParams.team} YPP</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {teamPlays.length > 0 ? (teamTotalYards / teamPlays.length).toFixed(1) : '0.0'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <Ruler className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>

              {/* Team 2 YPP */}
              <div className="bg-white rounded-xl pt-4 px-4 pb-4 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">{opponentTeam} YPP</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {opponentPlays.length > 0 ? (opponentTotalYards / opponentPlays.length).toFixed(1) : '0.0'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <Ruler className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-8">
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Analytics Dashboard */}
        {plays.length > 0 && currentParams && (
          <div className="space-y-8">
            {/* Charts Grid */}
            <ChartsGrid
              plays={filteredPlays}
              team={currentParams.team}
              selectedTeamColor={selectedTeamColor}
              selectedOpponentColor={selectedOpponentColor}
              currentParams={currentParams}
              winProbabilityData={winProbabilityData}
              rawApiData={rawApiData}
            />
          </div>
        )}

        {/* Empty State */}
        {plays.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12">
              {currentParams ? (
                // Game was selected but no data returned
                <>
                  <AlertCircle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    No data available for this game
                  </h3>
                  <p className="text-neutral-600 max-w-md mx-auto">
                    We couldn't find play-by-play data for {currentParams.team} in {currentParams.seasonType === 'regular' ? `Week ${currentParams.week}` : `Postseason Week ${currentParams.week}`}, {currentParams.year}. 
                    {error ? ' There was an error retrieving the data.' : ' This game may not have occurred yet or data may not be available.'}
                  </p>
                </>
              ) : (
                // No game selected yet
                <>
                  <BarChart3 className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Find a game above to load the graphs
                  </h3>
                  <p className="text-neutral-600 max-w-md mx-auto">
                    Fill in the year, team, and game, then click "Fetch Data" 
                    to start exploring detailed analytics and visualizations.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        </div>
      </main>
      <Toast
        message={toastMessage}
        type="success"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

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
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
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
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <form onSubmit={handleContactFormSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-neutral-900">Get in Touch</h2>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={contactForm.name}
                      onChange={handleContactFormChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                      Your Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactFormChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your email"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-neutral-700 mb-2">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactFormChange}
                      required
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Enter your message"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
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
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {isSubmittingContact ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      
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
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
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
    </div>
  );
};

export default Dashboard;