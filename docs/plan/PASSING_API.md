# Passing API — Evaluation & Integration Plan

> **Status: proposal** (2026-09-04, on `claude/passing-api-integration-2bqnoq`).
> Nothing is built yet. The plan has a Phase 0 spike that must run against a
> live `CFB_API_KEY` before any chart work starts — this session could not reach
> `api.collegefootballdata.com`, so every schema fact below comes from the
> published `cfbd` client packages (npm and PyPI `5.26.0`, released 2026-09-03),
> not from live responses. Coverage by season is the big unknown.

---

_Visual version of this plan, with chart sketches:_
**https://claude.ai/code/artifact/af7f1810-6e37-49a9-b633-21b2623cfe03**

## The short version

- "The passing API" is five routes, not one. `/passing/plays` is the one that
  changes what we can chart; the other four are pre-aggregated conveniences.
- It slots into the existing pipeline cleanly. Every pass row carries `playId`,
  so it joins onto the `/plays` data every chart already runs on. Team-season
  data comes back in **one call**, which makes it the first season-level source
  that needs no per-game fan-out.
- It adds three things the site cannot compute today: **air yards / depth of
  target**, **yards after catch**, and **where the ball went** (six field zones).
  It also gives real passer and target IDs, which would retire the regex that
  scrapes names out of play text.
- It does **not** carry PPA, success, touchdowns, sacks, pressures or drops. Success
  and explosiveness come from our own join to `/plays`, same as everything else.
- Recommendation: run the spike, then ship three Games charts, three Trends charts
  and two Discover detectors that extend the SR/XR idiom, and only then build the
  genuinely new spatial charts (target-zone grid, pass stems, field target map).
- The rushing family (`/rushing/*`) shipped three days later with the same shape
  **plus** PPA, success and line/second-level/open-field yards. Whatever service
  layer we build for passing should be written so rushing is a copy, not a rewrite.

---

## What the endpoint actually is

Five routes under `/passing`, all `GET`, all behind the same key. `classification`
defaults to `fbs` on every one, so FCS teams need it passed explicitly.

| Route | Required | Useful filters | Returns |
|---|---|---|---|
| `/passing/plays` | `year` + (`team` or `week`) | `gameId`, `offense`, `defense`, `passerId`, `targetId`, `outcome`, `seasonType` | one row per pass attempt (`PassingPlay[]`) |
| `/passing/players/games` | `year` + (`team`, `week` or `passerId`) | `conference` | one row per passer per game |
| `/passing/players/season` | `year` or `passerId` | `team`, `conference` | one row per passer per season |
| `/passing/teams/games` | `year` + (`team` or `week`) | `conference` | one row per team per game, with `offense` and `defense` blocks |
| `/passing/teams/season` | `year` or `team` | `conference` | one row per team per season, `offense` + `defense` |

### `PassingPlay` — the row that matters

| Field | Type | Notes |
|---|---|---|
| `gameId`, `playId`, `driveId` | number / string / string | `playId` is the join key to `/plays` (`ApiPlayData.id`, already stored as a string) |
| `season`, `week`, `seasonType` | | |
| `offense`, `offenseId`, `defense`, `defenseId`, conferences | | team names match the `/games` strings we already use |
| `period`, `clock{minutes,seconds}`, `down`, `distance` | | |
| `startYardline`, `startYardsToGoal` | number | |
| `playText` | string \| null | |
| `passerId`, `passer`, `targetId`, `target` | string \| null | full names, not the `T.Simpson` form our charts key on |
| `outcome` | `'completion' \| 'incompletion' \| 'interception'` | |
| `airYards` | number \| null | distance from the line of scrimmage to the target |
| `passDepth` | `'short' \| 'deep'` \| null | |
| `passDirection` | `'left' \| 'middle' \| 'right'` \| null | |
| `passLocation` | six zones (`'short left'` … `'deep right'`) \| null | direction × depth |
| `targetYardsToGoal` | number \| null | where on the field the target was — enough for a field diagram |
| `totalYards`, `yardsAfterCatch` | number \| null | `totalYards − airYards` on completions |
| `isSpike`, `isThrowaway`, `isIntentionalGrounding` | boolean | exclude from depth and location charts |
| `parseStatus` | `'complete' \| 'partial' \| 'invalid'` | drop `invalid`; report coverage |

