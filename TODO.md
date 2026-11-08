# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

### Queued after the Press Box styling PR

- **Seven FBS teams still hold the gray placeholder in `teamColors.ts`.**
  Fixing Vanderbilt turned up the rest: Appalachian State, Army, Buffalo,
  Colorado, Iowa, New Mexico and Northern Illinois all carry the
  `rgba(140, 140, 140, …)` default, so any chart featuring one draws in the
  same gray as an unknown team. Southern Miss too, reachable now that the
  alias maps CFBD's "Southern Mississippi" onto it. None of them is broken
  the way NC State was — the names resolve, the values are just placeholders —
  so they wait for a deliberate pass on the palette rather than a drive-by.

### Garbage-time follow-ups

- **Box score still counts garbage time.** It's CFBD's advanced box score,
  not computed from our plays. CFBD's game-level advanced stats take an
  `excludeGarbageTime` flag, but its definition may not match SP+'s; worth
  checking before wiring the box score to the toggle.
- **Thresholds and sticky mode have no UI.** `findGarbageTimePlays` takes
  `{ thresholds, sticky }`; the pages always use the SP+ defaults. The spec
  listed both as optional.

## Shipped

- **Garbage-time filter** — done. A play snapped with a margin over 38/28/22/16
  (Q1–Q4) is garbage time; overtime never is, and plays count again after a
  comeback. "Exclude garbage time" is on by default on Games, Season trends
  and Team vs. Team, with the number of plays it takes out beside it. Totals,
  rates, drive and player charts drop those plays; the Game Wave, play maps
  and cumulative lines keep them in gray so the game's shape stays put, and
  the cumulative lines hold level through them. The setting lives in the URL
  (`garbageTime=include` when off), so links and card links reopen it, and
  embeds copied with it on say how many plays they exclude. The CSV keeps
  every play and adds a `garbage_time` column.

  The tagging walks a running score from the raw feed, because CFBD's
  per-play score already includes points scored on that play. That needs the
  kickoffs and extra points `processPlayData` throws away, so it runs first.

  Verified against live CFBD data for the spec's seven Alabama games: all 28
  success rates (raw and filtered, both teams) match to the tenth, and the
  close games exclude nothing. The spec's "plays removed" column counts every
  feed row, timeouts and End of Game included; the app shows rush/pass plays
  only, so its numbers are smaller (73, not 98, for 2022 Mississippi State).
  The 2026 LSU feed now carries an End of Game row the spec's 21 predates, so
  it tags 22 rows there; no rate moves. `npm run check:garbage` asserts the
  rush/pass counts and the rates, and prints the row counts for reference.

- **All-plays table shows garbage time** — done. Garbage-time rows stay in the
  table, grayed while the filter is on, with Score (at the snap, offense
  first) and Garbage time columns next to Quarter, so a comeback reads as the
  gray rows ending when the score comes back inside the margin.

- **Score walk is a median of three stamps, not max()** — done. Across 259
  SEC/Big Ten games from 2024, CFBD's per-play scores glitched both ways:
  223 one-row dips and 24 overstatements that were later corrected (20
  games). max() locked the overstatements in, which mis-tagged four games,
  33 plays in Michigan-Minnesota alone (it read Michigan's 21-0 halftime lead
  as 28-0). The spec asked for max(); the median still reproduces its
  reference table exactly.

- **Decision: comebacks don't re-label earlier garbage time.** The question
  was whether a team getting back in the game means the stretch before it
  wasn't garbage time after all ("hindsight"). Same 2024 sample, 258 games:
  155 had garbage time, 36 came back inside the margin, none of those 36
  leaders lost, and only 6 ever got within one score. Hindsight would put back
  521 plays, but just 103 of them come from those 6 real comebacks; 172 come
  from comebacks that started with under five minutes left (Arkansas State's
  touchdown with 0:08 left at Michigan would put back the whole fourth
  quarter, 34 plays). The SP+ rule already counts a comeback once it's back in
  reach. What it gives up is the start of the rare real one (Georgia's 33
  plays from 30-7 to 30-15 at Alabama). It also keeps a play's label fixed
  once snapped, which matters for games charted live. Season success rates
  barely move either way (median 0.19 pts across 34 teams). If the fixed
  per-quarter thresholds ever feel too blunt, the better fix is time-aware
  (CFBD win probability), not hindsight.

