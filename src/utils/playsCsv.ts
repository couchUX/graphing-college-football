import type { PlayData } from '../types';

// Minimal game context used to enrich CSV rows. TeamGame[] satisfies this
// structurally, so the season pages can pass their games array directly.
export interface PlaysCsvGame {
  id: number;
  season?: number;
  week?: number;
  seasonType?: string;
  startDate?: string;
  homeTeam?: string;
  awayTeam?: string;
  neutralSite?: boolean;
}

// Wrap a value per RFC 4180: quote it when it contains a comma, quote, or newline.
const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatClock = (clock: PlayData['clock']): string => {
  if (!clock) return '';
  const minutes = clock.minutes ?? 0;
  const seconds = clock.seconds ?? 0;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const HEADERS = [
  'game_id',
  'season',
  'week',
  'season_type',
  'date',
  'home_team',
  'away_team',
  'neutral_site',
  'drive_number',
  'play_in_drive',
  'team_play_number',
  'offense',
  'defense',
  'offense_conference',
  'defense_conference',
  'quarter',
  'clock',
  'time_remaining',
  'down',
  'distance',
  'yards_to_goal',
  'yards_gained',
  'play_type',
  'success',
  'explosiveness',
  'extra_yards',
  'ppa',
  'rusher',
  'passer',
  'receiver',
  'play_text',
] as const;

export const playsToCsv = (plays: PlayData[], games: PlaysCsvGame[] = []): string => {
  const gameById = new Map<number, PlaysCsvGame>();
  games.forEach((game) => gameById.set(game.id, game));

  const lines = [HEADERS.join(',')];

  for (const play of plays) {
    const game = gameById.get(play.gameId);
    const row = [
      play.gameId,
      game?.season ?? '',
      game?.week ?? '',
      game?.seasonType ?? '',
      game?.startDate ?? '',
      game?.homeTeam ?? '',
      game?.awayTeam ?? '',
      game?.neutralSite ?? '',
      play.driveNumber,
      play.playInDrive,
      play.teamPlayNumber,
      play.offense,
      play.defense,
      play.offenseConference,
      play.defenseConference,
      play.quarter,
      formatClock(play.clock),
      play.timeRemaining,
      play.down,
      play.distance,
      play.yardsToGoal,
      play.yardsGained,
      play.playType,
      play.success,
      play.explosiveness,
      play.extraYards,
      play.ppa,
      play.rusher ?? '',
      play.passer ?? '',
      play.receiver ?? '',
      play.playText,
    ];
    lines.push(row.map(csvCell).join(','));
  }

  return lines.join('\n');
};

export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const buildPlaysCsvFilename = (team: string, year: number, extra?: string): string => {
  const parts = [slugify(team) || 'team', String(year)];
  if (extra) parts.push(slugify(extra));
  parts.push('plays');
  return `${parts.join('-')}.csv`;
};
