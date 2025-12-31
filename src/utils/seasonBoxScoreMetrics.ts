import { BoxScoreTeam, Game as BoxScoreGame } from '../services/boxScoreApi';

export interface AveragedBoxScoreStat {
  label: string;
  teamValue: string;
  oppValue: string;
}

export interface AveragedBoxScore {
  teamName: string;
  firstTableStats: AveragedBoxScoreStat[];
  secondTableStats: AveragedBoxScoreStat[];
}

export type BoxScoreMode = 'totals' | 'averages';

export const calculateAveragedBoxScore = (
  boxScores: BoxScoreGame[],
  team: string,
  mode: BoxScoreMode = 'averages'
): AveragedBoxScore => {
  if (boxScores.length === 0) {
    return {
      teamName: team,
      firstTableStats: [],
      secondTableStats: []
    };
  }

  // Helper to get team name from either 'school' or 'team' field
  const getTeamName = (t: BoxScoreTeam): string | null => {
    return t.school || t.team || null;
  };

  // Helper to find the selected team's data
  const findTeamData = (game: BoxScoreGame): { team: BoxScoreTeam; opponent: BoxScoreTeam } | null => {
    if (!game.teams || game.teams.length < 2) return null;

    const normalizeTeamName = (name: string) => {
      return name
        .replace(/\s+(crimson\s+tide|bulldogs|tigers|gators|volunteers|wildcats|rebels|aggies|gamecocks)/gi, '')
        .trim()
        .toLowerCase();
    };

    const selectedTeamData = game.teams.find(t => {
      const teamName = getTeamName(t);
      if (!teamName) return false;

      const normalizedTeamName = normalizeTeamName(teamName);
      const normalizedSelected = normalizeTeamName(team);

      return (
        normalizedTeamName === normalizedSelected ||
        normalizedTeamName.includes(normalizedSelected) ||
        normalizedSelected.includes(normalizedTeamName)
      );
    });

    if (selectedTeamData) {
      const opponentData = game.teams.find(t => t !== selectedTeamData);
      if (opponentData) {
        return { team: selectedTeamData, opponent: opponentData };
      }
    }

    return null;
  };

  // Helper to get stat value
  const getStat = (teamData: BoxScoreTeam, category: string): number => {
    const stat = teamData.stats.find(s => s.category === category);
    return stat ? parseFloat(stat.stat) || 0 : 0;
  };

  // Helper to parse formatted stats like "10-15" and return the numerator
  const parseFormattedStat = (teamData: BoxScoreTeam, category: string, part: 'first' | 'second'): number => {
    const stat = teamData.stats.find(s => s.category === category);
    if (!stat) return 0;

    const parts = stat.stat.split('-');
    if (parts.length < 2) return 0;

    return part === 'first' ? (parseFloat(parts[0]) || 0) : (parseFloat(parts[1]) || 0);
  };

  // Helper to parse possession time "MM:SS" to minutes
  const parsePossessionTime = (teamData: BoxScoreTeam): number => {
    const stat = teamData.stats.find(s => s.category === 'possessionTime');
    if (!stat) return 0;

    const parts = stat.stat.split(':');
    if (parts.length < 2) return 0;

    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;

    return minutes + (seconds / 60);
  };

  // Accumulators for all stats
  const accumulators = {
    // Team stats
    teamPoints: 0,
    teamTotalYards: 0,
    teamRushYards: 0,
    teamRushAttempts: 0,
    teamPassYards: 0,
    teamPassAttempts: 0,
    teamFirstDowns: 0,
    team3rdDownConv: 0,
    team3rdDownAtt: 0,
    team4thDownConv: 0,
    team4thDownAtt: 0,
    teamExplosiveness: 0,
    teamTurnovers: 0,
    teamTackles: 0,
    teamSacks: 0,
    teamPenalties: 0,
    teamPenaltyYards: 0,
    teamPossessionTime: 0,

    // Opponent stats
    oppPoints: 0,
    oppTotalYards: 0,
    oppRushYards: 0,
    oppRushAttempts: 0,
    oppPassYards: 0,
    oppPassAttempts: 0,
    oppFirstDowns: 0,
    opp3rdDownConv: 0,
    opp3rdDownAtt: 0,
    opp4thDownConv: 0,
    opp4thDownAtt: 0,
    oppExplosiveness: 0,
    oppTurnovers: 0,
    oppTackles: 0,
    oppSacks: 0,
    oppPenalties: 0,
    oppPenaltyYards: 0,
    oppPossessionTime: 0,

    excitementIndex: 0,
    gamesCount: 0
  };

  // Accumulate stats from all games
  boxScores.forEach(game => {
    const teamData = findTeamData(game);
    if (!teamData) return;

    const { team: teamStats, opponent: oppStats } = teamData;
    const teamName = getTeamName(teamStats);

    // Team stats
    accumulators.teamPoints += teamStats.points;
    accumulators.teamTotalYards += getStat(teamStats, 'totalYards');
    accumulators.teamRushYards += getStat(teamStats, 'rushingYards');
    accumulators.teamRushAttempts += getStat(teamStats, 'rushingAttempts');
    accumulators.teamPassYards += getStat(teamStats, 'netPassingYards');
    accumulators.teamPassAttempts += getStat(teamStats, 'completionAttempts');
    accumulators.teamFirstDowns += getStat(teamStats, 'firstDowns');
    accumulators.team3rdDownConv += parseFormattedStat(teamStats, 'thirdDownEff', 'first');
    accumulators.team3rdDownAtt += parseFormattedStat(teamStats, 'thirdDownEff', 'second');
    accumulators.team4thDownConv += parseFormattedStat(teamStats, 'fourthDownEff', 'first');
    accumulators.team4thDownAtt += parseFormattedStat(teamStats, 'fourthDownEff', 'second');
    accumulators.teamTurnovers += getStat(teamStats, 'turnovers');
    accumulators.teamTackles += getStat(teamStats, 'tackles');
    accumulators.teamSacks += getStat(teamStats, 'sacks');
    accumulators.teamPossessionTime += parsePossessionTime(teamStats);

    // Parse penalties (format: "penalties-yards")
    const penaltyStat = teamStats.stats.find(s => s.category === 'totalPenaltiesYards');
    if (penaltyStat) {
      const parts = penaltyStat.stat.split('-');
      if (parts.length >= 2) {
        accumulators.teamPenalties += parseFloat(parts[0]) || 0;
        accumulators.teamPenaltyYards += parseFloat(parts[1]) || 0;
      }
    }

    // Opponent stats
    accumulators.oppPoints += oppStats.points;
    accumulators.oppTotalYards += getStat(oppStats, 'totalYards');
    accumulators.oppRushYards += getStat(oppStats, 'rushingYards');
    accumulators.oppRushAttempts += getStat(oppStats, 'rushingAttempts');
    accumulators.oppPassYards += getStat(oppStats, 'netPassingYards');
    accumulators.oppPassAttempts += getStat(oppStats, 'completionAttempts');
    accumulators.oppFirstDowns += getStat(oppStats, 'firstDowns');
    accumulators.opp3rdDownConv += parseFormattedStat(oppStats, 'thirdDownEff', 'first');
    accumulators.opp3rdDownAtt += parseFormattedStat(oppStats, 'thirdDownEff', 'second');
    accumulators.opp4thDownConv += parseFormattedStat(oppStats, 'fourthDownEff', 'first');
    accumulators.opp4thDownAtt += parseFormattedStat(oppStats, 'fourthDownEff', 'second');
    accumulators.oppTurnovers += getStat(oppStats, 'turnovers');
    accumulators.oppTackles += getStat(oppStats, 'tackles');
    accumulators.oppSacks += getStat(oppStats, 'sacks');
    accumulators.oppPossessionTime += parsePossessionTime(oppStats);

    const oppPenaltyStat = oppStats.stats.find(s => s.category === 'totalPenaltiesYards');
    if (oppPenaltyStat) {
      const parts = oppPenaltyStat.stat.split('-');
      if (parts.length >= 2) {
        accumulators.oppPenalties += parseFloat(parts[0]) || 0;
        accumulators.oppPenaltyYards += parseFloat(parts[1]) || 0;
      }
    }

    // Excitement index
    if (game.excitementIndex) {
      accumulators.excitementIndex += game.excitementIndex;
    }

    // Explosiveness
    if (game.advancedStats && teamName && game.advancedStats[teamName]?.explosiveness) {
      accumulators.teamExplosiveness += game.advancedStats[teamName].explosiveness!;
    }

    const oppName = getTeamName(oppStats);
    if (game.advancedStats && oppName && game.advancedStats[oppName]?.explosiveness) {
      accumulators.oppExplosiveness += game.advancedStats[oppName].explosiveness!;
    }

    accumulators.gamesCount++;
  });

  const n = accumulators.gamesCount || 1; // Avoid division by zero
  const divisor = mode === 'totals' ? 1 : n; // Use 1 for totals, n for averages

  // Helper to format minutes to MM:SS
  const formatPossessionTime = (totalMinutes: number): string => {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper to format number based on mode
  const formatValue = (value: number, decimals: number = 1): string => {
    if (mode === 'totals') {
      // Format totals with comma separators for thousands
      return Math.round(value).toLocaleString('en-US');
    } else {
      // Format averages with decimal places
      return (value / n).toFixed(decimals);
    }
  };

  // First table stats (up to yards per pass)
  const firstTableStats: AveragedBoxScoreStat[] = [
    {
      label: 'Points',
      teamValue: formatValue(accumulators.teamPoints),
      oppValue: formatValue(accumulators.oppPoints),
    },
    {
      label: 'Game Excitement',
      teamValue: formatValue(accumulators.excitementIndex),
      oppValue: formatValue(accumulators.excitementIndex),
    },
    {
      label: 'Total yards',
      teamValue: formatValue(accumulators.teamTotalYards),
      oppValue: formatValue(accumulators.oppTotalYards),
    },
    {
      label: 'Rush yards',
      teamValue: formatValue(accumulators.teamRushYards),
      oppValue: formatValue(accumulators.oppRushYards),
    },
    {
      label: 'Rush attempts',
      teamValue: formatValue(accumulators.teamRushAttempts),
      oppValue: formatValue(accumulators.oppRushAttempts),
    },
    {
      label: 'Yards per rush',
      teamValue: accumulators.teamRushAttempts > 0
        ? (accumulators.teamRushYards / accumulators.teamRushAttempts).toFixed(1)
        : '0.0',
      oppValue: accumulators.oppRushAttempts > 0
        ? (accumulators.oppRushYards / accumulators.oppRushAttempts).toFixed(1)
        : '0.0',
    },
    {
      label: 'Pass yards',
      teamValue: formatValue(accumulators.teamPassYards),
      oppValue: formatValue(accumulators.oppPassYards),
    },
    {
      label: 'Pass attempts',
      teamValue: formatValue(accumulators.teamPassAttempts),
      oppValue: formatValue(accumulators.oppPassAttempts),
    },
    {
      label: 'Yards per pass',
      teamValue: accumulators.teamPassAttempts > 0
        ? (accumulators.teamPassYards / accumulators.teamPassAttempts).toFixed(1)
        : '0.0',
      oppValue: accumulators.oppPassAttempts > 0
        ? (accumulators.oppPassYards / accumulators.oppPassAttempts).toFixed(1)
        : '0.0',
    },
  ];

  // Second table stats (from 1st downs onwards)
  const secondTableStats: AveragedBoxScoreStat[] = [
    {
      label: '1st downs',
      teamValue: formatValue(accumulators.teamFirstDowns),
      oppValue: formatValue(accumulators.oppFirstDowns),
    },
    {
      label: '3rd down eff',
      teamValue: mode === 'totals'
        ? `${Math.round(accumulators.team3rdDownConv).toLocaleString('en-US')}-${Math.round(accumulators.team3rdDownAtt).toLocaleString('en-US')}`
        : `${(accumulators.team3rdDownConv / n).toFixed(1)}-${(accumulators.team3rdDownAtt / n).toFixed(1)}`,
      oppValue: mode === 'totals'
        ? `${Math.round(accumulators.opp3rdDownConv).toLocaleString('en-US')}-${Math.round(accumulators.opp3rdDownAtt).toLocaleString('en-US')}`
        : `${(accumulators.opp3rdDownConv / n).toFixed(1)}-${(accumulators.opp3rdDownAtt / n).toFixed(1)}`,
    },
    {
      label: '4th down eff',
      teamValue: mode === 'totals'
        ? `${Math.round(accumulators.team4thDownConv).toLocaleString('en-US')}-${Math.round(accumulators.team4thDownAtt).toLocaleString('en-US')}`
        : `${(accumulators.team4thDownConv / n).toFixed(1)}-${(accumulators.team4thDownAtt / n).toFixed(1)}`,
      oppValue: mode === 'totals'
        ? `${Math.round(accumulators.opp4thDownConv).toLocaleString('en-US')}-${Math.round(accumulators.opp4thDownAtt).toLocaleString('en-US')}`
        : `${(accumulators.opp4thDownConv / n).toFixed(1)}-${(accumulators.opp4thDownAtt / n).toFixed(1)}`,
    },
    {
      label: 'Explosiveness',
      teamValue: formatValue(accumulators.teamExplosiveness, 2),
      oppValue: formatValue(accumulators.oppExplosiveness, 2),
    },
    {
      label: 'Turnovers',
      teamValue: formatValue(accumulators.teamTurnovers),
      oppValue: formatValue(accumulators.oppTurnovers),
    },
    {
      label: 'Tackles',
      teamValue: formatValue(accumulators.teamTackles),
      oppValue: formatValue(accumulators.oppTackles),
    },
    {
      label: 'Sacks',
      teamValue: formatValue(accumulators.teamSacks),
      oppValue: formatValue(accumulators.oppSacks),
    },
    {
      label: 'Penalties-Yds',
      teamValue: mode === 'totals'
        ? `${Math.round(accumulators.teamPenalties).toLocaleString('en-US')}-${Math.round(accumulators.teamPenaltyYards).toLocaleString('en-US')}`
        : `${(accumulators.teamPenalties / n).toFixed(1)}-${(accumulators.teamPenaltyYards / n).toFixed(1)}`,
      oppValue: mode === 'totals'
        ? `${Math.round(accumulators.oppPenalties).toLocaleString('en-US')}-${Math.round(accumulators.oppPenaltyYards).toLocaleString('en-US')}`
        : `${(accumulators.oppPenalties / n).toFixed(1)}-${(accumulators.oppPenaltyYards / n).toFixed(1)}`,
    },
    {
      label: 'Possession',
      teamValue: mode === 'totals'
        ? formatPossessionTime(accumulators.teamPossessionTime)
        : formatPossessionTime(accumulators.teamPossessionTime / n),
      oppValue: mode === 'totals'
        ? formatPossessionTime(accumulators.oppPossessionTime)
        : formatPossessionTime(accumulators.oppPossessionTime / n),
    },
  ];

  return {
    teamName: team,
    firstTableStats,
    secondTableStats
  };
};