- **Share menu on every chart** — done. The copy-embed button on each card is
  now a share menu: copy embed code, copy image, download image, copy link.
  Images are the card on paper with an even 32px margin, at up to 3× (a
  half-width Games card comes out ~2,000px wide; full-width cards ease toward
  2× and cap at 3,200px). Links carry the page's state plus a `#card-id`
  fragment and land on that card once it has loaded. The old button had been
  hand-rolled in eleven components, in three different styles; it's one
  component now.

  Worth knowing: the Ratings and Discover pages called `useToast()` from
  *outside* their own `AppShell`, so their old "copied" toasts never showed.
  The share menu lives inside the shell, so its toasts do. Dashboard's
  "Page link copied" toast has the same problem and still doesn't show.

  Also fixed in passing: the embed tester's preview gave the embed 24px of
  clear paper above it; it's 40px now (24px on phones), so a screenshot can
  take even margins without catching the Preview heading.

- **Postseason labels understand the 12-team bracket** — done. The label logic
  lived twice, in `GameSelector` and `SeasonSelector`, and had already drifted:
  only one knew the conference championships, only the other could pull a bowl
  name out of arbitrary notes. It is now one `src/utils/postseasonLabel.ts`,
  with first-round and quarterfinal cases added.

  The real bug was the fallback for a playoff game whose notes name no round:
  it returned "CFP Semifinal" for the first and "National Championship" for
  every one after, so a team's four-game run reported three title games. It now
  numbers them (`CFP Game 2`) rather than asserting a round it cannot know.
  Fixing the shared bowl regex also fixed "Duke's Mayo Bowl", which the old
  `\w`-only capture rendered as "S Mayo Bowl".

  `npm run check:postseason` covers the grammar (20 cases). Still worth doing
  when someone has an API key: check CFBD's real `notes` strings for 2024 and
  2025 and confirm the round matches fire — the strings here are best-effort,
  and quarterfinals played as bowls may well match the bowl name first.

- **The selected team carries into Team vs. Team** — done. Switching from a
  team's season to Team vs. Team pre-fills it as Team A. Only when the link
  names neither side, so an existing comparison wins, and it pre-fills without
  running the comparison, which would fire a season fetch nobody asked for.

- **Site metadata points at the canonical domain** — done. All 26 references to
  `cfb-adv-metrics-dashboard.vercel.app` now read
  `https://www.graphingcollegefootball.com`: the `og:url`/`og:image`/
  `twitter:image` and JSON-LD `url` in the four HTML entry points, the four
  `MetaTags` calls, the `Sitemap:` line in `public/robots.txt`, and
  `public/sitemap.xml`. The www host, not the apex — Vercel serves www and 301s
  the apex, so a canonical on the apex would point at a redirect.

  The TypeScript side reads `SITE_URL` from `src/constants/site.ts` rather than
  repeating the literal, so the next hosting rename is one edit plus the HTML
  and `public/` files, which can't import it. The sitemap also listed only `/`;
  it now carries `/games`, `/ratings`, `/trends` and `/discover`, and its
  hardcoded `lastmod` of 2025-01-01 is gone rather than left lying.

  The `<link rel="canonical">` tags go through `useCanonical` for the same
  reason: Games and Trends built theirs from `window.location.origin`, so a
  crawler arriving on the still-attached `.vercel.app` host got pages naming
  that duplicate as their own canonical. Ratings and Discover emitted none at
  all and now do.

  Not touched: the embed generators still link back to the apex
  (`https://graphingcollegefootball.com/...`). Those are reader-facing links
  where the redirect costs nothing, and changing them would change what copied
  embeds regenerate as — worth unifying, but as its own decision.

- **Pages retain their state across tab switches** — done, in two parts.
  Ratings now keeps `year`, `conference` and `sort` in the URL the way Discover
  does, so its own Top 25 embed links (`/ratings?year=&conference=`) finally
  open where they point; a conference is vetted against the season's actual
  ratings once they load, so Pac-12 in 2024 or a typo falls back to all
  conferences instead of an empty table. Season switches go through the same
  `requestRef` sequencing `Dashboard` uses for play-by-play — without it a slow
  season landing after a fast one re-vetted the conference against the wrong
  year, clearing a filter valid for the season on screen and persisting that.

  Carrying that across sections is `src/utils/sessionViewState.ts`. MainNav is
  plain `<a href>`, so every section switch is a real page load and the query
  string dies with it — this snapshots it per path into sessionStorage on
  `pagehide` and replays it on a bare load, letting each page's existing
  URL-restore path do the work (Games re-selects the game and re-fetches,
  Trends reloads the season). A URL that carries params of its own always
  wins, so a shared link never picks up the visitor's last session. A tab
  opened from another inherits its opener's snapshots as a seed, because that
  is how browsers duplicate sessionStorage; the two diverge from then on.

  The same pass moved the Ratings definitions panel below both tables, put the
  active filter in the meta line under the title (`2019 season · SEC · Data
  definitions`), and made that fragment real: `/ratings#data-definitions`
  opens and scrolls to it on arrival, a modified click goes to the browser,
  and both `writeParams` and `restoreViewState` preserve the hash — each was
  rebuilding the URL from pathname plus query and dropping the anchor.

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