### `PassingProduction` — the aggregate block

Used verbatim by the player-game, player-season, team-game (`offense`/`defense`)
and team-season rows: `attempts`, `completions`, `incompletions`, `interceptions`,
`completionRate`, `totalAirYards`, `averageDepthOfTarget`, `totalYards`,
`totalYardsAfterCatch`, `averageYardsAfterCatch`, **plus three coverage counts**:
`airYardsAttemptsAvailable`, `totalYardsAttemptsAvailable`,
`yardsAfterCatchAttemptsAvailable`. Those counts are the API telling us that some
attempts have no depth data. Every rate we show has to use them as the
denominator, and every chart subtitle should say what the coverage was.

---

## What it gives us that the site cannot compute today

Today's only passing treatment is derived from `play_text`: `extractPlayerNames`
(`src/utils/metrics.ts:191-281`) regex-scrapes passer and receiver names,
`calculatePlayerStats` (`metrics.ts:466-580`) buckets their plays into
explosive / successful / other / incomplete / interception, and
`aggregateSeasonPlayerStats` (`src/utils/seasonPlayerStats.ts`) does the same
across a season. The box score reads `completionAttempts` as a raw `"17-28"`
string it never parses (`src/hooks/useBoxScore.ts:264`). Nothing reads air yards,
YAC, targets, or location, because nothing could.

| New capability | Why it matters for our analyses |
|---|---|
| Depth of target (air yards, aDOT, short/deep) | Success rate is blind to *how* a pass succeeded. A 6-yard completion on 3rd-and-5 and a 30-yard shot are both "successful"; depth is the missing axis for every SR/XR split we run. |
| Yards after catch | Separates the quarterback's contribution from the receiver's. YAC share of passing yards is a scheme signature (screens and RPOs vs. downfield). |
| Target location (six zones, plus `targetYardsToGoal`) | Our first spatial dimension. Everything on the site today is indexed by time (play number, drive, quarter) or category (down, distance, red zone). |
| Passer / target identity by ID | Incompletions and interceptions finally attribute to the intended receiver, so "Top receivers" becomes a targets chart instead of a catches chart. Retires ~90 lines of regex. |
| Passing **defense** (the `defense` block on team rows) | Depth allowed, completion rate allowed and YAC allowed per game, without deriving anything from opponent play-by-play. |

## What it lacks (and where we get it instead)

| Missing | Source |
|---|---|
| Success, explosiveness, PPA on the attempt | join to `/plays` on `playId`; our `calculateSuccess` / `calculateExplosiveness` apply unchanged |
| Touchdowns | `/plays` `play_type` (`Passing Touchdown`) via the same join |
| Sacks | not attempts here; they stay in our "pass play" bucket from `/plays`. Any chart that mixes the two must say its denominator is *attempts* |
| Pressures, drops, time to throw | not in this release; don't design for them |

---

## How it fits the pipeline

**Proxy: no change.** `${API_BASE_URL}/passing/plays?…` passes through
`api/cfbd.js` and the Vite proxy untouched.

**Service:** a new `src/services/passingApi.ts` (keep `api.ts` from growing)
exporting typed fetchers for the three routes we'd use:

```ts
fetchPassingPlays({ year, team, gameId? })        // one call per game, or per team-season
fetchTeamPassingByGame({ year, team })            // offense + defense blocks, whole season
fetchPlayerPassingByGame({ year, team })          // per passer per game, whole season
```

