import { fetchGamesForTeam, fetchPlayByPlayData, ApiPlayData, TeamGame } from './api';
import { fetchBoxScore, Game as BoxScoreGame } from './boxScoreApi';
import { SeasonDataFetchResult } from '../types';
import { mapWithConcurrency, withRetry } from '../utils/asyncUtils';

// Cap simultaneous requests so we don't burst past the CFBD API rate limit.
const FETCH_CONCURRENCY = 4;

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

    // 4. Fetch play-by-play for each game with bounded concurrency + retry
    const allPlays: ApiPlayData[] = [];
    const perGamePlays = new Map<number, ApiPlayData[]>();
    const failedGames: number[] = [];
    let completed = 0;

    const results = await mapWithConcurrency(sortedGames, FETCH_CONCURRENCY, async (game) => {
      try {
        const plays = await withRetry(() =>
          fetchPlayByPlayData({
            year: game.season,
            week: game.week,
            seasonType: game.seasonType,
            team: params.team,
            gameId: game.id.toString()
          })
        );
        return { gameId: game.id, plays, ok: true };
      } catch (error) {
        console.warn(`Failed to load game ${game.id}:`, error);
        return { gameId: game.id, plays: [] as ApiPlayData[], ok: false };
      } finally {
        completed += 1;
        onProgress?.(completed, sortedGames.length);
      }
    });

    // 5. Aggregate results (in chronological game order)
    results.forEach((result) => {
      if (result.ok && result.plays.length > 0) {
        allPlays.push(...result.plays);
        perGamePlays.set(result.gameId, result.plays);
      } else {
        failedGames.push(result.gameId);
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
  let completed = 0;

  const results = await mapWithConcurrency(games, FETCH_CONCURRENCY, async (game) => {
    try {
      const boxScoreData = await withRetry(() =>
        fetchBoxScore({
          year: game.season,
          week: game.week,
          seasonType: game.seasonType,
          team,
          gameId: game.id.toString()
        })
      );
      return { gameId: game.id, boxScore: boxScoreData[0], ok: true };
    } catch (error) {
      console.error(`Failed to fetch box score for game ${game.id}:`, error);
      return { gameId: game.id, boxScore: undefined, ok: false };
    } finally {
      completed += 1;
      onProgress?.(completed, games.length);
    }
  });

  const boxScores: BoxScoreGame[] = [];
  results.forEach((result) => {
    if (result.ok && result.boxScore) {
      boxScores.push(result.boxScore);
    } else {
      failedGames.push(result.gameId);
    }
  });

  return { boxScores, failedGames };
};
