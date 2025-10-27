import { API_BASE_URL, getApiHeaders } from '../config/api';

export interface BoxScoreTeam {
  school?: string;  // Optional - sometimes not provided
  team?: string;    // Alternative field name used by API
  conference: string;
  homeAway: string;
  points: number;
  stats: Array<{
    category: string;
    stat: string;
  }>;
}

export interface Game {
  id: number;
  teams: BoxScoreTeam[];
  excitementIndex?: number;
  advancedStats?: {
    [teamName: string]: {
      explosiveness?: number;
    };
  };
}

export const fetchBoxScore = async (params: {
  year: number;
  week: number;
  seasonType: string;
  team: string;
  gameId?: string;
}): Promise<Game[]> => {
  try {
    const { year, week, seasonType, team, gameId } = params;
    
    let data;
    
    // If gameId is provided, try to filter by specific game
    if (gameId) {
      // Get game info first
      const gameInfoUrl = `${API_BASE_URL}/games?id=${gameId}`;
      console.log('Fetching game info for box score from:', gameInfoUrl);
      
      try {
        const gameInfoResponse = await fetch(gameInfoUrl, { headers: getApiHeaders() });
        if (gameInfoResponse.ok) {
          const gameInfo = await gameInfoResponse.json();
          if (gameInfo.length > 0) {
            const game = gameInfo[0];
            
            // Try to get box score by gameId (using the game's week)
            const gameSpecificUrl = `${API_BASE_URL}/games/teams?seasonType=${seasonType}&year=${year}&team=${encodeURIComponent(team)}&week=${game.week}`;
            console.log('Fetching box score by game week from:', gameSpecificUrl);
            
            const gameSpecificResponse = await fetch(gameSpecificUrl, { headers: getApiHeaders() });
            if (gameSpecificResponse.ok) {
              const gameSpecificData = await gameSpecificResponse.json();
              
              // Filter to only the specific game
              const filteredData = gameSpecificData.filter((g: any) => g.id.toString() === gameId.toString());
              
              if (filteredData.length > 0) {
                console.log('Successfully filtered box score data by gameId:', filteredData.length);
                data = filteredData;
              } else {
                console.log('No box score data found for specific gameId, falling back to week-based fetch');
                data = gameSpecificData;
              }
            }
          }
        }
      } catch (error) {
        console.log('Game-specific box score fetch failed, falling back to week-based fetch:', error);
      }
    }
    
    // Fallback to week-based fetch if gameId approach failed
    if (!data) {
      const baseUrl = `${API_BASE_URL}/games/teams?seasonType=${seasonType}&year=${year}&team=${encodeURIComponent(team)}&week=${week}`;
      console.log('Fetching box score by week from:', baseUrl);
      
      const response = await fetch(baseUrl, { headers: getApiHeaders() });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      data = await response.json();
    }
    
    console.log('Fetched box score data:', data);
    
    // Enhance with additional metrics for each game
    const enhancedGames = await Promise.all(
      data.map(async (game: Game) => {
        try {
          // Fetch excitement index from games endpoint
          const gamesUrl = `${API_BASE_URL}/games?id=${game.id}`;
          const gamesResponse = await fetch(gamesUrl, { headers: getApiHeaders() });
          let excitementIndex;
          
          if (gamesResponse.ok) {
            const gamesData = await gamesResponse.json();
            if (gamesData.length > 0) {
              excitementIndex = gamesData[0].excitementIndex;
              console.log('Fetched excitement index:', excitementIndex);
            }
          }
          
          // Fetch explosiveness from advanced stats endpoint for all teams in this game
          const advancedStatsUrl = `${API_BASE_URL}/stats/game/advanced?year=${year}&week=${week}&seasonType=${seasonType}&gameId=${game.id}`;
          const advancedResponse = await fetch(advancedStatsUrl, { headers: getApiHeaders() });
          const advancedStats: { [teamName: string]: { explosiveness?: number } } = {};
          
          if (advancedResponse.ok) {
            const advancedData = await advancedResponse.json();
            console.log('Fetched advanced stats for all teams:', advancedData);
            
            // Map explosiveness data by team name
            advancedData.forEach((teamStats: any) => {
              if (teamStats.offense?.explosiveness) {
                advancedStats[teamStats.team] = {
                  explosiveness: teamStats.offense.explosiveness
                };
              }
            });
          } else {
            // Fallback: fetch each team individually if gameId doesn't work
            console.log('GameId fetch failed, trying individual team fetches');
            const teamNames = game.teams?.map(t => t.team) || [team];
            
            for (const teamName of teamNames) {
              try {
                const teamAdvancedUrl = `${API_BASE_URL}/stats/game/advanced?year=${year}&week=${week}&seasonType=${seasonType}&team=${encodeURIComponent(teamName)}`;
                const teamResponse = await fetch(teamAdvancedUrl, { headers: getApiHeaders() });
                
                if (teamResponse.ok) {
                  const teamAdvancedData = await teamResponse.json();
                  console.log(`Fetched advanced stats for ${teamName}:`, teamAdvancedData);
                  
                  teamAdvancedData.forEach((teamStats: any) => {
                    if (teamStats.offense?.explosiveness && teamStats.team === teamName) {
                      advancedStats[teamStats.team] = {
                        explosiveness: teamStats.offense.explosiveness
                      };
                    }
                  });
                }
              } catch (error) {
                console.error(`Error fetching advanced stats for ${teamName}:`, error);
              }
            }
          }
          
          return {
            ...game,
            excitementIndex,
            advancedStats
          };
        } catch (error) {
          console.error('Error fetching additional metrics for game:', game.id, error);
          return game; // Return basic game data if additional metrics fail
        }
      })
    );
    
    return enhancedGames;
  } catch (error) {
    console.error('Error fetching box score data:', error);
    throw error;
  }
};