Wrap each in `cachedFetch` with the `games:` precedent: `passing:plays:{year}:{team}`
at a 1-hour TTL in season (24 h is fine for completed seasons, but one TTL keeps
it simple). A full team-season of attempts is on the order of 400–500 rows, so
localStorage cost is comparable to a cached schedule.

**Join:** a new `src/utils/passing.ts`:

```ts
joinPassingToPlays(plays: PlayData[], passes: PassingPlay[]): PassPlay[]
// PassPlay = PlayData & { air, yac, depth, direction, location, outcome, passerId, targetId, … }
```

keyed on `String(play.id) === pass.playId`. Rows with `parseStatus === 'invalid'`
are dropped; spikes, throwaways and intentional grounding are kept for attempt
counts but excluded from depth/location aggregates. The helper also returns a
`coverage` object (`{ attempts, matched, withAirYards, withLocation }`) that
every new chart's subtitle reads from. Charts hide themselves below a coverage
floor (proposal: 60% of attempts with air yards) rather than plotting a
misleading partial.

**Games page:** one more request alongside `/plays` and `/metrics/wp` in
`Dashboard.tsx:174-183`. Nothing else in the hook chain changes; new chart data
keys go in `useChartData` next to the existing ones.

**Trends:** this is the nice part. `fetchPassingPlays({ year, team })` returns the
whole season in one call, and so do the team-game and player-game routes.
No `mapWithConcurrency` fan-out; filter to `selectedGameIds` client-side.
Do the same for the box score's passing rows eventually (the `/passing/teams/games`
response is a better source than parsing `"17-28"`).

**Team vs. Team:** two team-season calls, fed through `useCompareChartData` under
the same keys as `useSeasonChartData` so `TrendsChartsGrid` renders both.

**Discover:** the season routes with `year` only return every FBS passer or team
in one call — the shape `topPlayerPPA.ts` already handles. One `cachedFetch` per
year, 24 h.

**Colors, options, embeds — the one rule.** New charts take their triples from
`getDisplayTeamColors` / `getDisplayTeamColorsForPlayerChart` and reuse the
existing option factories where the shape matches (`createBarOptions` for the
category bars, `createPlayerOptions` for stacked player bars,
`lineChartOptionsWithRotatedLabels` for per-game lines). Where a new shape needs
its own options (pass stems, zone grid, histogram), they go in a **new**
`src/utils/passingChartOptions.ts`. `chartOptions.ts`, `chartHelpers.ts`,
`chartConfig.ts` and `chartDimensions.ts` are not edited. Every callback stored
on data or options stays closure-free so `generateChartEmbed` can serialize it.
New Trends charts should register through the generic embed engine rather than
`trendsEmbedGenerator.ts`, which is the direction `CODE_REVIEW.md` already set.

**Definitions panel:** add air yards, depth of target, YAC, target zone and the
attempts-vs-pass-plays distinction to `definitionsFor()` in `ChartsGrid.tsx`.

---

## Charts — Games page

Listed in the order they'd ship. A–C extend idioms the site already has; D and E
are new visual forms and are discussed under "Novel" below.

### A. SR and XR by pass depth _(bar; extends the by-category bars)_

Short / deep on the x-axis, team vs. opponent grouped-stacked SR+XR exactly like
`SR and XR by down`. Built with `createTeamVsOpponentBarData` over the joined
`PassPlay[]` with `'depth'` as the category. Optional second variant with the six
zones as categories. Zero new vocabulary; it is the single most useful chart
because it answers "did the deep shots work?" in the language the site already
speaks.

### B. Air yards and YAC by passer, and by receiver _(horizontal stacked bar; extends the player charts)_

