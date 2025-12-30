# CollegeFootballData.com API Reference

Base URL: `https://api.collegefootballdata.com`

All API calls should include headers:
```javascript
{
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}
```

## Core Endpoints

### 1. Play-by-Play Data
**Endpoint**: `/plays`

**Purpose**: Get detailed play-by-play data for games

**Parameters**:
- `year` (required): Season year (e.g., 2024)
- `week` (optional): Week number (1-15)
- `seasonType` (optional): "regular", "postseason", or "both"
- `team` (optional): Team name (e.g., "Alabama")
- `gameId` (optional): Specific game ID

**Example**:
```javascript
// Get all Alabama plays from Week 1, 2024
fetch('https://api.collegefootballdata.com/plays?year=2024&week=1&team=Alabama&seasonType=regular')

// Get plays from specific game
fetch('https://api.collegefootballdata.com/plays?gameId=401752738')
```

**Response Fields**:
```typescript
{
  id: string,              // Play ID
  drive_id: number,        // Drive ID
  game_id: number,         // Game ID
  drive_number: number,    // Drive number in game
  play_number: number,     // Play number in drive
  offense: string,         // Offensive team name
  defense: string,         // Defensive team name
  offense_conference: string,
  defense_conference: string,
  down: number,            // 1-4
  distance: number,        // Yards to first down
  yards_to_goal: number,   // Yards to endzone
  yards_gained: number,    // Yards gained on play
  play_type: string,       // "Rush", "Pass", "Sack", etc.
  play_text: string,       // Description of play
  ppa: number,             // Predicted Points Added
  quarter: number,         // 1-5 (5 = OT)
  clock: {
    minutes: number,
    seconds: number
  },
  wallclock: string,       // ISO timestamp
  time_remaining: number,  // Seconds remaining in game
  home: string,           // Home team (optional)
  away: string            // Away team (optional)
}
```

### 2. Teams
**Endpoint**: `/teams`

**Purpose**: Get list of all FBS teams with colors and metadata

**Parameters**:
- None required

**Example**:
```javascript
fetch('https://api.collegefootballdata.com/teams')
```

**Response Fields**:
```typescript
{
  id: number,
  school: string,          // "Alabama"
  mascot: string,          // "Crimson Tide"
  abbreviation: string,    // "ALA"
  alt_name_1: string,      // Alternative name
  conference: string,      // "SEC"
  division: string,        // "West"
  color: string,           // Primary hex color "#9E1B32"
  alt_color: string,       // Secondary hex color "#828A8F"
  logos: string[]          // Array of logo URLs
}
```

### 3. Games
**Endpoint**: `/games`

**Purpose**: Get game information for team(s) in a season

**Parameters**:
- `year` (required): Season year
- `week` (optional): Week number
- `team` (optional): Team name
- `id` (optional): Specific game ID
- `seasonType` (optional): "regular", "postseason", or "both"

**Example**:
```javascript
// Get all Alabama games in 2024
fetch('https://api.collegefootballdata.com/games?year=2024&team=Alabama')

// Get specific game info
fetch('https://api.collegefootballdata.com/games?id=401752738')
```

**Response Fields**:
```typescript
{
  id: number,
  season: number,
  week: number,
  seasonType: string,
  startDate: string,       // ISO timestamp
  completed: boolean,
  neutralSite: boolean,
  conferenceGame: boolean,
  venue: string,
  homeTeam: string,
  homeConference: string,
  homePoints: number,
  homeLineScores: number[], // Points by quarter
  awayTeam: string,
  awayConference: string,
  awayPoints: number,
  awayLineScores: number[],
  excitementIndex: number
}
```

### 4. Win Probability
**Endpoint**: `/metrics/wp`

**Purpose**: Get play-by-play win probability data

**Parameters**:
- `gameId` (required): Game ID

**Example**:
```javascript
fetch('https://api.collegefootballdata.com/metrics/wp?gameId=401752738')
```

**Response Fields**:
```typescript
{
  gameId: number,
  homeId: number,
  home: string,
  awayId: number,
  away: string,
  playId: string,
  playText: string,
  homeScore: number,
  awayScore: number,
  down: number,
  distance: number,
  homeWinProbability: number,  // 0-1 (0.65 = 65%)
  spread: number,
  yardLine: number,
  homeBall: boolean,
  playNumber: number
}
```

### 5. SP+ Ratings
**Endpoint**: `/ratings/sp`

**Purpose**: Get SP+ ratings for teams

**Parameters**:
- `year` (required): Season year
- `team` (optional): Specific team

**Example**:
```javascript
// Get all SP+ ratings for 2024
fetch('https://api.collegefootballdata.com/ratings/sp?year=2024')

// Get Alabama's SP+ rating
fetch('https://api.collegefootballdata.com/ratings/sp?year=2024&team=Alabama')
```

**Response Fields**:
```typescript
{
  year: number,
  team: string,
  conference: string,
  rating: number,        // Overall SP+ rating
  ranking: number,       // National ranking
  secondOrderWins: number,
  sos: number,          // Strength of schedule
  offense: {
    ranking: number,
    rating: number
  },
  defense: {
    ranking: number,
    rating: number
  },
  specialTeams: {
    rating: number
  }
}
```

## Common Query Patterns

### Get Full Season Data for a Team
```javascript
// 1. Get all games
const games = await fetch(
  'https://api.collegefootballdata.com/games?year=2024&team=Alabama'
).then(r => r.json());

// 2. For each game, get plays
for (const game of games) {
  const plays = await fetch(
    `https://api.collegefootballdata.com/plays?gameId=${game.id}`
  ).then(r => r.json());
  // Process plays...
}
```

### Compare Two Teams
```javascript
// Get plays for both teams in their matchup
const plays = await fetch(
  'https://api.collegefootballdata.com/plays?year=2024&week=3&team=Alabama'
).then(r => r.json());

// Filter by offense to separate teams
const alabamaPlays = plays.filter(p => p.offense === 'Alabama');
const opponentPlays = plays.filter(p => p.offense !== 'Alabama');
```

### Get Player Stats Across Season
```javascript
// 1. Get all games for team
const games = await fetch(
  'https://api.collegefootballdata.com/games?year=2024&team=Alabama'
).then(r => r.json());

// 2. Collect all plays
let allPlays = [];
for (const game of games) {
  const plays = await fetch(
    `https://api.collegefootballdata.com/plays?gameId=${game.id}`
  ).then(r => r.json());
  allPlays = allPlays.concat(plays);
}

// 3. Extract player names and aggregate
// (Use player extraction logic from metrics.ts)
```

## Rate Limiting

- Free tier: 200 requests per hour
- Be mindful of rate limits when fetching multiple games
- Consider caching results when possible

## Common Filters

### Play Types
- `Rush` / `Run` - Running plays
- `Pass` - Pass plays (complete or incomplete)
- `Completion` - Completed passes
- `Incompletion` - Incomplete passes
- `Interception` - Intercepted passes
- `Sack` - Quarterback sacks
- `Punt` - Punts
- `Field Goal` - Field goal attempts
- `Kickoff` - Kickoffs

### Season Types
- `regular` - Regular season
- `postseason` - Bowl games, playoffs
- `both` - All games

### Downs
- Filter by `down` field: 1, 2, 3, or 4

### Situations
- Red Zone: `yards_to_goal <= 20`
- Short Distance: `distance <= 3`
- Medium Distance: `distance >= 4 && distance <= 7`
- Long Distance: `distance >= 8`
