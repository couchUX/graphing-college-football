import { fetchGamesForTeam, fetchPlayByPlayData, ApiPlayData, TeamGame } from './api';
import { fetchBoxScore, Game as BoxScoreGame } from './boxScoreApi';
import { SeasonDataFetchResult } from '../types';

export const fetchSeasonPlayByPlayData = async (
  params: {
    year: number;
    team: string;
    selectedGameIds: number[];
  },
  onProgress?: (current: number, total: number) => void
): Promise<SeasonDataFetchResult> => {
  try {
    // 1. Fetch all games for team/year
    const allGames = await fetchGamesForTeam({ year: params.year, team: params.team });

    // 2. Filter by selected game IDs
    const filteredGames = allGames.filter(g => params.selectedGameIds.includes(g.id));

    // 3. Sort chronologically (regular season by week, then postseason by week)
    const sortedGames = filteredGames.sort((a, b) => {
      if (a.seasonType !== b.seasonType) {
        return a.seasonType === 'regular' ? -1 : 1;
      }
      return a.week - b.week;
    });

    // 4. Fetch play-by-play for each game in parallel
    const allPlays: ApiPlayData[] = [];
    const perGamePlays = new Map<number, ApiPlayData[]>();
    const failedGames: number[] = [];

    const playResults = await Promise.allSettled(
      sortedGames.map((game, index) =>
        fetchPlayByPlayData({
          year: game.season,
          week: game.week,
          seasonType: game.seasonType,
          team: params.team,
          gameId: game.id.toString()
        }).then(plays => {
          if (onProgress) {
            onProgress(index + 1, sortedGames.length);
          }
          return { gameId: game.id, plays };
        })
      )
    );

    // 5. Aggregate results
    playResults.forEach((result, index) => {
      const game = sortedGames[index];
      if (result.status === 'fulfilled' && result.value.plays.length > 0) {
        allPlays.push(...result.value.plays);
        perGamePlays.set(game.id, result.value.plays);
      } else {
        failedGames.push(game.id);
        if (result.status === 'rejected') {
          console.warn(`Failed to load game ${game.id}:`, result.reason);
        }
      }
    });

    return { games: sortedGames, allPlays, perGamePlays, failedGames };
  } catch (error) {
    console.error('Error fetching season data:', error);
    throw error;
  }
};

export const fetchSeasonBoxScores = async (
  games: TeamGame[],
  team: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ boxScores: BoxScoreGame[]; failedGames: number[] }> => {
  const failedGames: number[] = [];

  const boxScoreResults = await Promise.allSettled(
    games.map(async (game, index) => {
      try {
        const boxScoreData = await fetchBoxScore({
          year: game.season,
          week: game.week,
          seasonType: game.seasonType,
          team,
          gameId: game.id.toString()
        });

        if (onProgress) {
          onProgress(index + 1, games.length);
        }

        return boxScoreData[0]; // fetchBoxScore returns an array, we want the first game
      } catch (error) {
        console.error(`Failed to fetch box score for game ${game.id}:`, error);
        failedGames.push(game.id);
        throw error;
      }
    })
  );

  const boxScores: BoxScoreGame[] = [];
  boxScoreResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      boxScores.push(result.value);
    } else {
      failedGames.push(games[index].id);
    }
  });

  return { boxScores, failedGames };
};
