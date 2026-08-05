# Code Review — Findings & Savings Plan

_Simplify-style review (reuse / simplification / efficiency / dead code) of the whole
codebase, February session, planned on branch `claude/code-review-aesthetic-redesign-nl6p0p`._
_Findings only — fixes land in the follow-up implementation session. Ordered by payoff._

## Evidence gathered

| Measure | Value |
|---|---|
| Source size | 20,898 lines across `src/` |
| Largest files | `ChartsGrid.tsx` 1,641 · `RatingsPage.tsx` 1,442 · `Dashboard.tsx` 1,271 |
| ESLint (`npm run lint`) | **202 problems** (188 errors, 14 warnings) — dominated by `no-explicit-any`; plus unused vars, `prefer-const` |
| Production build | **Single 865 KB JS chunk (236 KB gzip)** — Vite emits a chunk-size warning; zero code-splitting |
| `console.log` in src | 45 |
| "Copy embed code" button JSX | repeated **28×** across 10 components |
| White card shell (`bg-white rounded-xl border …`) | repeated **34×** across 9 components |
| Rush/pass play-type sniffing (`includes('rush') \|\| includes('run')`) | repeated **12×** across 3 files |
| Page chrome (header/nav/footer/gradient) | copy-pasted in all 4 page components |

Note: `CLAUDE.md` still describes ChartsGrid as "reduced to 279 lines" — it has grown
back to 1,641. The doc is stale and misleads future sessions (see P3-16).

---

## P1 — Structural (largest savings)

### 1. Retire the legacy inline embed generator in `ChartsGrid.tsx` (~–900 lines)
`ChartsGrid.tsx:134-1055` contains a ~920-line `generateEmbedCode` — a giant template
literal with its own CSS, script-loader, formatter logic, and a `switch` over 18 chart
ids (`ChartsGrid.tsx:1057-1227`). Meanwhile `src/utils/chartEmbedGenerator.ts` is the
**newer, better** generic engine (used by Trends/Compare/Discover/Ratings): it
serializes the exact on-screen data/options, HTML-escapes interpolations, and pins the
same Chart.js the app uses.

The legacy inline copy:
- pins **Chart.js 3.9.1** from CDN while the app renders with **4.4.0** (`ChartsGrid.tsx:1022`) — embeds and app can drift visually;
- interpolates titles/team names into HTML without escaping;
- re-implements datalabel/legend/tooltip logic that already lives in `chartOptions.ts`,
  including the fragile `enhanceBarDataWithCounts` hack (`ChartsGrid.tsx:102-133`) that
  invokes datalabel formatters with mock contexts to recover counts.

**Fix:** migrate the 18 game-chart embeds to `generateChartEmbed(spec)` like
`TrendsChartsGrid` already does; delete the inline generator and the switch.
This alone returns ChartsGrid to roughly its intended ~300-line shape.

### 2. Extract an `AppShell` layout (~–350 lines, and the redesign's keystone)
Header (logo/title/subtitle + `MainNav` + info button), footer, page gradient, info
modal, and contact modal are hand-copied in `Dashboard.tsx`, `TeamTrendsPage.tsx`,
`RatingsPage.tsx`, `DiscoverPage.tsx` (`grep bg-gradient-to-br` shows the four
identical wrappers). The contact/info modals live only in Dashboard, so the other
pages' info buttons can't even share them.

**Fix:** `src/components/AppShell.tsx` (header + nav + footer + modals + Toast host),
each page renders `<AppShell current="games">{content}</AppShell>`.
This is a prerequisite for the aesthetic redesign — restyle once, all pages follow.

### 3. Code-split the four pages (initial JS roughly –40–55%)
One 865 KB bundle serves all four entry points; visiting `/ratings` downloads the full
Games dashboard, all 9 Discover detectors, three embed generators, and the 413-line
team-color DB. `App.tsx` routes by `pathname`, so `React.lazy` per page +
`build.rollupOptions.output.manualChunks` (vendor: chart.js/react; data: teamColors)
splits cleanly with no router change. Navigation already full-reloads between the
per-page HTML entries, so per-page chunks map naturally.

### 4. `MetricCard` component in Dashboard (~–190 lines)
`Dashboard.tsx:777-1015` renders 16 near-identical stat tiles (8 desktop + 8 mobile
re-orderings of the same data). One `MetricCard` + a `metrics` array + CSS grid
`order-*` for the mobile alternation collapses ~230 lines to ~40 and makes the tiles a
single restyling target.

### 5. `ChartCard` component + stop double-rendering every chart
The card shell with title + embed button is repeated 5× in `ChartsGrid.tsx`
(`:1404-1464`, `:1472-1511`, `:1522-1634`) and again 9× in `TrendsChartsGrid.tsx`, plus
Ratings/Compare/Discover variants — 28 embed buttons and 34 card shells total.

Worse, every chart is mounted **twice** — a `sm:hidden` mobile container and a
`hidden sm:block` desktop container (`ChartsGrid.tsx:1430-1462`, `:1496-1509`) — so a
loaded game keeps ~38 live Chart.js canvases where ~19 suffice. `useIsMobile` already
exists in `src/hooks/` and is the right tool (or a CSS-variable height on one
container).

**Fix:** one `ChartCard` (title, optional filter slot, embed button with
copied-state, single responsive chart container). Removes ~400 lines across the app,
halves canvas count, and gives the redesign a single chart-frame to restyle.