Two segments per player — air yards on completions, then YAC — with attempts and
completion rate in the datalabel. Uses `createPlayerOptions` and the player-chart
color triple (`success` for air, `explosive` for YAC, `light` for air yards on
incompletions if we want to show "yards attempted"). Keys by `passerId` /
`targetId`, which is also the moment to make the existing `Top passers` and
`Top receivers` charts read identity from the endpoint and fall back to the
regex only when the join misses. Receivers gain a **targets** bar (incomplete
targets attributed to the intended receiver for the first time).

### C. Pass stems _(line-with-points over play number; grows out of the play map)_

Same x-axis as `Play map` (team play number), y = yards. Each attempt is a point
at its air yards: filled for a completion, hollow for an incompletion, an X for
an interception. Completions grow a thin vertical stem from air yards up to
total yards, so YAC is literally the length of the stem. Quarter gridlines from
`createTeamQuarterGridlines`. Point colors from `getPointColors` so
explosive/successful/unsuccessful reads the same as everywhere else. One chart
per team, like the play maps.

### D. Depth of target distribution _(mirrored histogram — new form)_

Air-yards bins (behind LOS, 0–4, 5–9, 10–14, 15–19, 20+) on the x-axis, team
bars up and opponent bars down from a shared baseline, completion rate per bin as
the datalabel. Our first distribution chart. Plain `bar` chart with negative
values for the opponent side and a `percentCallback`-style tick formatter that
shows absolute values.

### E. Target zone grid _(3 × 2 field grid — new form, custom SVG)_

Left / middle / right across, deep over short down, oriented like the offense
looking downfield. Each cell shows attempts, and its fill is a single-hue ramp
on success rate (or completion rate, toggle). Team and opponent side by side.
Chart.js has no matrix type without a plugin; the site already has a precedent
for a hand-drawn SVG chart in `GameWaveChart.tsx`, and a 6-cell grid is far
simpler than the wave. Embed: emit the SVG as static markup through a small
template, the way `boxScoreEmbed.ts` emits a table.

---

## Charts — Season trends

### F. Depth of target (each game) _(line; extends the per-game lines)_

aDOT thrown (team) and aDOT allowed (opponent, from the `defense` block) per
game, on the rotated-label line options. Source: `/passing/teams/games` — one call.
Same look as `SR and XR by Team (each game)`; y-axis in yards, not percent, so it
needs its own axis config (new file).

### G. Passing yards anatomy (each game) _(stacked bar — composition over time)_

Per game, air yards on completions stacked under YAC, so the bar height is
passing yards and the split is the scheme signature. Opponent-allowed as the
usual grey. This is the chart that shows a screen-heavy offense at a glance.

### H. SR and XR by pass depth _(season bar)_

Chart A aggregated over the selected games. Slots straight into the existing
by-category row on `TrendsChartsGrid`.

### I. Top receivers by targets _(season player bars — upgrade)_

Replace catches-only with targets: explosive / successful / other catches /
incomplete targets / interceptions on targets, keyed by `targetId`. Top passers
gains aDOT and completion rate in the label.

### J. Completion rate and YAC share (each game) _(line)_

Both are percentages, so they share one 0–100% axis without breaking the one-axis
rule. Optional; ship if F and G leave room.

**Housekeeping that comes with it:** the Trends grid still hard-codes each card
(`TrendsChartsGrid.tsx:161-224`, 400px, `rounded-xl`, `shadow-sm`). New charts
should go through `ChartCard` and a spec array like the Games grid rather than
copying that block a sixth time — do it for the new charts and leave the existing
markup alone unless asked.

## Team vs. Team

Everything above with both teams in their own colors: F as two lines, G as
grouped stacks per game slot, H grouped, and the zone grid side by side. Single
game selections switch to grouped columns the way `barCompare()` already does.

## Discover detectors

Both follow `havocVsSP.ts` (scatter with a `searchable` field) and
`topPlayerPPA.ts` (per-player labels colored by team).

### K. Aggressive vs. accurate _(scatter, searchable)_

