# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

### Queued after the Press Box styling PR

- **Pages should retain their state across tab switches.** Loading the 2025
  Alabama–Missouri game on Games, switching to Trends, then coming back resets
  the page instead of restoring the game. Team Trends already solved this by
  encoding its state in the URL (`src/utils/trendsUrl.ts`, see Shipped below);
  Games/Ratings/Discover need the equivalent, or a shared store. Note that
  Games already writes `year`/`team`/`gameId` to the canonical link, so the
  missing piece is reading it back on mount and re-fetching.

- **Postseason labels still assume the four-team playoff.** With the 12-team
  bracket a team can play four postseason games, but `getPostseasonLabel` (in
  both `GameSelector.tsx` and `SeasonSelector.tsx`) only knows semifinal and
  title game: its `PLAYOFF`/`CFP` fallback labels the first postseason game
  "CFP Semifinal" and everything after it "National Championship". First-round
  and quarterfinal games need their own cases. Not urgent until December —
  and worth checking CFBD's actual `notes` strings for 2025 before writing the
  matches.

- **Carry the selected team into Team vs. Team.** When someone is looking at a
  team on Season trends and switches to Team vs. Team, pre-fill that team as
  Team A — they're almost certainly about to compare it against someone. Per
  the point above, only pre-fill when Team vs. Team has no state of its own
  yet; an existing comparison wins.

## Shipped

- **Down & distance in game chart tooltips** — done. Every play-level tooltip
  on Games (SR/XR, SR by play type, rush rate, play maps, win probability)
  shows the pre-snap situation ("2nd & 7", "1st & goal") on its own line, on
  screen and in copied embeds. Win probability gets it by joining each row to
  the play-by-play feed on playId. Formatter in `src/utils/downDistance.ts`.

- **Overturned and nullified plays keep their Game Wave markers** — fixed. CFBD
  leaves the superseded call in the play text ("(Original Play: … TOUCHDOWN …)"
  after a replay reversal, "TOUCHDOWN nullified by penalty" after a flag), which
  earned a false 6, or a false i on an overturned pick. Those calls are cut
  before the text is read; across 830 games no real touchdown lost its 6.

- **What a win probability row describes** — answered, and
  `npm run check:wp <gameId>` re-checks it: the % is the pre-snap state of the
  play the row names, except scoring rows, which already carry the new score.

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
