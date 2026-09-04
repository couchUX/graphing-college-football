# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

### Queued after the passing API PR

- **Run the passing coverage check.** `node scripts/passing-coverage.mjs` with a
  real `CFB_API_KEY`, then paste the table into the status block at the top of
  [`docs/plan/PASSING_API.md`](./docs/plan/PASSING_API.md). Until that runs we
  don't know how far back air yards and target location actually go. Below 60%
  coverage the charts show a notice instead of a chart, so a thin season is
  never misleading — but knowing which seasons are thin is still worth having.

- **Decided: the passing data stays in its own charts.** The existing efficiency
  charts keep computing from play text and keep their current numbers, because
  depth data won't be there for every game and a chart that changes definition
  depending on the season is worse than two honest charts. When the data is
  missing the new charts keep their cards and explain the gap, the same way the
  win probability chart does.

- **`Top rushers` is now the odd name out** next to `Passer efficiency` and
  `Receiver efficiency`. Renaming it belongs with the `/rushing` endpoints,
  which carry PPA and success and would give it the same treatment.

### Queued after the Press Box styling PR

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

- **UCLA's colors** — done. The sheet had a dull slate blue; the triple is now
  a light sky blue (`success`) with a deeper steel blue for explosives and a
  pale tint, built the same way as every other team's entry.

- **URL routing / shareable state for Team Trends sub-tabs** — done. The active
  sub-tab persists via `?view=compare|spTrends` (default `season` omitted).
  Team vs. Team encodes both teams, each team's color, the year, and each team's
  selected games (`aTeam`/`bTeam`/`aColor`/`bColor`/`year`/`aGames`/`bGames`,
  indices into each team's schedule) and auto-runs the comparison when restored.
  Multi-year SP+ persists `spTeam`. `SeasonSelector` preserves foreign params so
  these survive tab switches. Shared helpers in `src/utils/trendsUrl.ts`.
