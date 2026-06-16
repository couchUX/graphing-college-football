# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

_No open items right now._

## Shipped

- **URL routing / shareable state for Team Trends sub-tabs** — done. The active
  sub-tab persists via `?view=compare|spTrends` (default `season` omitted).
  Team vs. Team encodes both teams, each team's color, the year, and each team's
  selected games (`aTeam`/`bTeam`/`aColor`/`bColor`/`year`/`aGames`/`bGames`,
  indices into each team's schedule) and auto-runs the comparison when restored.
  Multi-year SP+ persists `spTeam`. `SeasonSelector` preserves foreign params so
  these survive tab switches. Shared helpers in `src/utils/trendsUrl.ts`.
