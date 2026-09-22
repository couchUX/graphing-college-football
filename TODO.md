# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

### Queued after the Press Box styling PR

- **Site metadata points at the `.vercel.app` host, not the canonical domain.**
  `cfb-adv-metrics-dashboard.vercel.app` is hardcoded in 26 places: every
  `og:url`/`og:image`/`twitter:image` and the JSON-LD `url` across
  `index/games/ratings/trends.html`, the four `MetaTags` calls in
  `Dashboard`/`RatingsPage`/`TeamTrendsPage`/`DiscoverPage`, the `Sitemap:`
  line in `public/robots.txt`, and the single `<loc>` in `public/sitemap.xml`.

  Nothing is broken — the project rename to `graphing-college-football` kept
  that hostname attached and verified, so those URLs still resolve. But it is
  not the canonical host: the project serves `www.graphingcollegefootball.com`,
  with the apex redirecting to it. Pointing canonical/og/sitemap at a
  non-canonical duplicate splits SEO signals between the two hostnames, and
  the `.vercel.app` name is the one tied to the project name, so it's the one
  that would move if the project were renamed again.

  Fix by pointing all of it at `https://www.graphingcollegefootball.com` — the
  redirect target, so no hop. Note `RatingsPage`'s embed generator links back
  to the apex (`https://graphingcollegefootball.com/ratings`), which is fine
  for a link but worth making consistent. The sitemap also lists only `/`, so
  `/games`, `/ratings`, `/trends` and `/discover` are worth adding while in
  there.

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

- **Seven FBS teams still hold the gray placeholder in `teamColors.ts`.**
  Fixing Vanderbilt turned up the rest: Appalachian State, Army, Buffalo,
  Colorado, Iowa, New Mexico and Northern Illinois all carry the
  `rgba(140, 140, 140, …)` default, so any chart featuring one draws in the
  same gray as an unknown team. Southern Miss too, reachable now that the
  alias maps CFBD's "Southern Mississippi" onto it. None of them is broken
  the way NC State was — the names resolve, the values are just placeholders —
  so they wait for a deliberate pass on the palette rather than a drive-by.

## Shipped

- **Pages retain their state across tab switches** — done, in two parts.
  Ratings now keeps `year`, `conference` and `sort` in the URL the way Discover
  does, so its own Top 25 embed links (`/ratings?year=&conference=`) finally
  open where they point; a conference is vetted against the season's actual
  ratings once they load, so Pac-12 in 2024 or a typo falls back to all
  conferences instead of an empty table.

  Carrying that across sections is `src/utils/sessionViewState.ts`. MainNav is
  plain `<a href>`, so every section switch is a real page load and the query
  string dies with it — this snapshots it per path into sessionStorage on
  `pagehide` and replays it on a bare load, letting each page's existing
  URL-restore path do the work (Games re-selects the game and re-fetches,
  Trends reloads the season). A URL that carries params of its own always
  wins, so a shared link never picks up the visitor's last session.

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
  these survive tab switches. Generic read/write helpers in
  `src/utils/urlState.ts`; the game-index encoding stays in `trendsUrl.ts`.

- **Shareable filters on Discover** — done. The season recap opens on the
  season underway (2026 from August, not the last one that finished) and keeps
  `year` plus a non-default `conference` in the URL, so a link shared mid-season
  reopens on that exact slice instead of drifting forward with the site.
