import { useState, useEffect } from 'react';
import { fetchBoxScore, BoxScoreTeam, Game } from '../services/boxScoreApi';
import { PlayData } from '../types';

export interface BoxScoreStat {
  label: string;
  team1Value: string;
  team2Value: string;
}

interface ProcessedBoxScore {
  team1Name: string;
  team2Name: string;
  firstTableStats: BoxScoreStat[];
  secondTableStats: BoxScoreStat[];
}

export const useBoxScore = (params: {
  year: number;
  week: number;
  seasonType: string;
  team: string;
  gameId?: string;
} | null, plays?: PlayData[], opponentTeam?: string) => {
  const [boxScoreData, setBoxScoreData] = useState<ProcessedBoxScore | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params) {
      setBoxScoreData(null);
      setError(null);
      return;
    }
    
    // If plays array is provided but empty, clear box score data
    if (plays && plays.length === 0) {
      console.log('No plays data available, clearing box score');
      setBoxScoreData(null);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const games = await fetchBoxScore({
          ...params,
          gameId: params.gameId
        });
        
        if (games.length === 0) {
          throw new Error('No games found for the specified parameters');
        }
        
        const game = games[0];
        if (!game.teams || game.teams.length < 2) {
          throw new Error('Insufficient team data received');
        }

        // Process the raw data into our format
        const processedData = processBoxScoreData(game.teams, params.team, plays, opponentTeam, game);
        setBoxScoreData(processedData);
      } catch (err) {
        setError('Failed to load box score data');
        setBoxScoreData(null); // Clear existing box score data on error
        console.error('Error in useBoxScore:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params?.year, params?.week, params?.seasonType, params?.team, plays, opponentTeam]);

  return { boxScoreData, loading, error };
};

const processBoxScoreData = (rawData: BoxScoreTeam[], selectedTeam: string, plays?: PlayData[], opponentTeam?: string, game?: Game): ProcessedBoxScore => {

  // Ensure we have at least 2 teams
  if (!rawData || rawData.length < 2) {
    console.error('Insufficient team data - need at least 2 teams, got:', rawData?.length || 0);
    return {
      team1Name: selectedTeam,
      team2Name: opponentTeam || 'Opponent',
      firstTableStats: [],
      secondTableStats: [],
    };
  }

  // Assign teams based on logical order (selected team first, opponent second)
  // instead of raw API order which might be home/away
  let team1: BoxScoreTeam;
  let team2: BoxScoreTeam;
  let team1Name: string;
  let team2Name: string;
  
  const selectedTeamData = rawData.find(team => 
    team.team && (
      team.team.toLowerCase().includes(selectedTeam.toLowerCase()) ||
      selectedTeam.toLowerCase().includes(team.team.toLowerCase())
    )
  );
  
  if (selectedTeamData) {
    // Use the matched team as team1 (main team)
    team1 = selectedTeamData;
    team1Name = selectedTeamData.team;
    // Use the other team as team2 (opponent)
    const opponentTeamData = rawData.find(team => team !== selectedTeamData);
    if (opponentTeamData) {
      team2 = opponentTeamData;
      team2Name = opponentTeamData.team;
    } else {
      team2 = rawData[1];
      team2Name = rawData[1].team || (opponentTeam || 'Opponent');
    }
  } else {
    // Fallback to original order if no match found
    team1 = rawData[0];
    team2 = rawData[1];
    team1Name = rawData[0].team || selectedTeam;
    team2Name = rawData[1].team || (opponentTeam || 'Opponent');
  }

  // Helper function to get stat value
  const getStat = (team: BoxScoreTeam, category: string): string => {
    const stat = team.stats.find(s => s.category === category);
    const value = stat ? stat.stat : '0';
    console.log(`getStat for category "${category}":`, value);
    return value;
  };

  // Helper function to get stat value with fallback category names
  const getStatWithFallback = (team: BoxScoreTeam, primaryCategory: string, fallbackCategories: string[] = []): string => {
    // Try primary category first
    let stat = team.stats.find(s => s.category === primaryCategory);
    if (stat) {
      console.log(`Found stat for primary category "${primaryCategory}":`, stat.stat);
      return stat.stat;
    }
    
    // Try fallback categories
    for (const fallback of fallbackCategories) {
      stat = team.stats.find(s => s.category === fallback);
      if (stat) {
        console.log(`Found stat for fallback category "${fallback}":`, stat.stat);
        return stat.stat;
      }
    }
    
    console.log(`No stat found for "${primaryCategory}" or fallbacks:`, fallbackCategories);
    console.log('Available categories:', team.stats.map(s => s.category));
    return '0';
  };

  // Helper function to safely parse integer
  const parseIntSafe = (value: string): number => {
    const parsed = parseInt(value) || 0;
    return parsed;
  };

  // Helper function to calculate yards per attempt
  const calculateYardsPerAttempt = (yards: string, attempts: string): string => {
    const y = parseIntSafe(yards);
    const a = parseIntSafe(attempts);
    console.log(`calculateYardsPerAttempt: ${yards} yards, ${attempts} attempts -> ${y}/${a}`);
    return a > 0 ? (y / a).toFixed(1) : '0.0';
  };

  // Helper function to format completion stats
  const formatCompletions = (completions: string, attempts: string): string => {
    const comp = parseIntSafe(completions);
    const att = parseIntSafe(attempts);
    console.log(`formatCompletions: ${completions} completions, ${attempts} attempts -> ${comp}-${att}`);
    return `${comp}-${att}`;
  };

  // Helper function to format down efficiency
  const formatDownEfficiency = (conversions: string, attempts: string): string => {
    const conv = parseIntSafe(conversions);
    const att = parseIntSafe(attempts);
    console.log(`formatDownEfficiency: ${conversions} conversions, ${attempts} attempts -> ${conv}-${att}`);
    return `${conv}-${att}`;
  };

  // Helper function to format penalties
  const formatPenalties = (penalties: string, yards: string): string => {
    const pen = parseIntSafe(penalties);
    const yds = parseIntSafe(yards);
    console.log(`formatPenalties: ${penalties} penalties, ${yards} yards -> ${pen}-${yds}`);
    return `${pen}-${yds}`;
  };

  // First table stats (up to yards per pass)
  const firstTableStats: BoxScoreStat[] = [
    {
      label: 'Points',
      team1Value: team1.points.toString(),
      team2Value: team2.points.toString(),
    },
    {
      label: 'Game Excitement',
      team1Value: game?.excitementIndex ? game.excitementIndex.toFixed(1) : '0',
      team2Value: game?.excitementIndex ? game.excitementIndex.toFixed(1) : '0',
    },
    {
      label: 'Total yards',
      team1Value: getStat(team1, 'totalYards'),
      team2Value: getStat(team2, 'totalYards'),
    },
    {
      label: 'Rush yards',
      team1Value: getStat(team1, 'rushingYards'),
      team2Value: getStat(team2, 'rushingYards'),
    },
    {
      label: 'Rush attempts',
      team1Value: getStat(team1, 'rushingAttempts'),
      team2Value: getStat(team2, 'rushingAttempts'),
    },
    {
      label: 'Yards per rush',
      team1Value: getStat(team1, 'yardsPerRushAttempt'),
      team2Value: getStat(team2, 'yardsPerRushAttempt'),
    },
    {
      label: 'Pass yards',
      team1Value: getStat(team1, 'netPassingYards'),
      team2Value: getStat(team2, 'netPassingYards'),
    },
    {
      label: 'Pass attempts',
      team1Value: getStat(team1, 'completionAttempts'),
      team2Value: getStat(team2, 'completionAttempts'),
    },
    {
      label: 'Yards per pass',
      team1Value: getStat(team1, 'yardsPerPass'),
      team2Value: getStat(team2, 'yardsPerPass'),
    },
  ];

  // Second table stats (from 1st downs onwards)
  const secondTableStats: BoxScoreStat[] = [
    {
      label: '1st downs',
      team1Value: getStat(team1, 'firstDowns'),
      team2Value: getStat(team2, 'firstDowns'),
    },
    {
      label: '3rd down eff',
      team1Value: getStat(team1, 'thirdDownEff'),
      team2Value: getStat(team2, 'thirdDownEff'),
    },
    {
      label: '4th down eff',
      team1Value: getStat(team1, 'fourthDownEff'),
      team2Value: getStat(team2, 'fourthDownEff'),
    },
    {
      label: 'Explosiveness',
      team1Value: game?.advancedStats?.[team1Name]?.explosiveness ? game.advancedStats[team1Name].explosiveness!.toFixed(2) : '0',
      team2Value: game?.advancedStats?.[team2Name]?.explosiveness ? game.advancedStats[team2Name].explosiveness!.toFixed(2) : '0',
    },
    {
      label: 'Turnovers',
      team1Value: getStat(team1, 'turnovers'),
      team2Value: getStat(team2, 'turnovers'),
    },
    {
      label: 'Tackles',
      team1Value: getStat(team1, 'tackles'),
      team2Value: getStat(team2, 'tackles'),
    },
    {
      label: 'Sacks',
      team1Value: getStat(team1, 'sacks'),
      team2Value: getStat(team2, 'sacks'),
    },
    {
      label: 'Penalties-Yds',
      team1Value: getStat(team1, 'totalPenaltiesYards'),
      team2Value: getStat(team2, 'totalPenaltiesYards'),
    },
    {
      label: 'Possession',
      team1Value: getStat(team1, 'possessionTime'),
      team2Value: getStat(team2, 'possessionTime'),
    },
  ];

  return {
    team1Name,
    team2Name,
    firstTableStats,
    secondTableStats,
  };
};