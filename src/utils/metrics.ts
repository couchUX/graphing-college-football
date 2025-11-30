import { ApiPlayData, PlayData, ProcessedMetrics, DriveMetrics, PlayerStats } from '../types';

const calculateSuccess = (down: number, distance: number, yardsGained: number, playType: string = '', playText: string = ''): boolean => {
  // Special handling for two-point conversions
  const lowerPlayType = playType.toLowerCase();
  const lowerPlayText = playText.toLowerCase();

  if (lowerPlayType.includes('conversion') || lowerPlayType.includes('two point') || lowerPlayType.includes('2pt')) {
    // For two-point conversions, check for explicit failure first
    if (lowerPlayText.includes('failed') ||
        lowerPlayText.includes('fails') ||
        lowerPlayText.includes('attempt fails') ||
        lowerPlayText.includes('no good') ||
        lowerPlayText.includes('incomplete') ||
        lowerPlayText.includes('intercepted') ||
        lowerPlayText.includes('interception')) {
      return false;
    }

    // Then check for explicit success indicators
    // Key pattern: "for Two-Point Conversion" at end indicates success
    return lowerPlayText.includes('good') ||
           lowerPlayText.includes('touchdown') ||
           lowerPlayText.includes('conversion good') ||
           lowerPlayText.includes('successful') ||
           lowerPlayText.endsWith('for two-point conversion') ||
           lowerPlayText.endsWith('for 2pt conversion') ||
           lowerPlayText.endsWith('for two-point conversion.') ||
           lowerPlayText.endsWith('for 2pt conversion.') ||
           (yardsGained >= 2 && !lowerPlayText.includes('tackled')); // Yards gained but not tackled short
  }

  // Existing success logic for regular plays
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

// Helper function to remove timestamp and formation prefixes from play text
const stripTimestamp = (playText: string): string => {
  if (!playText) return '';

  // Strategy: Find player number marker (#\d+) that appears BEFORE action words (rush/pass/etc)
  // and remove everything before it (including the marker)
  // Example: "(03:59) Shotgun #15 T.Simpson pass..." -> "T.Simpson pass..."
  // Important: Don't match player numbers in parentheses like "(#42 D.Keys)" at the end

  // First, check if there's a timestamp at the start
  const hasTimestamp = playText.match(/^\s*\(\d{1,2}:\d{2}\)/);

  if (hasTimestamp) {
    // If there's a timestamp, look for the first #\d+ that's NOT in parentheses
    // Strategy: Remove timestamp, then find first standalone #\d+ (not preceded by opening paren)
    let afterTimestamp = playText.replace(/^\s*\(\d{1,2}:\d{2}\)\s*/, '');

    // Find first # that's not inside parentheses
    // Look for #\d+ followed by space and then capture everything after it
    // Use negative lookbehind to avoid matching (#\d+ inside parens
    const playerNumberMatch = afterTimestamp.match(/(?<!\()#\d+\s+(.+)$/);
    if (playerNumberMatch) {
      return playerNumberMatch[1].trim();
    }

    // If no player number found, return with just timestamp removed
    return afterTimestamp.trim();
  }

  // No timestamp - return as-is (already clean format like "K.Riley rush middle...")
  return playText.trim();
};

// Helper function to standardize player names to abbreviated format (First Initial + Last Name)
const standardizePlayerName = (name: string): string => {
  if (!name) return '';

  // Remove common suffixes
  let cleaned = name
    .replace(/\s+Jr\.?$/i, '')
    .replace(/\s+Sr\.?$/i, '')
    .replace(/\s+III$/i, '')
    .replace(/\s+IV$/i, '')
    .replace(/\s+V$/i, '')
    .replace(/\s+II$/i, '')
    .trim();

  // Split into parts
  const parts = cleaned.split(/\s+/);

  // If only one part, return as-is
  if (parts.length === 0 || cleaned.length === 0) return name;
  if (parts.length === 1) return cleaned;

  const firstName = parts[0];
  const lastName = parts[1];

  // Check if first name is already abbreviated (single letter with optional period)
  if (firstName.length <= 2 && firstName.includes('.')) {
    // Already abbreviated like "E." or "E"
    return `${firstName.replace('.', '')}.${lastName}`;
  } else if (firstName.length === 1) {
    // Single letter without period
    return `${firstName}.${lastName}`;
  } else {
    // Full first name - abbreviate it
    return `${firstName.charAt(0)}.${lastName}`;
  }
};

// Helper function to clean player names
const cleanPlayerName = (name: string): string => {
  if (!name) return '';

  // Additional safeguards for malformed names
  let cleaned = name
    .replace(/\d+/g, '') // Remove all numbers
    .replace(/\s*yd\s*/gi, '') // Remove "yd" or "Yd" with surrounding spaces
    .replace(/\s*yards?\s*/gi, '') // Remove "yard" or "yards"
    .replace(/\s*for\s*$/gi, '') // Remove trailing "for"
    .replace(/\s*to\s*$/gi, '') // Remove trailing "to"
    .replace(/\s*complete\s*/gi, '') // Remove "complete"
    .replace(/\s*incomplete\s*/gi, '') // Remove "incomplete"
    .replace(/\s*pass\s*/gi, '') // Remove "pass"
    .replace(/\s*thrown\s*/gi, '') // Remove "thrown"
    .replace(/\s*caught\s*/gi, '') // Remove "caught"
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  // Final safeguard: if the cleaned name is still too long or contains suspicious patterns,
  // try to extract just the first and last name
  if (cleaned.length > 25 || cleaned.includes('down') || cleaned.includes('penalty')) {
    // Extract first two words (first name and last name)
    const nameMatch = cleaned.match(/^([A-Za-z.]+(?:\s+[A-Za-z.]+){1})/i);
    if (nameMatch) {
      cleaned = nameMatch[1].trim();
    } else {
      // Last resort: take first 20 characters and find the last space
      cleaned = cleaned.substring(0, 20);
      const lastSpace = cleaned.lastIndexOf(' ');
      if (lastSpace > 5) {
        cleaned = cleaned.substring(0, lastSpace);
      }
    }
  }

  // Standardize to abbreviated format (First Initial + Last Name)
  return standardizePlayerName(cleaned);
};

// Extract player names from play text
const extractPlayerNames = (playText: string, playType: string): { rusher?: string; passer?: string; receiver?: string } => {
  const lowerPlayType = playType.toLowerCase();
  const result: { rusher?: string; passer?: string; receiver?: string } = {};

  // Strip timestamp from beginning of play text if present
  const cleanedPlayText = stripTimestamp(playText);

  if (lowerPlayType.includes('rush') || lowerPlayType.includes('run')) {
    // RUSH PLAYS: Extract rusher
    // Match name at start, limit to reasonable length to avoid matching too much
    // Pattern: [Name] rush/run (where name is limited to ~40 chars)
    const rushMatch = cleanedPlayText.match(/^([A-Za-z\s.',-]{2,40}?)\s+(?:run|rush)/i);
    if (rushMatch) {
      result.rusher = cleanPlayerName(rushMatch[1]);
    }
  } else if (lowerPlayType.includes('pass') || lowerPlayType.includes('completion') || lowerPlayType.includes('incompletion') || lowerPlayType.includes('interception')) {
    // PASS PLAYS: Skip sacks (no passer/receiver for sacks)
    if (cleanedPlayText.toLowerCase().includes('sacked')) {
      return result; // Return empty for sacks
    }

    // Extract Passer - improved logic to handle complex play texts
    let passer = '';

    // Check for scoring format first: "pass from [passer]"
    const passFromMatch = cleanedPlayText.match(/pass from ([^(,]+)/i);
    if (passFromMatch) {
      passer = passFromMatch[1].trim();
    } else {
      // Standard format: "[passer] pass" - be more restrictive to avoid long matches
      // Look for a name pattern followed by "pass" - limit to reasonable name length
      const standardPassMatch = cleanedPlayText.match(/^([A-Za-z\s.',-]{2,40}?)\s+pass(?:\s+(?:complete|incomplete))/i);
      if (standardPassMatch) {
        passer = standardPassMatch[1].trim();
      } else {
        // Fallback: try to find just "[name] pass" at the start, but limit length
        const simplePassMatch = cleanedPlayText.match(/^([A-Za-z\s.',-]{2,40}?)\s+pass/i);
        if (simplePassMatch) {
          passer = simplePassMatch[1].trim();
          // Additional safeguard: if the extracted name seems too long, truncate at first reasonable break
          if (passer.length > 30) {
            const truncateMatch = passer.match(/^([A-Za-z\s.',-]{2,30}?)(?:\s+(?:pass|complete|incomplete|for|to|yds?|yards?))/i);
            if (truncateMatch) {
              passer = truncateMatch[1].trim();
            } else {
              // If we can't find a good break point, take first 25 characters and find last space
              passer = passer.substring(0, 25);
              const lastSpace = passer.lastIndexOf(' ');
              if (lastSpace > 10) {
                passer = passer.substring(0, lastSpace);
              }
            }
          }
        }
      }
    }

    if (passer) {
      result.passer = cleanPlayerName(passer);
    }

    // Extract Receiver
    let receiver = '';

    if (cleanedPlayText.includes('pass from')) {
      // Scoring format: "[receiver] [yards] Yd pass from [passer]"
      const scoringMatch = cleanedPlayText.match(/^([^0-9]+)/);
      if (scoringMatch) {
        receiver = scoringMatch[1].trim();
      }
    } else if (cleanedPlayText.includes(' to ') && !cleanedPlayText.includes('intercepted')) {
      // Standard completion/incompletion: "pass complete short middle to #5 [receiver]"
      // Pattern: ... to #\d+ [receiver] OR ... to [receiver]
      // Need to handle optional player number and direction/distance words between "complete/incomplete" and "to"
      const receiverMatch = cleanedPlayText.match(/\s+to\s+(?:#\d+\s+)?([A-Z][\w\s.'-]+?)(?:\s+caught|\s+thrown|\s+for\s*|$)/i);
      if (receiverMatch) {
        receiver = receiverMatch[1].trim();
      }
    } else if (cleanedPlayText.includes('intercepted')) {
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

  // Filter to only rush, pass, and two-point conversion plays (including sacks and interceptions) AFTER sorting
  const rushPassPlays = sortedPlays.filter(play => {
    const playType = play.play_type || play.playType || '';
    const lowerPlayType = playType.toLowerCase();
    const isIncluded = lowerPlayType.includes('rush') ||
           lowerPlayType.includes('run') ||
           lowerPlayType.includes('pass') ||
           lowerPlayType.includes('completion') ||
           lowerPlayType.includes('incompletion') ||
           lowerPlayType.includes('sack') || // Include sacks as pass plays
           lowerPlayType.includes('interception') || // Include interceptions as unsuccessful pass plays
           lowerPlayType.includes('conversion') ||
           lowerPlayType.includes('two point') ||
           lowerPlayType.includes('2pt');


    return isIncluded;
  });

  // Calculate drive-based play numbers for rush/pass plays only
  const drivePlayCounts: { [key: string]: number } = {};

  // Process each rush/pass play and add cumulative calculations
  // The playNumber is now assigned sequentially to the filtered plays in chronological order
  const processedPlays = rushPassPlays.map((play, index) => {
    const playType = play.play_type || play.playType || '';
    const rawPlayText = play.play_text || play.playText || '';
    // Strip timestamp from play text for cleaner display and processing
    const playText = stripTimestamp(rawPlayText);

    // For interceptions, set yards to 0 (defensive return yards don't count for offense)
    let yardsGained = play.yards_gained !== undefined ? play.yards_gained : (play.yardsGained !== undefined ? play.yardsGained : 0);
    const lowerPlayType = playType.toLowerCase();
    if (lowerPlayType.includes('interception') || lowerPlayType.includes('intercepted')) {
      yardsGained = 0;
    }

    const success = calculateSuccess(play.down, play.distance, yardsGained, playType, playText);
    const explosiveness = calculateExplosiveness(yardsGained);

    // Extract player names (using cleaned playText)
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
      quarter: (() => {
        const rawQuarter = play.quarter || play.period || 0;
        // Normalize all overtime periods (5, 6, 7, etc.) to 5
        return rawQuarter > 4 ? 5 : rawQuarter;
      })(),
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
      const isPass = play.playType?.toLowerCase().includes('pass') || play.playType?.toLowerCase().includes('sack') || play.playType?.toLowerCase().includes('interception');

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
             play.rusher && 
             play.rusher.toLowerCase() !== 'team'; // Exclude "team" values
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
      const playText = play.playText?.toLowerCase() || '';
      const isCompletion = (playText.includes('complete') && !playText.includes('incomplete')) || 
                          playText.includes('reception') || 
                          playText.includes('pass from');
      
      return (play.playType?.toLowerCase().includes('pass') || 
              play.playType?.toLowerCase().includes('completion') ||
              play.playType?.toLowerCase().includes('reception')) &&
             play.receiver && 
             isCompletion; // Only include completed passes, exclude incomplete passes
    });
    playerField = 'receiver';
  }

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