import { PlayData } from '../types';
import { NCAA_AVERAGE_SR, RUSH_PASS_SPLIT } from './chartConfig';

// Helper function to format quarter labels (Q1-Q4, OT for all overtime)
export const formatQuarterLabel = (quarter: number): string => {
  if (quarter <= 4) {
    return `Q${quarter}`;
  } else {
    return 'OT';
  }
};

// Helper function to truncate player names for chart display
const truncatePlayerName = (name: string, maxLength: number = 14): string => {
  if (!name || name.length <= maxLength) return name;
  
  // Try to keep full first name and truncate last name
  const nameParts = name.split(' ');
  if (nameParts.length === 1) {
    return name.substring(0, maxLength - 1) + '…';
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  // If first name + space + one char of last name fits, use that
  if (firstName.length + 2 <= maxLength) {
    const remainingLength = maxLength - firstName.length - 2; // -2 for space and ellipsis
    if (lastName.length <= remainingLength + 1) {
      return name; // Full name fits
    }
    return `${firstName} ${lastName.substring(0, remainingLength)}…`;
  }
  
  // If first name is too long, truncate it
  return firstName.substring(0, maxLength - 1) + '…';
};

// Helper function to get point colors based on success/explosiveness
export const getPointColors = (playsArray: PlayData[], teamColors: any) => {
  return playsArray.map(play => {
    if (play.explosiveness) return teamColors.explosive;
    if (play.success) return teamColors.success;
    return 'rgba(255,255,255,0.9)';
  });
};

// Helper function to group plays by category and calculate SR/XR
export const groupByCategory = (playsArray: PlayData[], category: 'quarter' | 'down' | 'playType' | 'redZone' | 'distance') => {
  const groups: { [key: string]: PlayData[] } = {};
  
  playsArray.forEach(play => {
    let key: string;
    if (category === 'quarter') {
      key = formatQuarterLabel(play.quarter);
    } else if (category === 'down') {
      key = `${play.down}${play.down === 1 ? 'st' : play.down === 2 ? 'nd' : play.down === 3 ? 'rd' : 'th'} Down`;
    } else if (category === 'playType') {
      key = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run') ? 'Rush' : 'Pass';
    } else if (category === 'redZone') {
      key = play.yardsToGoal <= 20 ? 'Red Zone' : 'Other';
    } else if (category === 'distance') {
      if (play.distance <= 3) key = 'Short (1-3)';
      else if (play.distance <= 7) key = 'Medium (4-7)';
      else key = 'Long (8+)';
    } else {
      key = 'Other';
    }
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(play);
  });

  const results = Object.entries(groups).map(([label, groupPlays]) => ({
    label,
    count: groupPlays.length,
    sr: groupPlays.length > 0 ? groupPlays.filter(p => p.success).length / groupPlays.length : 0,
    xr: groupPlays.length > 0 ? groupPlays.filter(p => p.explosiveness).length / groupPlays.length : 0
  }));

  // Sort quarters in the correct order: Q1, Q2, Q3, Q4, OT
  if (category === 'quarter') {
    const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
    results.sort((a, b) => {
      const aIndex = quarterOrder.indexOf(a.label);
      const bIndex = quarterOrder.indexOf(b.label);
      return aIndex - bIndex;
    });
  }

  return results;
};

// Helper function to create quarter gridlines
export const createQuarterGridlines = (playsData: PlayData[], maxX: number, yMin: number = 0, yMax: number = 1) => {
  const quarters = Array.from(new Set(playsData.map(p => p.quarter))).sort((a, b) => a - b);
  const quarterLines: any[] = [];
  
  quarters.forEach(quarter => {
    const firstPlayOfQuarter = playsData.find(p => p.quarter === quarter);
    if (firstPlayOfQuarter) {
      quarterLines.push(
        { x: firstPlayOfQuarter.playNumber, y: yMin },
        { x: firstPlayOfQuarter.playNumber, y: yMax },
        { x: maxX, y: yMax },
        { x: maxX, y: yMin }
      );
    }
  });

  return {
    label: 'Quarters',
    data: quarterLines,
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    tension: 0,
    fill: false,
    pointRadius: 0,
    showLine: true,
    datalabels: {
      display: false
    }
  };
};

// Helper function to create quarter gridlines for team play numbers
export const createTeamQuarterGridlines = (teamPlaysData: PlayData[], maxX: number, yMin: number = 0, yMax: number = 1) => {
  const quarters = Array.from(new Set(teamPlaysData.map(p => p.quarter))).sort((a, b) => a - b);
  const quarterLines: any[] = [];
  
  quarters.forEach(quarter => {
    const firstPlayOfQuarter = teamPlaysData.find(p => p.quarter === quarter);
    if (firstPlayOfQuarter) {
      quarterLines.push(
        { x: firstPlayOfQuarter.teamPlayNumber, y: yMin },
        { x: firstPlayOfQuarter.teamPlayNumber, y: yMax },
        { x: maxX, y: yMax },
        { x: maxX, y: yMin }
      );
    }
  });

  return {
    label: 'Quarters',
    data: quarterLines,
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    tension: 0,
    fill: false,
    pointRadius: 0,
    showLine: true,
    datalabels: {
      display: false
    }
  };
};

// Helper function to create filled area below reference line
export const createReferenceArea = (maxX: number, referenceY: number, label: string) => ({
  label,
  data: [
    { x: 1, y: 0 },
    { x: 1, y: referenceY },
    { x: maxX, y: referenceY },
    { x: maxX, y: 0 }
  ],
  backgroundColor: 'rgba(0,0,0,0.03)',
  borderColor: 'transparent',
  pointRadius: 0,
  fill: true,
  tension: 0,
  showLine: true,
  datalabels: {
    display: false
  }
});

// Helper function to create 50% reference line for win probability
export const createFiftyPercentLine = (maxX: number) => ({
  label: '50% Line',
  data: [
    { x: 0, y: 50 },
    { x: maxX, y: 50 }
  ],
  borderColor: 'rgba(0,0,0,0.3)', // Darker gray line
  borderWidth: 1.5,
  borderDash: [5, 5], // Dashed line
  backgroundColor: 'transparent',
  pointRadius: 0,
  showLine: true,
  fill: false,
  tension: 0,
  order: 90, // Lower order so it appears behind the main line
  datalabels: {
    display: false
  }
});

// Helper function to create filled area below zero for play maps
export const createBelowZeroArea = (maxX: number, minY: number = -50) => ({
  label: '< 0',
  data: [
    { x: 1, y: 0 },
    { x: 1, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: 0 }
  ],
  backgroundColor: 'rgba(0,0,0,0.03)',
  borderColor: 'transparent',
  pointRadius: 0,
  fill: true,
  tension: 0,
  showLine: true,
  datalabels: {
    display: false
  }
});

// Helper function to create team vs opponent bar chart data
export const createTeamVsOpponentBarData = (
  category: 'quarter' | 'down' | 'playType' | 'redZone' | 'distance',
  teamPlays: PlayData[],
  opponentPlays: PlayData[],
  team: string,
  opponentTeam: string,
  teamColors: any,
  opponentColors: any
) => {
  const teamData = groupByCategory(teamPlays, category);
  const opponentData = groupByCategory(opponentPlays, category);
  
  // Get all unique labels from both teams
  const allLabels = Array.from(new Set([
    ...teamData.map(d => d.label),
    ...opponentData.map(d => d.label)
  ]));
  
  // Custom sort based on category
  if (category === 'quarter') {
    // Sort quarters in the correct order: Q1, Q2, Q3, Q4, OT
    const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
    allLabels.sort((a, b) => {
      const aIndex = quarterOrder.indexOf(a);
      const bIndex = quarterOrder.indexOf(b);
      return aIndex - bIndex;
    });
  } else if (category === 'playType') {
    // Rush first, then Pass
    allLabels.sort((a, b) => {
      if (a === 'Rush' && b !== 'Rush') return -1;
      if (b === 'Rush' && a !== 'Rush') return 1;
      return a.localeCompare(b);
    });
  } else if (category === 'redZone') {
    // Red Zone first, then Other
    allLabels.sort((a, b) => {
      if (a === 'Red Zone' && b !== 'Red Zone') return -1;
      if (b === 'Red Zone' && a !== 'Red Zone') return 1;
      return a.localeCompare(b);
    });
  } else {
    // Default alphabetical sort for other categories
    allLabels.sort();
  }

  // Create data arrays ensuring all labels are represented
  const teamSR = allLabels.map(label => {
    const found = teamData.find(d => d.label === label);
    return found ? found.sr : 0;
  });
  
  const teamXR = allLabels.map(label => {
    const found = teamData.find(d => d.label === label);
    return found ? found.xr : 0;
  });
  
  const oppSR = allLabels.map(label => {
    const found = opponentData.find(d => d.label === label);
    return found ? found.sr : 0;
  });
  
  const oppXR = allLabels.map(label => {
    const found = opponentData.find(d => d.label === label);
    return found ? found.xr : 0;
  });

  // Create count arrays for data labels
  const teamCounts = allLabels.map(label => {
    const found = teamData.find(d => d.label === label);
    return found ? found.count : 0;
  });
  
  const oppCounts = allLabels.map(label => {
    const found = opponentData.find(d => d.label === label);
    return found ? found.count : 0;
  });

  return {
    labels: allLabels,
    datasets: [
      {
        data: teamXR,
        stack: 'Team',
        label: `${team} XR`,
        backgroundColor: teamColors.explosive,
        datalabels: {
          display: false
        }
      },
      {
        data: teamSR,
        stack: 'Team',
        label: `${team} SR`,
        backgroundColor: teamColors.success,
        datalabels: {
          display: true,
          formatter: (value: number, context: any) => {
            return teamCounts[context.dataIndex];
          }
        }
      },
      {
        data: oppXR,
        stack: 'Opponent',
        label: `${opponentTeam} XR`,
        backgroundColor: opponentColors.explosive,
        datalabels: {
          display: false
        }
      },
      {
        data: oppSR,
        stack: 'Opponent',
        label: `${opponentTeam} SR`,
        backgroundColor: opponentColors.success,
        datalabels: {
          display: true,
          formatter: (value: number, context: any) => {
            return oppCounts[context.dataIndex];
          }
        }
      },
      // NCAA Average reference line
      {
        type: 'line' as const,
        data: Array(allLabels.length).fill(NCAA_AVERAGE_SR),
        label: "NCAA Avg SR",
        borderColor: '#757575',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        datalabels: {
          display: false
        }
      },
      // Fake dataset for "# Plays" legend item - using line type to avoid bar spacing
      {
        type: 'line' as const,
        data: Array(allLabels.length).fill(null), // Null data won't render
        label: "# Plays",
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(0, 0, 0, 0)',
        borderWidth: 0,
        pointRadius: 0,
        showLine: false,
        fill: false,
        datalabels: {
          display: false
        }
      }
    ]
  };
};

// Helper function to create drive connection lines for play maps - following reference implementation exactly
export const createDriveLines = (plays: PlayData[], teamColors: any) => {
  // Group plays by drive number (matching reference: driveGroups[play.drive])
  const driveGroups: { [key: number]: PlayData[] } = {};
  plays.forEach(play => {
    if (!driveGroups[play.driveNumber]) {
      driveGroups[play.driveNumber] = [];
    }
    driveGroups[play.driveNumber].push(play);
  });

  // Function to adjust opacity - handle both hex and rgba colors
  const adjustOpacity = (color: string, opacity: number) => {
    // If already rgba, extract RGB values and apply new opacity
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
      if (match) {
        const [, r, g, b] = match;
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }
    
    // If hex color, convert to RGBA
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Create datasets for drive lines 
  return Object.keys(driveGroups).map((drive) => {
    // Plays are already sorted properly from data processing, just maintain order
    const drivePlays = driveGroups[parseInt(drive)];
    const lineColor = adjustOpacity(teamColors.success, 0.5);
    return {
      label: `Drive ${drive}`,
      data: drivePlays.map(play => ({ x: play.playNumber, y: play.yardsGained })),
      borderColor: lineColor,
      borderWidth: 2,
      fill: false,
      pointRadius: 0,
      showLine: true,
      tension: 0.25, // Add tension directly to dataset
      order: 1, // Ensure lines are drawn below points
      datalabels: {
        display: false
      }
    };
  });
};

// Enhanced player data creation with improved categorization from Bolt
export const createPlayerData = (players: any[], playType: string) => {
  let datasets = [];
  
  if (playType === 'rush') {
    datasets = [
      {
        label: 'Explosive rushes',
        data: players.map(p => p.explosive),
        backgroundColor: players.map(p => p.teamColors.explosive),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Successful rushes',
        data: players.map(p => p.successful),
        backgroundColor: players.map(p => p.teamColors.success),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Unsuccessful rushes',
        data: players.map(p => p.unsuccessful),
        backgroundColor: '#FFFFFF',
        borderColor: '#374151',
        borderWidth: 1,
      }
    ];
  } else if (playType === 'pass') {
    datasets = [
      {
        label: 'Explosive',
        data: players.map(p => p.explosive),
        backgroundColor: players.map(p => p.teamColors.explosive),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Successful',
        data: players.map(p => p.successful),
        backgroundColor: players.map(p => p.teamColors.success),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Other catches',
        data: players.map(p => p.uns_catches || 0),
        backgroundColor: players.map(p => p.teamColors.light),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Incompletes',
        data: players.map(p => p.unsuccessful),
        backgroundColor: '#FFFFFF',
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Interceptions',
        data: players.map(p => p.int || 0),
        backgroundColor: '#4B5563',
        borderColor: '#374151',
        borderWidth: 1,
      }
    ];
  } else { // receive
    datasets = [
      {
        label: 'Explosive catches',
        data: players.map(p => p.explosive),
        backgroundColor: players.map(p => p.teamColors.explosive),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Successful catches',
        data: players.map(p => p.successful),
        backgroundColor: players.map(p => p.teamColors.success),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Other catches',
        data: players.map(p => p.uns_catches || 0),
        backgroundColor: players.map(p => p.teamColors.light),
        borderColor: '#374151',
        borderWidth: 1,
      }
    ];
  }

  return {
    labels: players.map(p => truncatePlayerName(p.name)),
    datasets: datasets
  };
};

// Helper function to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Helper function to interpolate between two colors based on win probability
const interpolateColor = (homeColor: string, awayColor: string, homeWinProb: number): string => {
  const home = hexToRgb(homeColor);
  const away = hexToRgb(awayColor);

  // Tighten gradient around 50% mark
  // Only show color mixing in the 42.5-57.5% range (15% total)
  const gradientRange = 0.075; // 7.5% on each side of 50%
  const midpoint = 0.5;

  let adjustedProb;
  if (homeWinProb <= midpoint - gradientRange) {
    // Below 42.5% - pure away team color
    adjustedProb = 0;
  } else if (homeWinProb >= midpoint + gradientRange) {
    // Above 57.5% - pure home team color
    adjustedProb = 1;
  } else {
    // In the 42.5-57.5% range - interpolate
    const rangePosition = (homeWinProb - (midpoint - gradientRange)) / (2 * gradientRange);
    adjustedProb = rangePosition;
  }

  const r = Math.round(away.r + (home.r - away.r) * adjustedProb);
  const g = Math.round(away.g + (home.g - away.g) * adjustedProb);
  const b = Math.round(away.b + (home.b - away.b) * adjustedProb);

  return `rgb(${r}, ${g}, ${b})`;
};

// Create win probability chart data with gradient colors
export const createWinProbabilityData = (
  winProbData: any[],
  selectedTeam: string,
  opponentTeam: string,
  selectedTeamColors: any,
  opponentTeamColors: any,
  plays: any[] = [] // Add plays data to determine actual home/away teams
) => {
  if (!winProbData || winProbData.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  // Determine if our selected team is the home team or away team
  // The API provides homeWinProbability, so we need to adjust based on perspective
  let isSelectedTeamHome = false;
  let actualHomeTeam = '';
  let actualAwayTeam = '';

  // First, try to get home/away team info from the win probability data
  const firstPoint = winProbData[0];
  if (firstPoint && firstPoint.home && firstPoint.away) {
    actualHomeTeam = firstPoint.home;
    actualAwayTeam = firstPoint.away;
    isSelectedTeamHome = firstPoint.home === selectedTeam;
  } else if (plays && plays.length > 0) {
    // Fallback: Use play data to determine home team
    // Look for the first play that has home/away fields
    const playWithHomeInfo = plays.find(p => p.home && p.away);
    if (playWithHomeInfo) {
      actualHomeTeam = playWithHomeInfo.home;
      actualAwayTeam = playWithHomeInfo.away;
      isSelectedTeamHome = playWithHomeInfo.home === selectedTeam;
    } else {
      // Last resort: Use a more sophisticated heuristic
      // Check which team appears more often as "defense" in first quarter (home teams often receive first)
      const firstQuarterPlays = plays.filter(p => p.quarter === 1).slice(0, 10);
      const defenseCount = firstQuarterPlays.reduce((counts, play) => {
        counts[play.defense] = (counts[play.defense] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      const mostCommonDefense = Object.entries(defenseCount).sort(([,a], [,b]) => b - a)[0];
      if (mostCommonDefense) {
        actualHomeTeam = mostCommonDefense[0]; // Team that defends more early is likely home
        actualAwayTeam = selectedTeam === actualHomeTeam ? opponentTeam : selectedTeam;
        isSelectedTeamHome = actualHomeTeam === selectedTeam;
      } else {
        // Ultimate fallback
        isSelectedTeamHome = false; // Assume away team perspective
        actualHomeTeam = opponentTeam;
        actualAwayTeam = selectedTeam;
      }
    }
  } else {
    // No play data available, assume away team perspective
    isSelectedTeamHome = false;
    actualHomeTeam = opponentTeam;
    actualAwayTeam = selectedTeam;
  }

  // Extract the primary colors for gradient calculation

  // Helper function to extract hex color from rgba or return hex directly
  const extractHexColor = (colorObj: any): string => {
    // If we have a direct hex color (from custom color palette), use it
    if (colorObj.color) return colorObj.color;
    if (colorObj.colorDark) return colorObj.colorDark;

    // Otherwise extract from rgba success color
    if (colorObj.success) {
      const match = colorObj.success.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    // Fallback colors
    return '#8B0000'; // Generic fallback
  };

  const selectedTeamHex = extractHexColor(selectedTeamColors);
  const opponentTeamHex = extractHexColor(opponentTeamColors);

  // Create data points for the line chart - always from selected team's perspective
  const dataPoints = winProbData.map((point, index) => {
    // Calculate selected team's win probability
    const selectedTeamWinProb = isSelectedTeamHome
      ? point.homeWinProbability
      : (1 - point.homeWinProbability); // If selected team is away, invert probability

    return {
      x: index,
      y: selectedTeamWinProb * 100 // Convert to percentage
    };
  });

  // Create segment colors based on selected team's win probability
  const segmentColors = winProbData.map((point) => {
    const selectedTeamWinProb = isSelectedTeamHome
      ? point.homeWinProbability
      : (1 - point.homeWinProbability);

    return interpolateColor(selectedTeamHex, opponentTeamHex, selectedTeamWinProb);
  });

  // Use Chart.js segment configuration for gradient effect
  const datasets = [{
    label: 'Win Probability',
    data: dataPoints,
    borderColor: selectedTeamHex, // Default border color
    backgroundColor: 'transparent',
    pointBackgroundColor: segmentColors,
    pointBorderColor: segmentColors,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.15,
    borderWidth: 2.2,
    fill: false,
    selectedTeam,
    opponentTeam,
    isSelectedTeamHome, // Store this for tooltip calculations
    playTexts: winProbData.map(point => point.playText),
    segment: {
      borderColor: (ctx: any) => {
        // Use p1DataIndex (ending point) so the line inherits the destination color
        // This makes momentum shifts more visually intuitive
        const index = ctx.p1DataIndex;
        if (index !== undefined && segmentColors[index]) {
          return segmentColors[index];
        }
        return selectedTeamHex;
      }
    }
  }];

  // Add the 50% reference line
  const maxX = winProbData.length - 1;
  const fiftyPercentLine = createFiftyPercentLine(maxX);
  datasets.push(fiftyPercentLine);

  // Add quarter grid lines - pass plays data to match playIds with quarters
  const quarterGridlines = createWinProbabilityQuarterGridlines(winProbData, plays, maxX, 0, 100);
  datasets.push(quarterGridlines);

  return {
    labels: winProbData.map((_, index) => index),
    datasets
  };
};

// Create quarter gridlines for win probability chart
// This function matches Win Probability data with raw play data by playId to get quarter information
export const createWinProbabilityQuarterGridlines = (winProbData: any[], rawPlays: any[], maxX: number, yMin: number = 0, yMax: number = 100) => {
  if (!winProbData || winProbData.length === 0) {
    return {
      label: 'Quarters',
      data: [],
      borderColor: 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      pointRadius: 0,
      showLine: true,
      fill: false,
      tension: 0,
      order: 100
    };
  }

  // Create a map of playId -> quarter from raw plays data
  const playIdToQuarter = new Map();
  if (rawPlays && rawPlays.length > 0) {
    rawPlays.forEach(play => {
      const playId = play.id;
      const quarter = play.quarter || play.period || 0;
      // Normalize overtime (5+) to 5
      const normalizedQuarter = quarter > 4 ? 5 : quarter;
      playIdToQuarter.set(playId, normalizedQuarter);
    });
  }

  // Track quarter changes by matching playId
  const quarterBreaks: { playIndex: number; quarter: number }[] = [];
  let currentQuarter = 0;

  winProbData.forEach((point, index) => {
    const detectedQuarter = playIdToQuarter.get(point.playId);

    if (detectedQuarter !== undefined && detectedQuarter !== currentQuarter) {
      quarterBreaks.push({ playIndex: index, quarter: detectedQuarter });
      currentQuarter = detectedQuarter;
    }
  });

  const quarterLines: any[] = [];

  quarterBreaks.forEach(quarterBreak => {
    if (quarterBreak.playIndex > 0) { // Don't draw line at the very beginning
      quarterLines.push(
        { x: quarterBreak.playIndex, y: yMin },
        { x: quarterBreak.playIndex, y: yMax },
        { x: maxX, y: yMax },
        { x: maxX, y: yMin }
      );
    }
  });

  return {
    label: 'Quarters',
    data: quarterLines,
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    pointRadius: 0,
    showLine: true,
    fill: false,
    tension: 0,
    order: 100,
    datalabels: {
      display: false
    }
  };
};