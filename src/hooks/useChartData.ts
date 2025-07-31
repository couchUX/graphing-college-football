import { useMemo } from 'react';
import { PlayData } from '../types';
import { getTeamColors } from '../utils/teamColors';
import { calculatePlayerStats } from '../utils/metrics';
import { 
  getPointColors, 
  createQuarterGridlines, 
  createTeamQuarterGridlines, 
  createReferenceArea, 
  createBelowZeroArea,
  createTeamVsOpponentBarData,
  createPlayerData
} from '../utils/chartHelpers';
import { NCAA_AVERAGE_SR, RUSH_PASS_SPLIT } from '../utils/chartConfig';

export const useChartData = (plays: PlayData[], team: string) => {
  return useMemo(() => {
    // Get opponent team
    const opponentTeam = plays.find(p => p.offense !== team && p.defense !== team)?.offense || 
                        plays.find(p => p.defense !== team)?.defense || 'Opponent';

    // Filter plays by team
    const teamPlays = plays.filter(p => p.offense === team);
    const opponentPlays = plays.filter(p => p.offense === opponentTeam);

    // Get team colors
    const teamColors = getTeamColors(team);
    const opponentColors = getTeamColors(opponentTeam);

    // Calculate basic stats
    const teamSuccessfulPlays = teamPlays.filter(p => p.success).length;
    const teamExplosivePlays = teamPlays.filter(p => p.explosiveness).length;
    const opponentSuccessfulPlays = opponentPlays.filter(p => p.success).length;
    const opponentExplosivePlays = opponentPlays.filter(p => p.explosiveness).length;

    // Play number bounds
    const maxPlayNumber = Math.max(...plays.map(p => p.playNumber));
    const maxTeamPlayNumber = Math.max(...teamPlays.map(p => p.teamPlayNumber));
    const maxOpponentPlayNumber = Math.max(...opponentPlays.map(p => p.teamPlayNumber));

    // 1. Overall Team Performance Chart
    const overallTeamData = {
      labels: [team, opponentTeam],
      datasets: [
        {
          label: 'XR',
          data: [
            teamPlays.length > 0 ? teamExplosivePlays / teamPlays.length : 0,
            opponentPlays.length > 0 ? opponentExplosivePlays / opponentPlays.length : 0
          ],
          backgroundColor: [teamColors.explosive, opponentColors.explosive],
          stack: 'SRXR',
          datalabels: {
            display: false
          }
        },
        {
          label: 'SR',
          data: [
            teamPlays.length > 0 ? teamSuccessfulPlays / teamPlays.length : 0,
            opponentPlays.length > 0 ? opponentSuccessfulPlays / opponentPlays.length : 0
          ],
          backgroundColor: [teamColors.success, opponentColors.success],
          stack: 'SRXR',
          datalabels: {
            display: true,
            formatter: (value: number, context: any) => {
              return context.dataIndex === 0 ? teamPlays.length : opponentPlays.length;
            }
          }
        },
        // NCAA Average reference line
        {
          type: 'line' as const,
          data: [NCAA_AVERAGE_SR, NCAA_AVERAGE_SR],
          label: "NCAA Avg SR",
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [3, 3],
          pointRadius: 0,
          datalabels: {
            display: false
          }
        }
      ]
    };

    // 2. SR and XR by Team - using cumulative data from processed plays
    const teamLinesData = {
      datasets: [
        // Reference area first (drawn behind other elements)
        createReferenceArea(maxPlayNumber, NCAA_AVERAGE_SR, "NCAA Avg SR"),
        {
          data: teamPlays.map(play => ({ 
            x: play.playNumber, 
            y: play.teamCumulativeXR, 
            text: play.playText 
          })),
          label: `${team} XR`,
          borderColor: teamColors.explosive,
          borderWidth: 2.2,
          fill: false,
        },
        {
          data: teamPlays.map(play => ({ 
            x: play.playNumber, 
            y: play.teamCumulativeSR, 
            text: play.playText 
          })),
          label: `${team} SR`,
          borderColor: teamColors.success,
          borderWidth: 2.2,
          fill: false,
        },
        {
          data: opponentPlays.map(play => ({ 
            x: play.playNumber, 
            y: play.teamCumulativeXR, 
            text: play.playText 
          })),
          label: `${opponentTeam} XR`,
          borderColor: opponentColors.explosive,
          borderWidth: 2.2,
          borderDash: [4, 4],
          fill: false,
        },
        {
          data: opponentPlays.map(play => ({ 
            x: play.playNumber, 
            y: play.teamCumulativeSR, 
            text: play.playText 
          })),
          label: `${opponentTeam} SR`,
          borderColor: opponentColors.success,
          borderWidth: 2.2,
          borderDash: [4, 4],
          fill: false,
        },
        // Quarter gridlines
        createQuarterGridlines(plays, maxPlayNumber, 0, 1)
      ],
    };

    // 3. SR by Play Type - Team version
    const teamPlayTypeLinesData = {
      datasets: [
        // Reference area first
        createReferenceArea(maxTeamPlayNumber, NCAA_AVERAGE_SR, "NCAA Avg SR"),
        {
          data: teamPlays.map(play => ({
            x: play.teamPlayNumber,
            y: play.teamRushCumulativeSR,
            text: play.playText,
          })),
          label: `${team} Rush SR`,
          borderColor: teamColors.explosive,
          backgroundColor: teamPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            if (!isRush) return 'rgba(255,255,255,0.9)';
            return getPointColors([play], teamColors)[0];
          }),
          borderWidth: 2,
          pointStyle: 'circle',
          pointRadius: teamPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            return isRush ? 4 : 0;
          }),
          pointBorderWidth: 1,
          pointBorderColor: teamColors.explosive,
          showLine: true,
        },
        {
          data: teamPlays.map(play => ({
            x: play.teamPlayNumber,
            y: play.teamPassCumulativeSR,
            text: play.playText,
          })),
          label: `${team} Pass SR`,
          borderColor: teamColors.explosive,
          backgroundColor: teamPlays.map(play => {
            const isPass = play.playType?.toLowerCase().includes('pass');
            if (!isPass) return 'rgba(255,255,255,0.9)';
            return getPointColors([play], teamColors)[0];
          }),
          borderWidth: 2,
          pointStyle: 'triangle',
          pointRadius: teamPlays.map(play => {
            const isPass = play.playType?.toLowerCase().includes('pass');
            return isPass ? 6 : 0;
          }),
          pointBorderWidth: 1,
          pointBorderColor: teamColors.explosive,
          borderDash: [4, 4],
          showLine: true,
        },
        // Quarter gridlines
        createTeamQuarterGridlines(teamPlays, maxTeamPlayNumber, 0, 1)
      ],
    };

    // 4. SR by Play Type - Opponent version
    const opponentPlayTypeLinesData = {
      datasets: [
        // Reference area first
        createReferenceArea(maxOpponentPlayNumber, NCAA_AVERAGE_SR, "NCAA Avg SR"),
        {
          data: opponentPlays.map(play => ({
            x: play.teamPlayNumber,
            y: play.teamRushCumulativeSR,
            text: play.playText,
          })),
          label: `${opponentTeam} Rush SR`,
          borderColor: opponentColors.explosive,
          backgroundColor: opponentPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            if (!isRush) return 'rgba(255,255,255,0.9)';
            return getPointColors([play], opponentColors)[0];
          }),
          borderWidth: 2,
          pointStyle: 'circle',
          pointRadius: opponentPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            return isRush ? 4 : 0;
          }),
          pointBorderWidth: 1,
          pointBorderColor: opponentColors.explosive,
          showLine: true,
        },
        {
          data: opponentPlays.map(play => ({
            x: play.teamPlayNumber,
            y: play.teamPassCumulativeSR,
            text: play.playText,
          })),
          label: `${opponentTeam} Pass SR`,
          borderColor: opponentColors.explosive,
          backgroundColor: opponentPlays.map(play => {
            const isPass = play.playType?.toLowerCase().includes('pass');
            if (!isPass) return 'rgba(255,255,255,0.9)';
            return getPointColors([play], opponentColors)[0];
          }),
          borderWidth: 2,
          pointStyle: 'triangle',
          pointRadius: opponentPlays.map(play => {
            const isPass = play.playType?.toLowerCase().includes('pass');
            return isPass ? 6 : 0;
          }),
          pointBorderWidth: 1,
          pointBorderColor: opponentColors.explosive,
          borderDash: [4, 4],
          showLine: true,
        },
        // Quarter gridlines
        createTeamQuarterGridlines(opponentPlays, maxOpponentPlayNumber, 0, 1)
      ],
    };

    // 5. Rush Rate - Team version
    const teamRushRateData = {
      datasets: [
        // 50/50 reference area first
        createReferenceArea(maxTeamPlayNumber, RUSH_PASS_SPLIT, "50/50"),
        {
          data: teamPlays.map(play => ({
            x: play.teamPlayNumber,
            y: play.teamCumulativeRushRate,
            text: play.playText
          })),
          label: `${team} Rush Rate`,
          borderColor: teamColors.explosive,
          backgroundColor: teamColors.light,
          borderWidth: 2,
          pointBackgroundColor: teamPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            if (!isRush) return 'rgba(255,255,255,0.9)';
            return getPointColors([play], teamColors)[0];
          }),
          pointStyle: teamPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            return isRush ? 'circle' : 'triangle';
          }),
          pointRadius: teamPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            return isRush ? 4 : 5.5;
          }),
          pointBorderWidth: 1,
          pointBorderColor: teamColors.explosive,
          fill: true,
        },
        // Quarter gridlines
        createTeamQuarterGridlines(teamPlays, maxTeamPlayNumber, 0, 1)
      ],
    };

    // 6. Rush Rate - Opponent version
    const opponentRushRateData = {
      datasets: [
        // 50/50 reference area first
        createReferenceArea(maxOpponentPlayNumber, RUSH_PASS_SPLIT, "50/50"),
        {
          data: opponentPlays.map(play => ({
            x: play.teamPlayNumber,
            y: play.teamCumulativeRushRate,
            text: play.playText
          })),
          label: `${opponentTeam} Rush Rate`,
          borderColor: opponentColors.explosive,
          backgroundColor: opponentColors.light,
          borderWidth: 2,
          pointBackgroundColor: opponentPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            if (!isRush) return 'rgba(255,255,255,0.9)';
            return getPointColors([play], opponentColors)[0];
          }),
          pointStyle: opponentPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            return isRush ? 'circle' : 'triangle';
          }),
          pointRadius: opponentPlays.map(play => {
            const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
            return isRush ? 4 : 5.5;
          }),
          pointBorderWidth: 1,
          pointBorderColor: opponentColors.explosive,
          fill: true,
        },
        // Quarter gridlines
        createTeamQuarterGridlines(opponentPlays, maxOpponentPlayNumber, 0, 1)
      ],
    };

    // 7 & 8. Play Maps
    const teamRushPlays = teamPlays.filter(p => p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run'));
    const teamPassPlays = teamPlays.filter(p => p.playType?.toLowerCase().includes('pass'));
    const oppRushPlays = opponentPlays.filter(p => p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run'));
    const oppPassPlays = opponentPlays.filter(p => p.playType?.toLowerCase().includes('pass'));

    // Calculate Y-axis bounds with defaults
    const teamYardsGained = teamPlays.map(p => p.yardsGained);
    const teamMinY = Math.min(...teamYardsGained, -15);
    const teamMaxY = Math.max(...teamYardsGained, 75);

    const oppYardsGained = opponentPlays.map(p => p.yardsGained);
    const oppMinY = Math.min(...oppYardsGained, -15);
    const oppMaxY = Math.max(...oppYardsGained, 75);

    const teamPlayMapData = {
      datasets: [
        createBelowZeroArea(maxPlayNumber, teamMinY),
        {
          label: `${team} Rush Yards`,
          data: teamRushPlays.map((play) => ({
            x: play.playNumber,
            y: play.yardsGained,
            text: play.playText
          })),
          backgroundColor: getPointColors(teamRushPlays, teamColors),
          pointStyle: 'circle',
          pointRadius: 4,
          pointBorderWidth: 1,
          pointBorderColor: teamColors.explosive,
          showLine: false,
        },
        {
          label: `${team} Pass Yards`,
          data: teamPassPlays.map((play) => ({
            x: play.playNumber,
            y: play.yardsGained,
            text: play.playText
          })),
          backgroundColor: getPointColors(teamPassPlays, teamColors),
          pointStyle: 'triangle',
          pointRadius: 5.5,
          pointBorderWidth: 1,
          pointBorderColor: teamColors.explosive,
          showLine: false,
        },
        createQuarterGridlines(plays, maxPlayNumber, teamMinY, teamMaxY)
      ],
    };

    const opponentPlayMapData = {
      datasets: [
        createBelowZeroArea(maxPlayNumber, oppMinY),
        {
          label: `${opponentTeam} Rush Yards`,
          data: oppRushPlays.map((play) => ({
            x: play.playNumber,
            y: play.yardsGained,
            text: play.playText
          })),
          backgroundColor: getPointColors(oppRushPlays, opponentColors),
          pointStyle: 'circle',
          pointRadius: 4,
          pointBorderWidth: 1,
          pointBorderColor: opponentColors.explosive,
          showLine: false,
        },
        {
          label: `${opponentTeam} Pass Yards`,
          data: oppPassPlays.map((play) => ({
            x: play.playNumber,
            y: play.yardsGained,
            text: play.playText
          })),
          backgroundColor: getPointColors(oppPassPlays, opponentColors),
          pointStyle: 'triangle',
          pointRadius: 5.5,
          pointBorderWidth: 1,
          pointBorderColor: opponentColors.explosive,
          showLine: false,
        },
        createQuarterGridlines(plays, maxPlayNumber, oppMinY, oppMaxY)
      ],
    };

    // 9 & 10. Drive Metrics
    const teamDriveGroups = teamPlays.reduce((acc, play) => {
      if (!acc[play.driveNumber]) acc[play.driveNumber] = [];
      acc[play.driveNumber].push(play);
      return acc;
    }, {} as Record<number, PlayData[]>);

    const teamDriveData = Object.entries(teamDriveGroups).map(([driveNum, drivePlays]) => ({
      label: `Drive ${driveNum}`,
      count: drivePlays.length,
      sr: drivePlays.filter(p => p.success).length / drivePlays.length,
      xr: drivePlays.filter(p => p.explosiveness).length / drivePlays.length
    }));

    const opponentDriveGroups = opponentPlays.reduce((acc, play) => {
      if (!acc[play.driveNumber]) acc[play.driveNumber] = [];
      acc[play.driveNumber].push(play);
      return acc;
    }, {} as Record<number, PlayData[]>);

    const opponentDriveData = Object.entries(opponentDriveGroups).map(([driveNum, drivePlays]) => ({
      label: `Drive ${driveNum}`,
      count: drivePlays.length,
      sr: drivePlays.filter(p => p.success).length / drivePlays.length,
      xr: drivePlays.filter(p => p.explosiveness).length / drivePlays.length
    }));

    const teamDriveChartData = {
      labels: teamDriveData.map(d => d.label),
      datasets: [
        {
          label: `${team} XR`,
          data: teamDriveData.map(d => d.xr),
          backgroundColor: teamColors.explosive,
          stack: 'SRXR',
          yAxisID: 'y',
          datalabels: {
            display: false
          }
        },
        {
          label: `${team} SR`,
          data: teamDriveData.map(d => d.sr),
          backgroundColor: teamColors.success,
          stack: 'SRXR',
          yAxisID: 'y',
          datalabels: {
            display: false
          }
        },
        {
          label: 'Plays in drive',
          data: teamDriveData.map(d => d.count),
          backgroundColor: 'rgba(148, 148, 148, 0.8)',
          stack: 'Plays',
          yAxisID: 'y1',
          datalabels: {
            display: true
          }
        },
      ],
    };

    const opponentDriveChartData = {
      labels: opponentDriveData.map(d => d.label),
      datasets: [
        {
          label: `${opponentTeam} XR`,
          data: opponentDriveData.map(d => d.xr),
          backgroundColor: opponentColors.explosive,
          stack: 'SRXR',
          yAxisID: 'y',
          datalabels: {
            display: false
          }
        },
        {
          label: `${opponentTeam} SR`,
          data: opponentDriveData.map(d => d.sr),
          backgroundColor: opponentColors.success,
          stack: 'SRXR',
          yAxisID: 'y',
          datalabels: {
            display: false
          }
        },
        {
          label: 'Plays in drive',
          data: opponentDriveData.map(d => d.count),
          backgroundColor: 'rgba(148, 148, 148, 0.8)',
          stack: 'Plays',
          yAxisID: 'y1',
          datalabels: {
            display: true
          }
        },
      ],
    };

    // Player stats
    const teamRushers = calculatePlayerStats(teamPlays, 'rush');
    const teamPassers = calculatePlayerStats(teamPlays, 'pass');
    const teamReceivers = calculatePlayerStats(teamPlays, 'receive');
    
    const opponentRushers = calculatePlayerStats(opponentPlays, 'rush');
    const opponentPassers = calculatePlayerStats(opponentPlays, 'pass');
    const opponentReceivers = calculatePlayerStats(opponentPlays, 'receive');

    // Combine and sort players by team, then by total plays
    const allRushers = [
      ...teamRushers.map(p => ({ ...p, team: team, teamColors })),
      ...opponentRushers.map(p => ({ ...p, team: opponentTeam, teamColors: opponentColors }))
    ].sort((a, b) => {
      if (a.team === team && b.team !== team) return -1;
      if (a.team !== team && b.team === team) return 1;
      return b.total - a.total;
    });

    const allPassers = [
      ...teamPassers.map(p => ({ ...p, team: team, teamColors })),
      ...opponentPassers.map(p => ({ ...p, team: opponentTeam, teamColors: opponentColors }))
    ].sort((a, b) => {
      if (a.team === team && b.team !== team) return -1;
      if (a.team !== team && b.team === team) return 1;
      return b.total - a.total;
    });

    const allReceivers = [
      ...teamReceivers.map(p => ({ ...p, team: team, teamColors })),
      ...opponentReceivers.map(p => ({ ...p, team: opponentTeam, teamColors: opponentColors }))
    ].sort((a, b) => {
      if (a.team === team && b.team !== team) return -1;
      if (a.team !== team && b.team === team) return 1;
      return b.total - a.total;
    });

    return {
      team,
      opponentTeam,
      teamColors,
      opponentColors,
      teamPlays,
      opponentPlays,
      
      // Chart data
      overallTeamData,
      teamLinesData,
      teamPlayTypeLinesData,
      opponentPlayTypeLinesData,
      teamRushRateData,
      opponentRushRateData,
      teamPlayMapData,
      opponentPlayMapData,
      teamDriveChartData,
      opponentDriveChartData,
      
      // Y-axis bounds for play maps
      teamMinY,
      teamMaxY,
      oppMinY,
      oppMaxY,
      
      // Drive data for options
      teamDriveData,
      opponentDriveData,
      
      // Player data
      allRushers,
      allPassers,
      allReceivers,
      
      // Helper function for bar charts
      createTeamVsOpponentBarData: (category: 'quarter' | 'down' | 'playType' | 'redZone' | 'distance') =>
        createTeamVsOpponentBarData(category, teamPlays, opponentPlays, team, opponentTeam, teamColors, opponentColors)
    };
  }, [plays, team]);
};