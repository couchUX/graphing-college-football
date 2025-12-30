# Calculation Formulas

This document defines how to calculate key metrics from play-by-play data. All formulas match the logic in `src/utils/metrics.ts`.

## Success Rate (SR)

**Definition**: Percentage of plays that are "successful" based on down and distance.

**Formula by Down**:
- **1st Down**: Gained ≥ 50% of distance needed
- **2nd Down**: Gained ≥ 70% of distance needed
- **3rd Down**: Gained ≥ 100% of distance (converted)
- **4th Down**: Gained ≥ 100% of distance (converted)

**JavaScript Implementation**:
```javascript
function calculateSuccess(down, distance, yardsGained) {
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
}
```

**NCAA Average**: 43.3%

**Usage Example**:
```javascript
const plays = [/* array of plays */];
const successfulPlays = plays.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));
const successRate = (successfulPlays.length / plays.length) * 100;
```

## Explosiveness Rate (XR)

**Definition**: Percentage of plays that gain 15+ yards.

**Formula**: `yards_gained >= 15`

**JavaScript Implementation**:
```javascript
function calculateExplosiveness(yardsGained) {
  return yardsGained >= 15;
}
```

**Usage Example**:
```javascript
const explosivePlays = plays.filter(p => calculateExplosiveness(p.yards_gained));
const explosivenessRate = (explosivePlays.length / plays.length) * 100;
```

## Player Name Extraction

Player names are extracted from the `play_text` field. The logic handles various formats.

**JavaScript Implementation**:
```javascript
// Helper: Remove timestamp from play text
function stripTimestamp(playText) {
  if (!playText) return '';

  const hasTimestamp = playText.match(/^\s*\(\d{1,2}:\d{2}\)/);
  if (hasTimestamp) {
    let afterTimestamp = playText.replace(/^\s*\(\d{1,2}:\d{2}\)\s*/, '');
    const playerNumberMatch = afterTimestamp.match(/(?<!\()#\d+\s+(.+)$/);
    if (playerNumberMatch) {
      return playerNumberMatch[1].trim();
    }
    return afterTimestamp.trim();
  }

  return playText.trim();
}

// Helper: Clean player name
function cleanPlayerName(name) {
  if (!name) return '';

  let cleaned = name
    .replace(/\d+/g, '')                    // Remove numbers
    .replace(/\s*yd\s*/gi, '')              // Remove "yd"
    .replace(/\s*yards?\s*/gi, '')          // Remove "yard(s)"
    .replace(/\s*for\s*$/gi, '')            // Remove trailing "for"
    .replace(/\s*to\s*$/gi, '')             // Remove trailing "to"
    .replace(/\s*complete\s*/gi, '')        // Remove "complete"
    .replace(/\s*incomplete\s*/gi, '')      // Remove "incomplete"
    .replace(/\s*pass\s*/gi, '')            // Remove "pass"
    .replace(/\s*thrown\s*/gi, '')          // Remove "thrown"
    .replace(/\s*caught\s*/gi, '')          // Remove "caught"
    .replace(/\s+/g, ' ')                   // Collapse spaces
    .trim();

  // Extract first and last name if too long
  if (cleaned.length > 25 || cleaned.includes('down') || cleaned.includes('penalty')) {
    const nameMatch = cleaned.match(/^([A-Za-z.]+(?:\s+[A-Za-z.]+){1})/i);
    if (nameMatch) {
      cleaned = nameMatch[1].trim();
    }
  }

  return standardizePlayerName(cleaned);
}

// Helper: Standardize to "X.LastName" format
function standardizePlayerName(name) {
  if (!name) return '';

  // Remove suffixes (Jr., Sr., III, etc.)
  let cleaned = name
    .replace(/\s+Jr\.?$/i, '')
    .replace(/\s+Sr\.?$/i, '')
    .replace(/\s+III$/i, '')
    .replace(/\s+IV$/i, '')
    .replace(/\s+V$/i, '')
    .replace(/\s+II$/i, '')
    .trim();

  const parts = cleaned.split(/\s+/);
  if (parts.length === 0 || cleaned.length === 0) return name;
  if (parts.length === 1) return cleaned;

  const firstName = parts[0];
  const lastName = parts[1];

  // Check if already abbreviated
  if (firstName.length <= 2 && firstName.includes('.')) {
    return `${firstName.replace('.', '')}.${lastName}`;
  } else if (firstName.length === 1) {
    return `${firstName}.${lastName}`;
  } else {
    // Abbreviate full first name
    return `${firstName.charAt(0)}.${lastName}`;
  }
}

// Main extraction function
function extractPlayerNames(playText, playType) {
  const lowerPlayType = playType.toLowerCase();
  const result = {};
  const cleanedPlayText = stripTimestamp(playText);

  if (lowerPlayType.includes('rush') || lowerPlayType.includes('run')) {
    // RUSH PLAYS
    const rushMatch = cleanedPlayText.match(/^([A-Za-z\s.',-]{2,40}?)\s+(?:run|rush)/i);
    if (rushMatch) {
      result.rusher = cleanPlayerName(rushMatch[1]);
    }
  } else if (lowerPlayType.includes('pass') || lowerPlayType.includes('completion') ||
             lowerPlayType.includes('incompletion') || lowerPlayType.includes('interception')) {
    // PASS PLAYS (skip sacks)
    if (cleanedPlayText.toLowerCase().includes('sacked')) {
      return result;
    }

    // Extract passer
    let passer = '';
    const passFromMatch = cleanedPlayText.match(/pass from ([^(,]+)/i);
    if (passFromMatch) {
      passer = passFromMatch[1].trim();
    } else {
      const standardPassMatch = cleanedPlayText.match(/^([A-Za-z\s.',-]{2,40}?)\s+pass(?:\s+(?:complete|incomplete))/i);
      if (standardPassMatch) {
        passer = standardPassMatch[1].trim();
      }
    }
    if (passer) {
      result.passer = cleanPlayerName(passer);
    }

    // Extract receiver
    let receiver = '';
    if (cleanedPlayText.includes('pass from')) {
      const scoringMatch = cleanedPlayText.match(/^([^0-9]+)/);
      if (scoringMatch) {
        receiver = scoringMatch[1].trim();
      }
    } else if (cleanedPlayText.includes(' to ') && !cleanedPlayText.includes('intercepted')) {
      const receiverMatch = cleanedPlayText.match(/\s+to\s+(?:#\d+\s+)?([A-Z][\w\s.'-]+?)(?:\s+caught|\s+thrown|\s+for\s*|$)/i);
      if (receiverMatch) {
        receiver = receiverMatch[1].trim();
      }
    }
    if (receiver) {
      result.receiver = cleanPlayerName(receiver);
    }
  }

  return result;
}
```