x = aDOT, y = completion rate, one point per FBS passer with ≥ 100 attempts, from
`/passing/players/season?year=`. Quadrants label themselves: high-depth
high-completion is the headline. Point color per team via `getDisplayTeamColors`.

### L. YAC-dependent offenses _(bar)_

YAC share of passing yards per team from `/passing/teams/season?year=`, top and
bottom 15. Subtext names the aDOT so the reader sees the tradeoff. A defensive
mirror (`YAC allowed share`) is a one-line variant.

---

## Novel visualizations, ranked by how far they are from what we draw today

1. **Target zone grid (E).** First positional chart on the site. Six cells, one
   hue ramp, attempts as the number, success as the color. Reads in two seconds.
2. **Field target map.** `targetYardsToGoal` × `passDirection` puts every target
   on a field diagram (SVG, like the wave chart), colored by outcome, sized by
   YAC. Red-zone passing finally becomes a picture instead of a bar. Ship after E
   proves the SVG-embed path.
3. **Pass stems (C).** Air yards and YAC per attempt, in time order, in the play
   map's frame. The closest thing to a "passing chart" that still looks like us.
4. **Mirrored depth histogram (D).** Distribution instead of rate; team above,
   opponent below.
5. **Yards anatomy stacks (G).** Composition over the season. Least novel, most
   likely to get embedded.

Deliberately not proposed: any dual-axis chart (aDOT + completion rate), a QB
"grade" composite, or restyling of existing charts.

---

## Phasing

**Phase 0 — Spike (half a day, needs a live key).** A script under
`scripts/` that pulls `/passing/plays?year=&team=` for three seasons and two
teams (say 2023–2025, Alabama and a Group of Five team) and reports, per season:
attempts, `parseStatus` split, share with `airYards`, `passLocation`,
`yardsAfterCatch`; whether sacks appear; whether `passer` names line up with
what `extractPlayerNames` produces; FCS behaviour with and without
`classification=fcs`; response bytes. **Gate:** ≥ 80% air-yards coverage for
2024 and 2025. Record the numbers at the top of this doc.

**Phase 1 — Plumbing + Games (A, B, C).** `passingApi.ts`, types, `passing.ts`
join, cache keys, `definitionsFor` entries, embeds through the generic engine,
and the identity swap in the existing player charts with regex fallback.

**Phase 2 — Trends (F, G, H, I).** Single-call season fetch, `ChartCard`-based
cards for the new charts, generic embeds.

**Phase 3 — Compare + Discover (K, L).**

**Phase 4 — Novel (E, field map, D).** SVG components with a static-markup embed
template.

**After:** `/rushing/*` on the same service shape. It already carries PPA and
success, so it needs no join for those, and its direction/line-yards fields map
onto E's grid and G's stacks almost one-for-one.

---

## Risks and open questions

- **Season coverage.** Air yards and location are charting-derived and may exist
  only for recent seasons. The spike decides; the coverage floor keeps old
  seasons from drawing empty charts.
- **Denominators.** Attempts (this API) ≠ pass plays (ours, which include sacks).
  Every mixed chart states which it uses. Aggregates may or may not exclude
  spikes and throwaways — verify in the spike, and if not, compute aDOT ourselves
  from the play rows.
- **Identity mapping.** Player charts key on `T.Simpson`-style names; the endpoint
  gives full names and IDs. The join is by `playId`, so the mapping is
  implicit, but a player who both rushes and passes still needs one label across
  the rusher (regex) and passer (ID) charts until rushing lands.
- **Quota.** One extra call per game view and one per season load. Cheap, and
  cached by the proxy for five minutes and by localStorage for an hour.
- **SVG embeds.** `GameWaveChart` has no embed button. E and the field map need
  the static-markup path before they can be copied.
- **Trends grid debt.** New cards via `ChartCard` while old ones stay hand-coded
  means two idioms side by side for a while.

## DECISION

_(to be filled in by Alex after the Phase 0 spike)_
