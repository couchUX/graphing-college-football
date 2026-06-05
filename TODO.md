# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

## URL routing / shareable state for Team Trends sub-tabs

**Status:** not started.

**Problem.** The `/games` experience and the Season trends main view persist
state in the URL — refreshing keeps the same view + data, and params let you
share a specific view. The Team Trends **sub-tabs are not yet reflected in the
URL**, so:

- Refreshing always returns to the default "Season trends" sub-tab (the active
  sub-tab isn't encoded).
- There are no params to share a specific **Team vs. Team** view (e.g. team A vs.
  team B with specific games selected for each).

**Scope when tackled.**

- Add a sub-view URL param, e.g. `?view=season|compare|spTrends`, and restore the
  active sub-tab from it on load.
- For **Team vs. Team**, encode everything needed to reproduce the comparison:
  both teams, **each team's selected games**, each team's color, and the year —
  then restore from the URL on load.
- Use **namespaced params** for the two-team view (e.g. `aTeam`/`bTeam`,
  `aGames`/`bGames`, `aColor`/`bColor`) so they don't collide with the existing
  single-team params (`team`/`year`/`games`/`teamColor`) that `SeasonSelector`
  already reads/writes.
- Mirror the existing read/write pattern in `SeasonSelector` (URL <-> state).

**Relevant files.** `TeamTrendsPage` (sub-view state + switcher),
`TeamCompareView` (teams/games/colors state + the per-team game-loading
effects), `MultiYearSpTrends`, and `SeasonSelector` (reference implementation).
