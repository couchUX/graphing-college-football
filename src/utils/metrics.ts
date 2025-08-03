import { ApiPlayData, PlayData, ProcessedMetrics, DriveMetrics, PlayerStats } from '../types';

const calculateSuccess = (down: number, distance: number, yardsGained: number): boolean => {
  if (!down || !distance || yardsGained === undefined || yardsGained === null) {
    return false;
  }
  
  switch (down) {
    case 1:
      return yardsGained >= distance * 0.5;
    case 2:
      return yardsGained >= distance * 0.7;
    case 3:
    case 4:
      return yardsGained >= distance;
    default:
      return false;
  }
};

const calculateExplosiveness = (yardsGained: number): boolean => {
  return yardsGained >= 15;
};

// Helper function to clean player names
const cleanPlayerName = (name: string): string => {
  if (!name) return '';
  
  // Remove numbers, "yd"/"Yd", and trim spaces
  return name
    .replace(/\d+/g, '') // Remove all numbers
    .replace(/\s*yd\s*/gi, '') // Remove "yd" or "Yd" with surrounding spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
};

// Extract player names from play text
const extractPlayerNames = (playText: string, playType: string): { rusher?: string; passer?: string; receiver?: string } => {
  const lowerPlayType = playType.toLowerCase();
  const result: { rusher?: string; passer?: string; receiver?: string } = {};

  if (lowerPlayType.includes('rush') || lowerPlayType.includes('run')) {
    // RUSH PLAYS: Extract rusher
    const rushMatch = playText.match(/^([^,]+(?:,\s*[^,]+)?)\s+(?:run|rush)/i);
    if (rushMatch) {
      result.rusher = cleanPlayerName(rushMatch[1]);
    }
  } else if (lowerPlayType.includes('pass') || lowerPlayType.includes('completion') || lowerPlayType.includes('incompletion')) {
    // PASS PLAYS: Skip sacks (no passer/receiver for sacks)
    if (playText.toLowerCase().includes('sacked')) {
      return result; // Return empty for sacks
    }

    // Extract Passer
    let passer = '';
    
    // Check for scoring format first: "pass from [passer]"
    const passFromMatch = playText.match(/pass from ([^(]+)/i);
    if (passFromMatch) {
      passer = passFromMatch[1].trim();
    } else {
      // Standard format: "[passer] pass"
      const standardPassMatch = playText.match(/^([^,]+(?:,\s*[^,]+)?)\s+pass/i);
      if (standardPassMatch) {
        passer = standardPassMatch[1];
      }
    }
    
    if (passer) {
      result.passer = cleanPlayerName(passer);
    }

    // Extract Receiver
    let receiver = '';
    
    if (playText.includes('pass from')) {
      // Scoring format: "[receiver] [yards] Yd pass from [passer]"
      const scoringMatch = playText.match(/^([^0-9]+)/);
      if (scoringMatch) {
        receiver = scoringMatch[1].trim();
      }
    } else if (playText.includes('complete to')) {
      // Standard completion: "complete to [receiver] for" - FIXED REGEX TO CAPTURE ALL NAMES
      const completeMatch = playText.match(/complete to\s+(.*?)(?:\s+for\s*|$)/i);
      if (completeMatch) {
        receiver = completeMatch[1].trim();
      }
    } else if (playText.includes('incomplete to')) {
      // Incomplete with target: "incomplete to [receiver]"
      const incompleteMatch = playText.match(/incomplete to (.+)/i);
      if (incompleteMatch) {
        receiver = incompleteMatch[1].trim();
      }
    } else if (playText.includes('intercepted')) {
      // Interception: Don't extract receiver - the person who intercepted is a defensive back, not an offensive receiver
      // Leave receiver blank for interceptions
    }
    // If just "incomplete" with no "to", leave receiver blank
    
    if (receiver) {
      result.receiver = cleanPlayerName(receiver);
    }
  }

  return result;
};

export const processPlayData = (apiPlays: ApiPlayData[]): PlayData[] => {
  // Sort plays by drive number, play in drive, then ID as fallback
  // This ensures proper chronological order based on game flow
  const sortedPlays = [...apiPlays].sort((a, b) => {
    const aDriveNumber = a.drive_number || a.driveNumber || 0;
    const bDriveNumber = b.drive_number || b.driveNumber || 0;
    const aPlayInDrive = a.play_number || a.playNumber || 0;
    const bPlayInDrive = b.play_number || b.playNumber || 0;
    
    // First sort by drive number
    if (aDriveNumber !== bDriveNumber) {
      return aDriveNumber - bDriveNumber;
    }
    
    // Then sort by play within drive
    if (aPlayInDrive !== bPlayInDrive) {
      return aPlayInDrive - bPlayInDrive;
    }
    
    // Finally sort by ID as fallback
    return a.id.localeCompare(b.id);
  });

  console.log('Play sorting verification - first 10 plays (sorted by drive, play-in-drive, then ID):');
  sortedPlays.slice(0, 10).forEach((play, index) => {
    console.log(`${index + 1}: ID ${play.id} - Q${play.quarter || play.period} D${play.drive_number || play.driveNumber} P${play.play_number || play.playNumber}`);
  });

  // Filter to only rush and pass plays (including sacks) AFTER sorting
  const rushPassPlays = sortedPlays.filter(play => {
    const playType = play.play_type || play.playType || '';
    const lowerPlayType = playType.toLowerCase();
    return lowerPlayType.includes('rush') || 
           lowerPlayType.includes('run') || 
           lowerPlayType.includes('pass') ||
           lowerPlayType.includes('completion') ||
           lowerPlayType.includes('incompletion') ||
           lowerPlayType.includes('sack'); // Include sacks as pass plays
  });

  console.log('Filtered rush/pass plays - first 10 (should be in chronological order):');
  rushPassPlays.slice(0, 10).forEach((play, index) => {
    console.log(`${index + 1}: ID ${play.id} - Q${play.quarter || play.period} D${play.drive_number || play.driveNumber} P${play.play_number || play.playNumber} - ${play.play_type || play.playType}`);
  });

  // Calculate drive-based play numbers for rush/pass plays only
  const drivePlayCounts: { [key: string]: number } = {};

  // Process each rush/pass play and add cumulative calculations
  // The playNumber is now assigned sequentially to the filtered plays in chronological order
  const processedPlays = rushPassPlays.map((play, index) => {
    const yardsGained = play.yards_gained !== undefined ? play.yards_gained : (play.yardsGained !== undefined ? play.yardsGained : 0);
    const success = calculateSuccess(play.down, play.distance, yardsGained);
    const explosiveness = calculateExplosiveness(yardsGained);
    const playType = play.play_type || play.playType || '';
    const playText = play.play_text || play.playText || '';
    
    // Extract player names
    const playerNames = extractPlayerNames(playText, playType);
    
    // Calculate drive-based play number for rush/pass plays only
    const driveKey = `${play.offense}-${play.drive_number || play.driveNumber}`;
    if (!drivePlayCounts[driveKey]) {
      drivePlayCounts[driveKey] = 0;
    }
    drivePlayCounts[driveKey]++;
    const playInDriveRushPass = drivePlayCounts[driveKey];
    
    return {
      id: play.id,
      driveId: play.drive_id || play.driveId || 0,
      gameId: play.game_id || play.gameId || 0,
      driveNumber: play.drive_number || play.driveNumber || 0,
      playNumber: index + 1, // Sequential number for filtered rush/pass plays in chronological order
      playInDrive: playInDriveRushPass, // Rush/pass play number within this drive (1, 2, 3...)
      offense: play.offense || '',
      defense: play.defense || '',
      offenseConference: play.offense_conference || play.offenseConference || '',
      defenseConference: play.defense_conference || play.defenseConference || '',
      down: play.down || 0,
      distance: play.distance || 0,
      yardsToGoal: play.yards_to_goal || play.yardsToGoal || 0,
      yardsGained,
      playType,
      playText,
      ppa: play.ppa || 0,
      success,
      explosiveness,
      quarter: play.quarter || play.period || 0,
      clock: play.clock || { minutes: 0, seconds: 0 },
      wallclock: play.wallclock || '',
      timeRemaining: play.time_remaining || play.timeRemaining || 0,
      // Player names
      rusher: playerNames.rusher,
      passer: playerNames.passer,
      receiver: playerNames.receiver,
      // Initialize cumulative fields - will be calculated below
      teamPlayNumber: 0,
      teamCumulativeSR: 0,
      teamCumulativeXR: 0,
      teamCumulativeRushRate: 0,
      teamRushCumulativeSR: 0,
      teamPassCumulativeSR: 0,
    };
  });

  console.log('Final processed plays verification - first 10:');
  processedPlays.slice(0, 10).forEach(play => {
    console.log(`Play #${play.playNumber}: ID ${play.id} - Q${play.quarter} D${play.driveNumber} P${play.playInDrive} - ${play.playType} - ${play.playText.substring(0, 50)}...`);
    if (play.rusher) console.log(`  Rusher: ${play.rusher}`);
    if (play.passer) console.log(`  Passer: ${play.passer}`);
    if (play.receiver) console.log(`  Receiver: ${play.receiver}`);
  });

  // Calculate cumulative metrics for each team
  const teams = Array.from(new Set(processedPlays.map(p => p.offense)));
  
  teams.forEach(team => {
    const teamPlays = processedPlays.filter(p => p.offense === team);
    let successCount = 0;
    let explosiveCount = 0;
    let rushCount = 0;
    let rushSuccessCount = 0;
    let passSuccessCount = 0;
    let rushPlayCount = 0;
    let passPlayCount = 0;

    teamPlays.forEach((play, teamIndex) => {
      // Update counters
      if (play.success) successCount++;
      if (play.explosiveness) explosiveCount++;
      
      const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
      const isPass = play.playType?.toLowerCase().includes('pass') || play.playType?.toLowerCase().includes('sack');
      
      if (isRush) {
        rushCount++;
        rushPlayCount++;
        if (play.success) rushSuccessCount++;
      } else if (isPass) {
        passPlayCount++;
        if (play.success) passSuccessCount++;
      }

      // Calculate cumulative rates
      const teamPlayNumber = teamIndex + 1;
      const cumulativeSR = successCount / teamPlayNumber;
      const cumulativeXR = explosiveCount / teamPlayNumber;
      const cumulativeRushRate = rushCount / teamPlayNumber;
      const rushCumulativeSR = rushPlayCount > 0 ? rushSuccessCount / rushPlayCount : 0;
      const passCumulativeSR = passPlayCount > 0 ? passSuccessCount / passPlayCount : 0;

      // Update the play object
      play.teamPlayNumber = teamPlayNumber;
      play.teamCumulativeSR = cumulativeSR;
      play.teamCumulativeXR = cumulativeXR;
      play.teamCumulativeRushRate = cumulativeRushRate;
      play.teamRushCumulativeSR = rushCumulativeSR;
      play.teamPassCumulativeSR = passCumulativeSR;
    });
  });

  return processedPlays;
};

const calculateTeamMetrics = (plays: PlayData[], teamName: string): ProcessedMetrics => {
  const teamPlays = plays.filter(play => play.offense === teamName);
  
  if (teamPlays.length === 0) {
    return {
      successRate: 0,
      explosivenessRate: 0,
      totalPlays: 0,
      avgYardsPerPlay: 0
    };
  }

  const successfulPlays = teamPlays.filter(play => play.success).length;
  const explosivePlays = teamPlays.filter(play => play.explosiveness).length;
  const totalYards = teamPlays.reduce((sum, play) => sum + play.yardsGained, 0);

  return {
    successRate: (successfulPlays / teamPlays.length) * 100,
    explosivenessRate: (explosivePlays / teamPlays.length) * 100,
    totalPlays: teamPlays.length,
    avgYardsPerPlay: totalYards / teamPlays.length
  };
};

const calculateDriveMetrics = (plays: PlayData[], teamName: string): DriveMetrics[] => {
  const teamPlays = plays.filter(play => play.offense === teamName);
  const driveGroups = teamPlays.reduce((acc, play) => {
    if (!acc[play.driveNumber]) {
      acc[play.driveNumber] = [];
    }
    acc[play.driveNumber].push(play);
    return acc;
  }, {} as Record<number, PlayData[]>);

  return Object.entries(driveGroups).map(([driveNum, drivePlays]) => {
    const successfulPlays = drivePlays.filter(play => play.success).length;
    const explosivePlays = drivePlays.filter(play => play.explosiveness).length;
    const totalYards = drivePlays.reduce((sum, play) => sum + play.yardsGained, 0);

    return {
      driveNumber: parseInt(driveNum),
      playCount: drivePlays.length,
      successRate: drivePlays.length > 0 ? (successfulPlays / drivePlays.length) * 100 : 0,
      explosivenessRate: drivePlays.length > 0 ? (explosivePlays / drivePlays.length) * 100 : 0,
      totalYards
    };
  }).sort((a, b) => a.driveNumber - b.driveNumber);
};

export const calculatePlayerStats = (plays: PlayData[], playType: 'rush' | 'pass' | 'receive'): PlayerStats[] => {
  let relevantPlays: PlayData[];
  let playerField: 'rusher' | 'passer' | 'receiver';
  
  if (playType === 'rush') {
    relevantPlays = plays.filter(play => {
      return (play.playType?.toLowerCase().includes('rush') || 
              play.playType?.toLowerCase().includes('run')) && 
             play.rusher; // Only include plays with a rusher identified
    });
    playerField = 'rusher';
  } else if (playType === 'pass') {
    relevantPlays = plays.filter(play => {
      return (play.playType?.toLowerCase().includes('pass') || 
              play.playType?.toLowerCase().includes('completion') ||
              play.playType?.toLowerCase().includes('incompletion') ||
              play.playType?.toLowerCase().includes('interception')) &&
             play.passer; // Only include plays with a passer identified
    });
    playerField = 'passer';
  } else { // receive
    relevantPlays = plays.filter(play => {
      return (play.playType?.toLowerCase().includes('pass') || 
              play.playType?.toLowerCase().includes('completion') ||
              play.playType?.toLowerCase().includes('incompletion') ||
              play.playType?.toLowerCase().includes('reception')) &&
             play.receiver; // Only include plays with a receiver identified
    });
    playerField = 'receiver';
  }

  console.log(`calculatePlayerStats for ${playType}:`, {
    totalPlays: relevantPlays.length,
    samplePlay: relevantPlays[0]
  });
  // Group plays by player
  const playerGroups = relevantPlays.reduce((acc, play) => {
    const playerName = play[playerField];
    if (playerName) {
      if (!acc[playerName]) {
        acc[playerName] = [];
      }
      acc[playerName].push(play);
    }
    return acc;
  }, {} as Record<string, PlayData[]>);

  return Object.entries(playerGroups)
    .map(([name, playerPlays]) => {
      const explosive = playerPlays.filter(play => play.explosiveness).length;
      const successful = playerPlays.filter(play => play.success && !play.explosiveness).length;
      
      let unsuccessful = 0;
      let uns_catches = 0;
      let int = 0;
      
      if (playType === 'rush') {
        // For rushers: unsuccessful = all non-successful plays
        unsuccessful = playerPlays.filter(play => !play.success).length;
      } else if (playType === 'pass') {
        // For passers: 
        // unsuccessful = incomplete passes and sacks (not successful, not interceptions, not completions)
        // uns_catches = completed passes that weren't successful or explosive  
        // int = interceptions
        playerPlays.forEach(play => {
          const playText = play.playText.toLowerCase();
          if (playText.includes('interception') || playText.includes('intercepted')) {
            int++;
          } else {
            // More precise completion detection
            const isCompletion = (playText.includes('complete') && !playText.includes('incomplete')) || 
                                playText.includes('reception') || 
                                playText.includes('pass from');
            
            const isIncomplete = playText.includes('incomplete');
            const isSack = playText.includes('sack');
            
            if (isCompletion && !play.success && !play.explosiveness) {
              uns_catches++; // Completed passes that weren't successful or explosive
            } else if ((isIncomplete || isSack) && !play.success) {
              unsuccessful++; // Incomplete passes
            }
          }
        });
      } else { // receive
        // For receivers: 
        // uns_catches = catches that weren't successful or explosive
        // unsuccessful = 0 (we don't track incompletions for receivers since they're not targeted on incomplete passes in our data)
        playerPlays.forEach(play => {
          const playText = play.playText.toLowerCase();
          const isCompletion = (playText.includes('complete') && !playText.includes('incomplete')) || 
                              playText.includes('reception') || 
                              playText.includes('pass from');
          
          if (isCompletion && !play.success && !play.explosiveness) {
            uns_catches++; // Other catches (completed but not successful)
          }
        });
      }

      console.log(`Player ${name} (${playType}):`, {
        explosive,
        successful,
        unsuccessful,
        uns_catches,
        int,
        total: playerPlays.length
      });
      return {
        name,
        explosive,
        successful,
        unsuccessful,
        uns_catches,
        int,
        total: playerPlays.length
      };
    })
    .filter(player => player.total >= 1) // Show players with 1+ plays (was 2+)
    .sort((a, b) => b.total - a.total); // Sort by total plays descending, no slice limit
};