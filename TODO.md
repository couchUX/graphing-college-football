# Pending TODOs

Durable, branch-local notes so follow-up work is remembered across machines and
sessions (not just in a chat). Also mirrored in the PR description.

### Queued after the Press Box styling PR

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