---

## P2 — Simplification & reuse

6. **`isRushPlay(play)` util** — the `includes('rush') || includes('run')` sniff
   appears 12× (`useChartData.ts` ×7, `useSeasonChartData.ts` ×4,
   `Dashboard.tsx:271`), plus a variant in `chartHelpers.ts:59`. One predicate in
   `utils/metrics.ts`, imported everywhere.
7. **Merge the twin gridline builders** — `createQuarterGridlines` and
   `createTeamQuarterGridlines` (`chartHelpers.ts:95-156`) differ only by
   `playNumber` vs `teamPlayNumber`; take an accessor. Likewise consolidate the
   scattered color converters (`adjustOpacity` in `chartHelpers.ts:387`, `hexToRgb`
   `:529`, `rgbaToHex` in `displayTeamColors.ts:145`, `extractHexColor` in
   `chartHelpers.ts:635`) into one `utils/colorConvert.ts`.
8. **Hoist `TeamFilterDropdown`** — it is defined *inside* the ChartsGrid render body
   (`ChartsGrid.tsx:83-99`), so React remounts the `<select>` on every render
   (dropdown focus/open state can be lost). Move to module scope or its own file.
9. **Dead code (ESLint-confirmed):** `calculateTeamMetrics` and
   `calculateDriveMetrics` (`metrics.ts:464,488`), `createLineOptionsPlayNumber`
   (`chartOptions.ts:78`, imported nowhere), unused `divisor`
   (`seasonBoxScoreMetrics.ts:227`). Also each options factory calls
   `createBaseOptions()` up to 3× to re-spread the same object — build once per
   factory.
10. **Dashboard leftovers** — `filteredPlays = plays` alias (`Dashboard.tsx:280`);
    local `getPlayType` duplicating the shared sniff (`:269`); canonical-URL effect
    (`:165-199`) hand-builds params that `createShareableUrl` already knows how to
    build.
11. **`track()` analytics util** — `(window as any).gtag` blocks with hand-rolled
    param objects in `Dashboard.tsx:214-224` and `ChartsGrid.tsx:1204-1216`; one typed
    `track(event, params)` removes the casts and the duplication.
12. **`useToast` hook** — Dashboard and ChartsGrid each carry
    `showToast/toastMessage` state and render their own `<Toast>`; other pages repeat
    it again. One hook + one host in `AppShell`.

---

## P3 — Types & hygiene

13. **Type the seams, not everything** — 188 errors are mostly `no-explicit-any`.
    Highest-value: `rawApiData: any[]` / `winProbabilityData: any[]`
    (`Dashboard.tsx:20-21`, threaded through ChartsGrid → useChartData →
    chartHelpers). `services/api.ts` already defines `ApiPlayData` — export it and a
    `WinProbPoint` type and let inference flow. Chart.js config internals may keep
    narrow `any` with targeted disables where typing fights the library.
14. **45 `console.log`s** ship to production — delete or wrap in a
    `if (import.meta.env.DEV)` debug helper.
15. **`eslint --fix`** clears the mechanical `prefer-const` / escape-character items.
16. **Refresh `CLAUDE.md`** — it describes a 279-line ChartsGrid, a dev server
    "currently running", and pre-Trends-era structure. Replace the session-log style
    with a short accurate map (pages, services, embed system, detectors) so future
    sessions start from truth. Fold `TODO.md`'s shipped items into git history.

---

## P4 — Efficiency

17. **Cache the hot fetches** — `utils/apiCache.ts` (24 h localStorage TTL) is used
    by Discover detectors only. `fetchTeams()` re-downloads the full FBS+FCS team
    list on **every Games/Trends visit** (`GameSelector.tsx:93`), and
    `fetchGamesForTeam` refetches per team/year switch. Wrap both (teams: 24 h;
    schedules: ~1 h in-season) — snappier loads and fewer CFBD calls against the
    free-tier quota.
18. **Abort stale game fetches** — `handleFetchData` (`Dashboard.tsx:208`) has no
    `AbortController`; two quick "Fetch Data" clicks can resolve out of order and
    paint the wrong game's charts.
19. **Memoize chart options / cards** — all eight `create*Options()` calls run every
    ChartsGrid render (`ChartsGrid.tsx:1260-1267`), producing new option objects for
    19 charts (e.g. each player-filter change). `useMemo` the options and `React.memo`
    the future `ChartCard`.
20. **Dependency placement** — `nodemailer`, `@vercel/node`, `@types/nodemailer` sit
    in the client `package.json` but belong to `api/` (which has its own
    `package.json`). Never bundled, but they slow installs and confuse audits. Also:
    root `test-play-map-scaling.html` is a dev scratch file; `.bolt/` is a Bolt.new
    leftover — both deletable.

---

## Sequencing note

P1-2 (`AppShell`), P1-4 (`MetricCard`), and P1-5 (`ChartCard`) are **prerequisites for
the aesthetic redesign** (see `AESTHETIC_REDESIGN.md`): extract first, restyle once.
P1-1 (embed migration) and P1-3 (code-splitting) are independent and can land before
or after the restyle. P2–P4 are safe piecemeal commits any time.

Estimated net effect: **≈1,800–2,200 lines removed**, initial JS payload roughly
halved, live canvas count halved, lint to zero.
