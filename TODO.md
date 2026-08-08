# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

### Queued after the Press Box styling PR

- **UCLA should be baby blue.** Its entry in `src/utils/teamColors.ts` doesn't
  reflect the actual program color. Chart color values are on the no-touch list
  for incidental work, so this is a deliberate, explicit data fix — check the
  `success` / `explosive` / `light` triple stays internally consistent with how
  the other teams are built.

- **Pages should retain their state across tab switches.** Loading the 2025
  Alabama–Missouri game on Games, switching to Trends, then coming back resets
  the page instead of restoring the game. Team Trends already solved this by
  encoding its state in the URL (`src/utils/trendsUrl.ts`, see Shipped below);
  Games/Ratings/Discover need the equivalent, or a shared store. Note that
  Games already writes `year`/`team`/`gameId` to the canonical link, so the
  missing piece is reading it back on mount and re-fetching.

- **Carry the selected team into Team vs. Team.** When someone is looking at a
  team on Season trends and switches to Team vs. Team, pre-fill that team as
  Team A — they're almost certainly about to compare it against someone. Per
  the point above, only pre-fill when Team vs. Team has no state of its own
  yet; an existing comparison wins.

## Shipped

- **URL routing / shareable state for Team Trends sub-tabs** — done. The active
  sub-tab persists via `?view=compare|spTrends` (default `season` omitted).
  Team vs. Team encodes both teams, each team's color, the year, and each team's
  selected games (`aTeam`/`bTeam`/`aColor`/`bColor`/`year`/`aGames`/`bGames`,
  indices into each team's schedule) and auto-runs the comparison when restored.
  Multi-year SP+ persists `spTeam`. `SeasonSelector` preserves foreign params so
  these survive tab switches. Shared helpers in `src/utils/trendsUrl.ts`.
