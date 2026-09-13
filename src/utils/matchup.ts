/**
 * How a game reads from one team's side: "Alabama at Kentucky" when that team
 * is the visitor, "Alabama vs. Kentucky" at home or at a neutral site.
 *
 * The venue comes from the schedule (`/games`), which knows the away team and
 * whether the site was neutral. Without it the matchup falls back to "vs."
 * rather than guessing at a road game: the plays feed knows home and away, but
 * not whether the site was neutral.
 */

export interface GameVenue {
  awayTeam?: string;
  neutralSite?: boolean;
}

export const matchupSeparator = (team: string, venue?: GameVenue | null): 'at' | 'vs.' =>
  venue && !venue.neutralSite && venue.awayTeam === team ? 'at' : 'vs.';

export const formatMatchup = (team: string, opponent: string, venue?: GameVenue | null): string =>
  `${team} ${matchupSeparator(team, venue)} ${opponent}`;
