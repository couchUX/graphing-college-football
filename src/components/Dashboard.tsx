import React, { useState } from 'react';
import { BarChart3, TrendingUp, Target, Database, ChevronDown, BookOpen } from 'lucide-react';
import GameSelector from './GameSelector';
import ChartsGrid from './ChartsGrid';
import BoxScoreContainer from './BoxScoreContainer';
import { PlayData } from '../types';
import { fetchPlayByPlayData } from '../services/api';
import { processPlayData } from '../utils/metrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { useBoxScore } from '../hooks/useBoxScore';

const Dashboard: React.FC = () => {
  const [plays, setPlays] = useState<PlayData[]>([]);
  const [rawApiData, setRawApiData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllPlays, setShowAllPlays] = useState<boolean>(false);
  const [showRawPlays, setShowRawPlays] = useState<boolean>(false);
  const [showDataDefinitions, setShowDataDefinitions] = useState<boolean>(false);
  const [overrideTeam1ToGray, setOverrideTeam1ToGray] = useState<boolean>(false);
  const [overrideTeam2ToGray, setOverrideTeam2ToGray] = useState<boolean>(false);
  const [currentParams, setCurrentParams] = useState<{
    year: number;
    week: number;
    seasonType: string;
    team: string;
  } | null>(null);

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
    setIsLoading(true);
    setError(null);
    setCurrentParams(params);
    
    try {
      const apiPlays = await fetchPlayByPlayData(params);
      setRawApiData(apiPlays); // Store raw API data for debugging
      const processedPlays = processPlayData(apiPlays);
      setPlays(processedPlays);
      console.log('Raw API data:', apiPlays);
      console.log('Processed plays:', processedPlays);
      
      // If no plays were returned, ensure we clear any lingering error state
      if (!apiPlays || apiPlays.length === 0) {
        console.log('No play data returned for these parameters');
      }
    } catch (err) {
      setError('Failed to load play data. Please check your parameters and try again.');
      setPlays([]); // Clear existing plays data on error
      setRawApiData([]); // Clear existing raw API data on error
      console.error('Error loading play data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to determine if a play is rush or pass - UPDATED TO INCLUDE SACKS AS PASS
  const getPlayType = (playType: string): string => {
    const lowerPlayType = playType.toLowerCase();
    if (lowerPlayType.includes('rush') || lowerPlayType.includes('run')) {
      return 'Rush';
    } else if (lowerPlayType.includes('pass') || lowerPlayType.includes('completion') || lowerPlayType.includes('incompletion') || lowerPlayType.includes('sack')) {
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
  const teamColors = currentParams ? getDisplayTeamColors(currentParams.team, overrideTeam1ToGray) : null;
  const opponentColors = getDisplayTeamColors(opponentTeam, overrideTeam2ToGray);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-slate-900 p-3 rounded-xl">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  College Football Analytics
                </h1>
                <p className="text-slate-600 mt-1">
                  Advanced play-by-play visualization and metrics
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Input */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <GameSelector
            onFetchData={handleFetchData}
            isLoading={isLoading}
            overrideTeam1ToGray={overrideTeam1ToGray}
            setOverrideTeam1ToGray={setOverrideTeam1ToGray}
            overrideTeam2ToGray={overrideTeam2ToGray}
            setOverrideTeam2ToGray={setOverrideTeam2ToGray}
            currentParams={currentParams}
            opponentTeam={opponentTeam}
          />
        </div>

        {/* Game Info Banner */}
        {plays.length > 0 && currentParams && (
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {currentParams.team} vs. {opponentTeam}
            </h3>
            <p className="text-slate-600 mb-6">
              {currentParams.year} • Week {currentParams.week} • {currentParams.seasonType === 'regular' ? 'Regular Season' : 'Postseason'}
            </p>

            {/* Data Definitions and Notes Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
              <button
                onClick={() => setShowDataDefinitions(!showDataDefinitions)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-5 w-5 text-slate-600" />
                  <h2 className="text-xl font-semibold text-slate-900">
                    Data Definitions and Notes
                  </h2>
                </div>
                <ChevronDown className={`h-6 w-6 text-slate-500 transition-transform ${showDataDefinitions ? 'rotate-180' : ''}`} />
              </button>
              
              {showDataDefinitions && (
                <div className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Data Definitions */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-6 pt-2">Data Definitions</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Success Rate (SR):</h4>
                            <p className="text-slate-700 mb-2">The percentage of plays that gain enough yards to be considered "successful" based on down and distance:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                              <li><strong>1st down:</strong> Successful if the play gains at least 50% of the yards needed for a first down</li>
                              <li><strong>2nd down:</strong> Successful if the play gains at least 70% of the yards needed for a first down</li>
                              <li><strong>3rd & 4th down:</strong> Successful if the play gains 100% of the yards needed (achieves a first down or touchdown)</li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Explosiveness Rate (XR):</h4>
                            <p className="text-slate-700">The percentage of plays that gain more than 15 yards, regardless of down and distance. These are the "big plays" that can change the momentum of a game.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Rush Rate (RR):</h4>
                            <p className="text-slate-700">The percentage of offensive plays that are rushing attempts versus passing attempts. A 50% rush rate indicates a perfectly balanced offense.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Cumulative Metrics:</h4>
                            <p className="text-slate-700">Charts showing "cumulative" data display running averages that update after each play. This shows how team performance evolves throughout the game.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Red Zone:</h4>
                            <p className="text-slate-700">The area of the field within 20 yards of the opponent's goal line. Success rates often change dramatically in this area due to the compressed field.</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 mt-5">Play Types:</h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                          <li><strong>Rush:</strong> Any designed running play or quarterback scramble</li>
                          <li><strong>Pass:</strong> Any forward pass attempt, including completions, incompletions, and <strong>sacks</strong> (Note: Unlike traditional statistics that count sacks as rushing plays, this analysis correctly categorizes them as pass attempts with negative yardage)</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 mt-5">Excluded Plays:</h4>
                        <p className="text-slate-700">Penalties that result in no play occurring are excluded from the analysis, as are all special teams plays (punts, kickoffs, field goals) and extra point attempts.</p>
                      </div>
                    </div>

                    {/* Right Column - Notes */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-6 pt-2">Notes</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Data accuracy:</h4>
                            <p className="text-slate-700">There may be occasional errors in the charts as data is pulled from play-by-play records, which vary slightly between stadiums and can be subject to human error when recorded.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">NCAA average reference line:</h4>
                            <p className="text-slate-700">The average Success Rate for teams changes year over year, but tends to hover around 42-43%. This benchmark is marked on most charts as a dashed line for reference.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Team color conflicts:</h4>
                            <p className="text-slate-700">Having trouble distinguishing between opponents with similar colors? Use the team color override checkboxes at the top of the screen to display one team in gray.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Explosive plays visualization:</h4>
                            <p className="text-slate-700">Bar charts display explosive plays as a subset of successful plays for visual clarity, even though rare edge cases exist where an explosive play might not meet success criteria (e.g., gaining 17 yards on 4th and 20). This simplification affects less than 1% of plays.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Special teams and scoring plays</h4>
                            <p className="text-slate-700">are excluded from this analysis to focus on standard offensive efficiency. Two-point conversions are also excluded.</p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-slate-900 mt-5">Drive chart play counts</h4>
                            <p className="text-slate-700">use a secondary Y-axis to show the number of plays per drive while maintaining the 0-100% scale for success and explosiveness rates.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* All Plays Data Section - Reorganized */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
              <button
                onClick={() => setShowAllPlays(!showAllPlays)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-slate-600" />
                  <h2 className="text-xl font-semibold text-slate-900">
                    All plays data ({rawApiData.length} raw plays, {filteredPlays.length} rush/pass plays)
                  </h2>
                </div>
                <ChevronDown className={`h-6 w-6 text-slate-500 transition-transform ${showAllPlays ? 'rotate-180' : ''}`} />
              </button>
              
              {showAllPlays && (
                <div className="mt-6 space-y-6">
                  {/* Raw API Plays in Sub-Accordion */}
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                    <button
                      onClick={() => setShowRawPlays(!showRawPlays)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h3 className="text-lg font-medium text-slate-900">
                        Raw API Plays ({rawApiData.length} total)
                      </h3>
                      <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${showRawPlays ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showRawPlays && (
                      <div className="mt-4 space-y-4">
                        {/* Raw API Data Sample */}
                        <div>
                          <h4 className="text-md font-medium text-slate-800 mb-2">
                            Sample (First play to check field names):
                          </h4>
                          <div className="bg-white rounded-lg p-3 overflow-auto max-h-48 border border-slate-200">
                            <pre className="text-sm text-slate-700">
                              {JSON.stringify(rawApiData[0] || {}, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* All Plays Table - Using Raw API Data */}
                        <div>
                          <h4 className="text-md font-medium text-slate-800 mb-2">
                            Complete Table:
                          </h4>
                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto max-h-96">
                              <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100 sticky top-0">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Drive #</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play in Drive</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quarter</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Down</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Distance</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Offense</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Defense</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Yards</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play Text</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                  {sortedRawApiData.map((play, index) => (
                                    <tr key={play.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.id || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.drive_number || play.driveNumber || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.play_number || play.playNumber || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.quarter || play.period || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.down || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.distance || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.offense || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.defense || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.play_type || play.playType || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                        {play.yards_gained !== undefined ? play.yards_gained : (play.yardsGained !== undefined ? play.yardsGained : 'N/A')}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-slate-900 max-w-xs truncate" title={play.play_text || play.playText || ''}>
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
                    <h3 className="text-lg font-medium text-slate-900 mb-3">
                      Processed Plays - Rush and Pass Only with Player Names ({filteredPlays.length} total):
                    </h3>
                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto max-h-[456px]">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Team Play #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Drive #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play in Drive</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quarter</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Down</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Distance</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Offense</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Defense</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play Type</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rusher</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Passer</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Receiver</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Yards</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Success</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Explosive</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Team SR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Team XR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rush Rate</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rush SR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pass SR</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Play Text</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {filteredPlays.map((play, index) => (
                              <tr key={play.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.playNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.teamPlayNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.driveNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.playInDrive}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.quarter}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.down}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.distance}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.offense}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.defense}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    getPlayType(play.playType) === 'Rush' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {getPlayType(play.playType)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.rusher || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.passer || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.receiver || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{play.yardsGained}</td>
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
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                  {(play.teamCumulativeSR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                  {(play.teamCumulativeXR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                  {(play.teamCumulativeRushRate * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                  {(play.teamRushCumulativeSR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">
                                  {(play.teamPassCumulativeSR * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-sm text-slate-900 max-w-xs truncate" title={play.playText}>
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
            overrideTeam1ToGray={overrideTeam1ToGray}
            overrideTeam2ToGray={overrideTeam2ToGray}
          />
        )}

        {/* Box Score Loading */}
        {boxScoreLoading && currentParams && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Box Score</h2>
            <div className="flex items-center justify-center py-8">
              <div className="text-slate-600">Loading box score...</div>
            </div>
          </div>
        )}

        {/* Box Score Error */}
        {boxScoreError && currentParams && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Box Score</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 font-medium">{boxScoreError}</p>
            </div>
          </div>
        )}

        {/* Metrics Summary for Both Teams */}
        {plays.length > 0 && currentParams && teamColors && (
          <div className="space-y-4 mb-8">
            {/* Team Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{currentParams.team} SR</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {teamPlays.length > 0 ? ((teamSuccessfulPlays / teamPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <TrendingUp className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{currentParams.team} XR</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {teamPlays.length > 0 ? ((teamExplosivePlays / teamPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <Target className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{currentParams.team} Plays</p>
                    <p className="text-2xl font-bold text-slate-900">{teamPlays.length}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <BarChart3 className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{currentParams.team} YPP</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {teamPlays.length > 0 ? (teamTotalYards / teamPlays.length).toFixed(1) : '0.0'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: teamColors.light }}>
                    <TrendingUp className="h-6 w-6" style={{ color: teamColors.colorDark }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Opponent Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{opponentTeam} SR</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {opponentPlays.length > 0 ? ((opponentSuccessfulPlays / opponentPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <TrendingUp className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{opponentTeam} XR</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {opponentPlays.length > 0 ? ((opponentExplosivePlays / opponentPlays.length) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <Target className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{opponentTeam} Plays</p>
                    <p className="text-2xl font-bold text-slate-900">{opponentPlays.length}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <BarChart3 className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{opponentTeam} YPP</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {opponentPlays.length > 0 ? (opponentTotalYards / opponentPlays.length).toFixed(1) : '0.0'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: opponentColors.light }}>
                    <TrendingUp className="h-6 w-6" style={{ color: opponentColors.colorDark }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
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
              overrideTeam1ToGray={overrideTeam1ToGray}
              overrideTeam2ToGray={overrideTeam2ToGray}
            />
          </div>
        )}

        {/* Empty State */}
        {plays.length === 0 && !isLoading && !error && (
          <div className="text-center py-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
              <BarChart3 className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Enter Parameters to Load Play Data
              </h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Fill in the year, season type, week, and team above, then click "Fetch Play Data" 
                to start exploring detailed analytics and visualizations.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;