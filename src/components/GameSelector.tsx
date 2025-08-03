import React, { useState, useEffect } from 'react';
import { Play, ChevronDown, Check } from 'lucide-react';
import { Listbox, Combobox } from '@headlessui/react';
import { fetchTeams, fetchGamesForTeam, Team, TeamGame } from '../services/api';

interface GameSelectorProps {
  onFetchData: (params: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
  }) => void;
  isLoading: boolean;
  overrideTeam1ToGray: boolean;
  setOverrideTeam1ToGray: (value: boolean) => void;
  overrideTeam2ToGray: boolean;
  setOverrideTeam2ToGray: (value: boolean) => void;
  currentParams: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
  } | null;
  opponentTeam: string;
}

const GameSelector: React.FC<GameSelectorProps> = ({ 
  onFetchData, 
  isLoading, 
  overrideTeam1ToGray, 
  setOverrideTeam1ToGray, 
  overrideTeam2ToGray, 
  setOverrideTeam2ToGray, 
  currentParams, 
  opponentTeam 
}) => {
  const [year, setYear] = useState<number>(2024);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamQuery, setTeamQuery] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<TeamGame | null>(null);
  const [games, setGames] = useState<TeamGame[]>([]);
  const [loadingGames, setLoadingGames] = useState<boolean>(false);
  const [isLoadingFromURL, setIsLoadingFromURL] = useState<boolean>(true); // Start as true to prevent initial URL updates

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
        const urlGrayTeam = urlParams.get('grayTeam') === 'true';
        const urlGrayOpponent = urlParams.get('grayOpponent') === 'true';
        
        // Check if we have URL parameters to load
        const hasURLParams = urlYear && urlTeam;
        
        // Set color overrides from URL
        if (urlParams.has('grayTeam')) {
          setOverrideTeam1ToGray(urlGrayTeam);
        }
        if (urlParams.has('grayOpponent')) {
          setOverrideTeam2ToGray(urlGrayOpponent);
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
          // If not loading from URL and no pending game, allow URL updates
          if (!isLoadingFromURL) {
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
    if (overrideTeam1ToGray) {
      params.set('grayTeam', 'true');
    }
    if (overrideTeam2ToGray) {
      params.set('grayOpponent', 'true');
    }
    
    const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  };

  // Update URL when selections change (but not during initial URL loading)
  useEffect(() => {
    if (!isLoadingFromURL) {
      updateURL();
    }
  }, [year, selectedTeam, selectedGame, overrideTeam1ToGray, overrideTeam2ToGray, isLoadingFromURL]);

  // Filter teams based on query
  const filteredTeams = teamQuery === '' 
    ? teams.slice(0, 20) // Show first 20 teams when no query
    : teams.filter((team) =>
        team.school.toLowerCase().includes(teamQuery.toLowerCase())
      ).slice(0, 10); // Show top 10 matches

  const years = [2024, 2023, 2022, 2021, 2020];

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Year Dropdown */}
      <div className="flex-shrink-0">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Year
        </label>
        <Listbox value={year} onChange={setYear}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-slate-300 rounded-lg px-3 py-3 pr-10 text-left shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default">
              <span className="block truncate">{year}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {years.map((yearOption) => (
                <Listbox.Option
                  key={yearOption}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-emerald-100 text-emerald-900' : 'text-slate-900'
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
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Team
        </label>
        <Combobox value={selectedTeam} onChange={setSelectedTeam}>
          <div className="relative">
            <Combobox.Input
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              displayValue={(team: Team | null) => team?.school || ''}
              onChange={(event) => setTeamQuery(event.target.value)}
              placeholder="e.g., Alabama"
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Combobox.Button>
            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {loadingTeams ? (
                <div className="px-4 py-2 text-sm text-slate-500">Loading teams...</div>
              ) : filteredTeams.length === 0 && teamQuery !== '' ? (
                <div className="px-4 py-2 text-sm text-slate-500">No teams found.</div>
              ) : (
                filteredTeams.map((team) => (
                  <Combobox.Option
                    key={team.id}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-3 pr-9 ${
                        active ? 'bg-emerald-100 text-emerald-900' : 'text-slate-900'
                      }`
                    }
                    value={team}
                  >
                    {({ selected, active }) => (
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
          </div>
        </Combobox>
      </div>

      {/* Game Dropdown */}
      <div className="flex-grow min-w-0">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Game
        </label>
        <Listbox value={selectedGame} onChange={setSelectedGame} disabled={!selectedTeam || loadingGames}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-slate-300 rounded-lg px-3 py-3 pr-10 text-left shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default disabled:bg-slate-100 disabled:cursor-not-allowed">
              <span className="block truncate">
                {!selectedTeam ? 'Select a team first' : 
                 loadingGames ? 'Loading games...' : 
                 selectedGame ? formatGameDisplay(selectedGame) : 
                 games.length === 0 ? 'No games found' : 'Select a game'}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {games.map((game) => (
                <Listbox.Option
                  key={game.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-emerald-100 text-emerald-900' : 'text-slate-900'
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
          </div>
        </Listbox>
      </div>

      {/* Color Override Checkboxes */}
      {currentParams && opponentTeam !== 'Opponent' && (
        <div className="flex-shrink-0 space-y-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Color Overrides
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overrideTeam1ToGray}
                onChange={(e) => setOverrideTeam1ToGray(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Override team to gray</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overrideTeam2ToGray}
                onChange={(e) => setOverrideTeam2ToGray(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Override opponent to gray</span>
            </label>
          </div>
        </div>
      )}

      {/* Fetch Button */}
      <div className="flex-shrink-0">
        <button
          onClick={handleFetchData}
          disabled={isLoading || !selectedGame || !selectedTeam}
          className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium rounded-lg shadow-sm transition-colors disabled:cursor-not-allowed"
        >
          <span>{isLoading ? 'Loading...' : 'Fetch Play Data'}</span>
          <Play className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default GameSelector;