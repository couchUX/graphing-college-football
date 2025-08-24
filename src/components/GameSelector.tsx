import React, { useState, useEffect, useRef } from 'react';
import { Play, ChevronDown, Check } from 'lucide-react';
import { Listbox, Combobox } from '@headlessui/react';
import { fetchTeams, fetchGamesForTeam, Team, TeamGame } from '../services/api';
import { getTeamColors } from '../utils/teamColors';
import { colorPalette } from '../utils/colorPalette';

interface GameSelectorProps {
  onFetchData: (params: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
  }) => void;
  isLoading: boolean;
  selectedTeamColor: string;
  setSelectedTeamColor: (value: string) => void;
  selectedOpponentColor: string;
  setSelectedOpponentColor: (value: string) => void;
  currentParams: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
  } | null;
  opponentTeam: string;
  hasDataBeenFetched: boolean;
}

const GameSelector: React.FC<GameSelectorProps> = ({ 
  onFetchData, 
  isLoading, 
  selectedTeamColor,
  setSelectedTeamColor,
  selectedOpponentColor,
  setSelectedOpponentColor,
  currentParams, 
  opponentTeam,
  hasDataBeenFetched
}) => {
  const [year, setYear] = useState<number>(2025);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamQuery, setTeamQuery] = useState<string>('');
  const [showTeamColorPicker, setShowTeamColorPicker] = useState<boolean>(false);
  const [showOpponentColorPicker, setShowOpponentColorPicker] = useState<boolean>(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<TeamGame | null>(null);
  const [games, setGames] = useState<TeamGame[]>([]);
  const [loadingGames, setLoadingGames] = useState<boolean>(false);
  const [isLoadingFromURL, setIsLoadingFromURL] = useState<boolean>(true); // Start as true to prevent initial URL updates
  
  // Refs for click outside functionality
  const teamColorPickerRef = useRef<HTMLDivElement>(null);
  const opponentColorPickerRef = useRef<HTMLDivElement>(null);

  const handleFetchData = () => {
    if (selectedGame && selectedTeam) {
      onFetchData({ 
        year: selectedGame.season, 
        week: selectedGame.week, 
        seasonType: selectedGame.seasonType, 
        team: selectedTeam.school
      });
    }
  };

  // Handle clicks outside color picker dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamColorPickerRef.current && !teamColorPickerRef.current.contains(event.target as Node)) {
        setShowTeamColorPicker(false);
      }
      if (opponentColorPickerRef.current && !opponentColorPickerRef.current.contains(event.target as Node)) {
        setShowOpponentColorPicker(false);
      }
    };

    if (showTeamColorPicker || showOpponentColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showTeamColorPicker, showOpponentColorPicker]);

  // Load teams on mount and handle URL parameters
  useEffect(() => {
    const loadTeams = async () => {
      setLoadingTeams(true);
      try {
        const teamsData = await fetchTeams();
        const sortedTeams = teamsData.sort((a, b) => a.school.localeCompare(b.school));
        setTeams(sortedTeams);
        
        // After teams load, check for URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlYear = urlParams.get('year');
        const urlTeam = urlParams.get('team');
        const urlGameId = urlParams.get('gameId');
        const urlTeamColor = urlParams.get('teamColor');
        const urlOpponentColor = urlParams.get('opponentColor');
        // Legacy support for old gray parameters
        const urlGrayTeam = urlParams.get('grayTeam') === 'true';
        const urlGrayOpponent = urlParams.get('grayOpponent') === 'true';
        
        // Check if we have URL parameters to load
        const hasURLParams = urlYear && urlTeam;
        
        // Set color overrides from URL (new system first, then legacy)
        if (urlTeamColor) {
          setSelectedTeamColor(urlTeamColor);
        } else if (urlParams.has('grayTeam')) {
          setSelectedTeamColor(urlGrayTeam ? 'neutral' : 'default');
        }
        
        if (urlOpponentColor) {
          setSelectedOpponentColor(urlOpponentColor);
        } else if (urlParams.has('grayOpponent')) {
          setSelectedOpponentColor(urlGrayOpponent ? 'neutral' : 'default');
        }
        
        if (hasURLParams) {
          const yearNum = parseInt(urlYear);
          const team = sortedTeams.find(t => t.school === urlTeam);
          
          if (team && yearNum) {
            setYear(yearNum);
            setSelectedTeam(team);
            
            // If we have a gameId, we'll handle it after games load
            if (urlGameId) {
              sessionStorage.setItem('pendingGameId', urlGameId);
            } else {
              // No gameId, loading complete
              setIsLoadingFromURL(false);
            }
          } else {
            // If team not found, allow URL updates
            setIsLoadingFromURL(false);
          }
        } else {
          // No URL parameters to load
          setIsLoadingFromURL(false);
        }
      } catch (error) {
        console.error('Error loading teams:', error);
        setIsLoadingFromURL(false);
      } finally {
        setLoadingTeams(false);
      }
    };

    loadTeams();
  }, []);

  // Load games when selected team or year changes
  useEffect(() => {
    const loadGames = async () => {
      if (!selectedTeam) {
        setGames([]);
        setSelectedGame(null);
        return;
      }

      setLoadingGames(true);
      try {
        const gamesData = await fetchGamesForTeam({
          year,
          team: selectedTeam.school
        });
        
        // Separate regular season and postseason games
        const regularGames = gamesData.filter(game => game.seasonType === 'regular').sort((a, b) => a.week - b.week);
        const postseasonGames = gamesData.filter(game => game.seasonType === 'postseason').sort((a, b) => a.week - b.week);
        
        // Combine them with regular season first
        const allGames = [...regularGames, ...postseasonGames];
        setGames(allGames);
        
        // Check for pending gameId from URL
        const pendingGameId = sessionStorage.getItem('pendingGameId');
        
        if (pendingGameId) {
          const game = allGames.find(g => g.id.toString() === pendingGameId);
          
          if (game) {
            setSelectedGame(game);
            sessionStorage.removeItem('pendingGameId');
            
            // Auto-fetch data if we have all parameters from URL  
            setTimeout(() => {
              if (game && selectedTeam) {
                // Track URL parameter loading in Google Analytics
                if (typeof window !== 'undefined' && (window as any).gtag) {
                  (window as any).gtag('event', 'url_parameter_load', {
                    'event_category': 'user_interaction',
                    'event_label': `${selectedTeam.school}_${game.season}_week${game.week}_${game.seasonType}`,
                    'custom_parameter_team': selectedTeam.school,
                    'custom_parameter_year': game.season,
                    'custom_parameter_week': game.week,
                    'custom_parameter_season_type': game.seasonType,
                    'custom_parameter_game_id': game.id.toString()
                  });
                }
                
                onFetchData({ 
                  year: game.season, 
                  week: game.week, 
                  seasonType: game.seasonType, 
                  team: selectedTeam.school
                });
                // Allow URL updates after loading is complete
                setTimeout(() => {
                  setIsLoadingFromURL(false);
                }, 100);
              }
            }, 500);
          } else {
            sessionStorage.removeItem('pendingGameId');
            setIsLoadingFromURL(false);
          }
        } else {
          // Only reset selected game if we're not loading from URL and there's a different games list
          if (!isLoadingFromURL) {
            setSelectedGame(null); // Reset selected game when games list changes
          }
          // If not loading from URL, allow URL updates
          if (!sessionStorage.getItem('pendingGameId')) {
            setIsLoadingFromURL(false);
          }
        }
      } catch (error) {
        console.error('Error loading games:', error);
        setGames([]);
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
  }, [selectedTeam, year]);

  const formatGameDisplay = (game: TeamGame) => {
    if (!selectedTeam) return '';
    
    const opponent = game.homeTeam === selectedTeam.school ? game.awayTeam : game.homeTeam;
    const isHome = game.homeTeam === selectedTeam.school;
    const weekLabel = game.seasonType === 'regular' ? `Week ${game.week}` : `Postseason ${game.week}`;
    return `${weekLabel}: ${isHome ? 'vs' : '@'} ${opponent}`;
  };

  // Update URL with current selections
  const updateURL = (newYear?: number, newTeam?: Team | null, newGame?: TeamGame | null) => {
    const params = new URLSearchParams();
    
    const currentYear = newYear || year;
    const currentTeam = newTeam !== undefined ? newTeam : selectedTeam;
    const currentGame = newGame !== undefined ? newGame : selectedGame;
    
    if (currentYear) {
      params.set('year', currentYear.toString());
    }
    if (currentTeam) {
      params.set('team', currentTeam.school);
    }
    if (currentGame) {
      params.set('gameId', currentGame.id.toString());
    }
    
    // Add color override parameters
    if (selectedTeamColor !== 'default') {
      params.set('teamColor', selectedTeamColor);
    }
    if (selectedOpponentColor !== 'default') {
      params.set('opponentColor', selectedOpponentColor);
    }
    
    const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  };

  // Reset color selections when team or game changes (if not loading from URL)
  useEffect(() => {
    if (!isLoadingFromURL && hasDataBeenFetched) {
      // Only reset if the selected team doesn't match the currently fetched data
      if (!currentParams || !selectedTeam || selectedTeam.school !== currentParams.team) {
        setSelectedTeamColor('default');
        setSelectedOpponentColor('default');
        // Close any open color pickers
        setShowTeamColorPicker(false);
        setShowOpponentColorPicker(false);
      }
    }
  }, [selectedTeam, selectedGame, hasDataBeenFetched, currentParams, isLoadingFromURL]);

  // Update URL when selections change (but not during initial URL loading)
  useEffect(() => {
    if (!isLoadingFromURL) {
      updateURL();
    }
  }, [year, selectedTeam, selectedGame, selectedTeamColor, selectedOpponentColor, isLoadingFromURL]);

  // Filter teams based on query
  const filteredTeams = teamQuery === '' 
    ? teams.slice(0, 20) // Show first 20 teams when no query
    : teams.filter((team) =>
        team.school.toLowerCase().includes(teamQuery.toLowerCase())
      ).slice(0, 10); // Show top 10 matches

  const years = [2025, 2024, 2023, 2022, 2021, 2020];

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Year and Team Row on Mobile */}
      <div className="w-full sm:contents">
        <div className="flex gap-2 w-full sm:gap-4 sm:w-auto">
          {/* Year Dropdown */}
          <div className="flex-shrink-0 sm:w-auto">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Year
            </label>
            <Listbox value={year} onChange={setYear}>
              <div className="relative">
                <Listbox.Button className="relative w-full bg-white border border-neutral-300 rounded-lg px-3 py-3 pr-10 text-left shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default">
                  <span className="block truncate">{year}</span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {years.map((yearOption) => (
                    <Listbox.Option
                      key={yearOption}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-3 pr-9 ${
                          active ? 'bg-emerald-100 text-emerald-900' : 'text-neutral-900'
                        }`
                      }
                      value={yearOption}
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                            {yearOption}
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600">
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>

          {/* Team Type-ahead */}
          <div className="flex-grow min-w-0">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Team
            </label>
            <Combobox value={selectedTeam} onChange={setSelectedTeam}>
              <div className="relative">
                <Combobox.Input
                  className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-3 pr-16 shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  displayValue={(team: Team | null) => team?.school || ''}
                  onChange={(event) => setTeamQuery(event.target.value)}
                  placeholder="e.g., Alabama"
                />
                {/* Color Picker inside input */}
                {selectedTeam && hasDataBeenFetched && currentParams && 
                 selectedTeam.school === currentParams.team && (
                  <div className="absolute inset-y-0 right-10 flex items-center">
                    <div 
                      className="w-5 h-5 rounded border border-neutral-200 cursor-pointer hover:scale-110 transition-transform"
                      style={{ 
                        backgroundColor: (() => {
                          if (selectedTeamColor === 'default') {
                            const teamColors = getTeamColors(selectedTeam.school);
                            return teamColors.success.replace(/rgba\(([^)]+)\)/, 'rgb($1)').replace(', 0.8', '');
                          }
                          const customColor = colorPalette.find(c => c.id === selectedTeamColor);
                          return customColor ? customColor.primary : '#6B7280';
                        })()
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTeamColorPicker(!showTeamColorPicker);
                      }}
                    />
                  </div>
                )}
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                </Combobox.Button>
                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {loadingTeams ? (
                    <div className="px-4 py-2 text-sm text-neutral-500">Loading teams...</div>
                  ) : filteredTeams.length === 0 && teamQuery !== '' ? (
                    <div className="px-4 py-2 text-sm text-neutral-500">No teams found.</div>
                  ) : (
                    filteredTeams.map((team) => (
                      <Combobox.Option
                        key={team.id}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-3 pr-9 ${
                            active ? 'bg-emerald-100 text-emerald-900' : 'text-neutral-900'
                          }`
                        }
                        value={team}
                      >
                        {({ selected }) => (
                          <>
                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {team.school}
                            </span>
                            {selected ? (
                              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600">
                                <Check className="h-4 w-4" aria-hidden="true" />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Combobox.Option>
                    ))
                  )}
                </Combobox.Options>
                
                {/* Team Color Picker Dropdown */}
                {showTeamColorPicker && selectedTeam && hasDataBeenFetched && currentParams && 
                 selectedTeam.school === currentParams.team && (
                  <div ref={teamColorPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 p-2">
                    <div className="grid grid-cols-5 gap-1 w-40">
                      {/* Default option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeamColor('default');
                          setShowTeamColorPicker(false);
                        }}
                        className={`w-7 h-7 rounded border-2 transition-all ${
                          selectedTeamColor === 'default' 
                            ? 'border-neutral-900 scale-110' 
                            : 'border-neutral-200 hover:border-neutral-400'
                        }`}
                        style={{ 
                          backgroundColor: (() => {
                            const teamColors = getTeamColors(selectedTeam.school);
                            return teamColors.success.replace(/rgba\(([^)]+)\)/, 'rgb($1)').replace(', 0.8', '');
                          })()
                        }}
                        title="Default team colors"
                      >
                        {selectedTeamColor === 'default' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full border border-neutral-900"></div>
                          </div>
                        )}
                      </button>

                      {/* Color palette options */}
                      {colorPalette.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => {
                            setSelectedTeamColor(color.id);
                            setShowTeamColorPicker(false);
                          }}
                          className={`w-7 h-7 rounded border-2 transition-all ${
                            selectedTeamColor === color.id 
                              ? 'border-neutral-900 scale-110' 
                              : 'border-neutral-200 hover:border-neutral-400'
                          }`}
                          style={{ backgroundColor: color.primary }}
                          title={`Custom color: ${color.id}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Combobox>
          </div>
        </div>
      </div>

      {/* Game Dropdown */}
      <div className="flex-grow min-w-0">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Game
        </label>
        <Listbox value={selectedGame} onChange={setSelectedGame} disabled={!selectedTeam || loadingGames}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-neutral-300 rounded-lg px-3 py-3 pr-16 text-left shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default disabled:bg-neutral-100 disabled:cursor-not-allowed">
              <span className="block truncate">
                {!selectedTeam ? 'Select a team first' : 
                 loadingGames ? 'Loading games...' : 
                 selectedGame ? formatGameDisplay(selectedGame) : 
                 games.length === 0 ? 'No games found' : 'Select a game'}
              </span>
              {/* Color Picker inside input for opponent team */}
              {selectedGame && opponentTeam && hasDataBeenFetched && currentParams && 
               selectedTeam && selectedTeam.school === currentParams.team &&
               selectedGame.season === currentParams.year &&
               selectedGame.week === currentParams.week &&
               selectedGame.seasonType === currentParams.seasonType && (
                <div className="absolute inset-y-0 right-10 flex items-center">
                  <div 
                    className="w-5 h-5 rounded border border-neutral-200 cursor-pointer hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: (() => {
                        if (selectedOpponentColor === 'default') {
                          const teamColors = getTeamColors(opponentTeam);
                          return teamColors.success.replace(/rgba\(([^)]+)\)/, 'rgb($1)').replace(', 0.8', '');
                        }
                        const customColor = colorPalette.find(c => c.id === selectedOpponentColor);
                        return customColor ? customColor.primary : '#6B7280';
                      })()
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowOpponentColorPicker(!showOpponentColorPicker);
                    }}
                  />
                </div>
              )}
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {games.map((game) => (
                <Listbox.Option
                  key={game.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-emerald-100 text-emerald-900' : 'text-neutral-900'
                    }`
                  }
                  value={game}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {formatGameDisplay(game)}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
            
            {/* Opponent Color Picker Dropdown */}
            {showOpponentColorPicker && selectedGame && opponentTeam && hasDataBeenFetched && currentParams && 
             selectedTeam && selectedTeam.school === currentParams.team &&
             selectedGame.season === currentParams.year &&
             selectedGame.week === currentParams.week &&
             selectedGame.seasonType === currentParams.seasonType && (
              <div ref={opponentColorPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 p-2">
                <div className="grid grid-cols-5 gap-1 w-40">
                  {/* Default option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOpponentColor('default');
                      setShowOpponentColorPicker(false);
                    }}
                    className={`w-7 h-7 rounded border-2 transition-all ${
                      selectedOpponentColor === 'default' 
                        ? 'border-neutral-900 scale-110' 
                        : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                    style={{ 
                      backgroundColor: (() => {
                        const teamColors = getTeamColors(opponentTeam);
                        return teamColors.success.replace(/rgba\(([^)]+)\)/, 'rgb($1)').replace(', 0.8', '');
                      })()
                    }}
                    title="Default opponent colors"
                  >
                    {selectedOpponentColor === 'default' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full border border-neutral-900"></div>
                      </div>
                    )}
                  </button>

                  {/* Color palette options */}
                  {colorPalette.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => {
                        setSelectedOpponentColor(color.id);
                        setShowOpponentColorPicker(false);
                      }}
                      className={`w-7 h-7 rounded border-2 transition-all ${
                        selectedOpponentColor === color.id 
                          ? 'border-neutral-900 scale-110' 
                          : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                      style={{ backgroundColor: color.primary }}
                      title={`Custom color: ${color.id}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Listbox>
      </div>


      {/* Fetch Button - Mobile order: before checkboxes, Desktop order: after checkboxes */}
      <div className="w-full sm:flex-shrink-0 sm:w-auto order-2 sm:order-3">
        <button
          onClick={handleFetchData}
          disabled={isLoading || !selectedGame || !selectedTeam}
          className="w-full sm:w-auto flex items-center justify-center sm:justify-start space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-400 text-white font-medium rounded-lg shadow-sm transition-colors disabled:cursor-not-allowed"
        >
          <span>{isLoading ? 'Loading...' : 'Fetch Data'}</span>
          <Play className="h-5 w-5" />
        </button>
      </div>

    </div>
  );
};

export default GameSelector;