## Aggregating Player Stats

**For Rushers**:
```javascript
function aggregateRushers(plays) {
  const rushPlays = plays.filter(p =>
    (p.play_type?.toLowerCase().includes('rush') ||
     p.play_type?.toLowerCase().includes('run')) &&
    !p.play_text?.toLowerCase().includes('team')
  );

  const playerStats = {};

  rushPlays.forEach(play => {
    const names = extractPlayerNames(play.play_text, play.play_type);
    if (names.rusher) {
      if (!playerStats[names.rusher]) {
        playerStats[names.rusher] = {
          name: names.rusher,
          explosive: 0,
          successful: 0,
          unsuccessful: 0,
          total: 0
        };
      }

      const success = calculateSuccess(play.down, play.distance, play.yards_gained);
      const explosive = calculateExplosiveness(play.yards_gained);

      playerStats[names.rusher].total++;
      if (explosive) {
        playerStats[names.rusher].explosive++;
      } else if (success) {
        playerStats[names.rusher].successful++;
      } else {
        playerStats[names.rusher].unsuccessful++;
      }
    }
  });

  return Object.values(playerStats)
    .filter(p => p.total >= 1)
    .sort((a, b) => b.total - a.total);
}
```

**For Passers**:
```javascript
function aggregatePassers(plays) {
  const passPlays = plays.filter(p =>
    (p.play_type?.toLowerCase().includes('pass') ||
     p.play_type?.toLowerCase().includes('completion') ||
     p.play_type?.toLowerCase().includes('incompletion') ||
     p.play_type?.toLowerCase().includes('interception'))
  );

  const playerStats = {};

  passPlays.forEach(play => {
    const names = extractPlayerNames(play.play_text, play.play_type);
    if (names.passer) {
      if (!playerStats[names.passer]) {
        playerStats[names.passer] = {
          name: names.passer,
          explosive: 0,
          successful: 0,
          unsuccessful: 0,
          otherCatches: 0,
          interceptions: 0,
          total: 0
        };
      }

      const playText = play.play_text.toLowerCase();
      const success = calculateSuccess(play.down, play.distance, play.yards_gained);
      const explosive = calculateExplosiveness(play.yards_gained);

      playerStats[names.passer].total++;

      if (playText.includes('interception') || playText.includes('intercepted')) {
        playerStats[names.passer].interceptions++;
      } else {
        const isCompletion = (playText.includes('complete') && !playText.includes('incomplete')) ||
                            playText.includes('reception') ||
                            playText.includes('pass from');

        if (isCompletion) {
          if (explosive) {
            playerStats[names.passer].explosive++;
          } else if (success) {
            playerStats[names.passer].successful++;
          } else {
            playerStats[names.passer].otherCatches++;
          }
        } else {
          playerStats[names.passer].unsuccessful++;
        }
      }
    }
  });

  return Object.values(playerStats)
    .filter(p => p.total >= 1)
    .sort((a, b) => b.total - a.total);
}
```

