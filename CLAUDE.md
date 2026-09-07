# Project guide — graphingcollegefootball.com

Advanced college football analytics: play-by-play charts, season trends, SP+
ratings, and auto-surfaced storylines. React + TypeScript + Vite + Tailwind,
Chart.js for every visualization, deployed on Vercel.

> Pending work lives in [`TODO.md`](./TODO.md). Design and review plans live in
> [`docs/plan/`](./docs/plan/).

## The one rule that matters

**The visualizations are the product.** Chart datasets, options, colors,
datalabels, legends, reference lines and heights are deliberately designed —
do not restyle them as a side effect of other work. Specifically off-limits
without an explicit ask:

- `src/utils/teamColors.ts`, `colorPalette.ts`, `displayTeamColors.ts` (values)
- `src/utils/chartConfig.ts` defaults, `chartOptions.ts`, `chartHelpers.ts`
- `src/constants/chartDimensions.ts`
- Charts always render on a white canvas.

The site is **light-only by design**. Dark chrome behind a white chart canvas
is too high contrast — there is no dark theme and no `prefers-color-scheme`
variant. Don't add one.

## Structure

```
src/
  App.tsx              pathname router; each page is React.lazy'd into its own chunk
  components/
    AppShell.tsx       masthead, nav, footer, About/Contact modals — every page wraps in this
    ChartCard.tsx      the white plate a chart sits on (title, embed button, one responsive canvas)
    MetricCard.tsx     ruled stat columns + MetricRow
    SubTabs.tsx        within-page view switcher (Trends, Discover)
    Dashboard.tsx      /games
    RatingsPage.tsx    /ratings
    TeamTrendsPage.tsx /trends  (season trends, Team vs. Team, multi-year SP+)
    DiscoverPage.tsx   /discover
    ChartsGrid.tsx     the Games chart grid
    TrendsChartsGrid.tsx  the season-trends chart grid
  hooks/               useChartData, useSeasonChartData, useCompareChartData, useBoxScore, useToast
  services/            api.ts (CFBD via the /api/cfbd proxy), boxScoreApi, ratingsApi, seasonApi
  detectors/           Discover storyline detectors + registry
  utils/               chart helpers, metrics, embed generators, accent, playType, analytics
```

### Design system

Tokens live in `tailwind.config.js` and `src/index.css`. The Tailwind `neutral`
scale is **remapped to a warm paper/ink palette**, so `neutral-*` utilities
across the app carry the design; radii collapse toward 4px and card-weight
shadows are neutralized (structure comes from hairlines).

- `bg-paper` ground, `bg-surface` (white) for plates, `text-ink`, `text-byline`
- `.plate` — bordered white card; `.btn-ink` — primary action (disabled becomes
  an outlined ghost, never a gray fill); `.chart-box` — responsive chart height
- `--accent` is the **selected team's color** at runtime (`src/utils/accent.ts`,
  with a luminance clamp so pale golds stay legible); crimson is the default.
- Type is Inter Tight, self-hosted via `@fontsource-variable/inter-tight`.
  Sentence case everywhere — no all-caps or letterspaced labels.

### Embeds

`src/utils/chartEmbedGenerator.ts` is the generic engine: hand it the exact
data + options a chart renders with and it emits self-contained HTML. Callbacks
that close over local data are "baked" at copy time, so **any function stored on
chart data/options must be closure-free** (arguments and globals only) or it
won't survive serialization. `trendsEmbedGenerator.ts` and `boxScoreEmbed.ts`
are older bespoke templates still used by the season-trends and box-score paths.

**Never load Chart.js from a static `<script src>` tag in an embed.** Both
generators inject it from inline JS via `embedChartLoader.ts`, sequentially,
because WordPress performance plugins rewrite script tags — adding `async`, or
parking the URL on a `data-*` attribute. The datalabels UMD bundle reads
`window.Chart` the moment it executes, so any reordering leaves it undefined
and every chart on the page dies with "Chart library failed to load." Embeds
still render in Gutenberg's sandboxed block preview when this is broken, so it
only shows up once published.

## Commands

```bash
npm run dev      # vite dev server (proxies /api/cfbd with CFB_API_KEY from .env)
npm run build    # production build
npm run lint     # eslint
npx tsc --noEmit -p tsconfig.app.json   # typecheck (build does not typecheck)
```

A `CFB_API_KEY` in `.env` is required for live data; it stays server-side via
the `/api/cfbd` proxy (`api/cfbd.js` in production, the Vite proxy locally).

## Git workflow

**Do NOT push to `main` without explicit approval.** Commit locally, then ask
before pushing or deploying — the user reviews changes before they go live.

## Code review

**Greptile is the only code reviewer.** Trigger it with a `@greptile review`
comment on the PR and iterate to a 5/5 score. **CodeRabbit is disabled** — don't
trigger it or wait on its reviews.