**For Receivers**:
```javascript
function aggregateReceivers(plays) {
  const passPlays = plays.filter(p => {
    const playText = p.play_text?.toLowerCase() || '';
    const isCompletion = (playText.includes('complete') && !playText.includes('incomplete')) ||
                        playText.includes('reception') ||
                        playText.includes('pass from');
    return (p.play_type?.toLowerCase().includes('pass') ||
            p.play_type?.toLowerCase().includes('completion') ||
            p.play_type?.toLowerCase().includes('reception')) && isCompletion;
  });

  const playerStats = {};

  passPlays.forEach(play => {
    const names = extractPlayerNames(play.play_text, play.play_type);
    if (names.receiver) {
      if (!playerStats[names.receiver]) {
        playerStats[names.receiver] = {
          name: names.receiver,
          explosive: 0,
          successful: 0,
          otherCatches: 0,
          total: 0
        };
      }

      const success = calculateSuccess(play.down, play.distance, play.yards_gained);
      const explosive = calculateExplosiveness(play.yards_gained);

      playerStats[names.receiver].total++;
      if (explosive) {
        playerStats[names.receiver].explosive++;
      } else if (success) {
        playerStats[names.receiver].successful++;
      } else {
        playerStats[names.receiver].otherCatches++;
      }
    }
  });

  return Object.values(playerStats)
    .filter(p => p.total >= 1)
    .sort((a, b) => b.total - a.total);
}
```

## Multi-Game Aggregation Pattern

When analyzing multiple games (e.g., full season):

```javascript
async function fetchSeasonData(team, year) {
  // 1. Get all games for team
  const gamesResponse = await fetch(
    `https://api.collegefootballdata.com/games?year=${year}&team=${encodeURIComponent(team)}`
  );
  const games = await gamesResponse.json();

  // 2. Fetch plays for each game
  let allPlays = [];
  for (const game of games) {
    const playsResponse = await fetch(
      `https://api.collegefootballdata.com/plays?gameId=${game.id}`
    );
    const plays = await playsResponse.json();

    // Filter to just this team's plays
    const teamPlays = plays.filter(p => p.offense === team);
    allPlays = allPlays.concat(teamPlays);
  }

  return allPlays;
}

// Usage
const seasonPlays = await fetchSeasonData('Alabama', 2024);
const thirdDownPlays = seasonPlays.filter(p => p.down === 3);
const thirdDownSR = calculateSuccessRate(thirdDownPlays);
```

## Grouping Data

**By Quarter**:
```javascript
function groupByQuarter(plays) {
  const quarters = {};
  plays.forEach(play => {
    const q = play.quarter > 4 ? 'OT' : `Q${play.quarter}`;
    if (!quarters[q]) quarters[q] = [];
    quarters[q].push(play);
  });
  return quarters;
}
```

**By Down**:
```javascript
function groupByDown(plays) {
  const downs = {};
  [1, 2, 3, 4].forEach(down => {
    downs[`${down}${down === 1 ? 'st' : down === 2 ? 'nd' : down === 3 ? 'rd' : 'th'}`] =
      plays.filter(p => p.down === down);
  });
  return downs;
}
```

**By Distance**:
```javascript
function groupByDistance(plays) {
  return {
    'Short (1-3)': plays.filter(p => p.distance <= 3),
    'Medium (4-7)': plays.filter(p => p.distance >= 4 && p.distance <= 7),
    'Long (8+)': plays.filter(p => p.distance >= 8)
  };
}
```

**By Play Type**:
```javascript
function groupByPlayType(plays) {
  return {
    'Rush': plays.filter(p => p.play_type?.toLowerCase().includes('rush') ||
                              p.play_type?.toLowerCase().includes('run')),
    'Pass': plays.filter(p => p.play_type?.toLowerCase().includes('pass') ||
                              p.play_type?.toLowerCase().includes('sack') ||
                              p.play_type?.toLowerCase().includes('interception'))
  };
}
```
