# Aesthetic Redesign — Directions & Implementation Plan

_Companion to [`CODE_REVIEW.md`](./CODE_REVIEW.md). Visual mockups of everything below:_
**https://claude.ai/code/artifact/66b79366-b191-429b-8f3c-fa52d9232119**

## The brief

The charts are the product and are **out of scope for restyling** — every color,
stack, datalabel pill, reference line, legend, and height stays exactly as designed.
The rebuild targets the chrome: typography, color, surfaces, controls, and states.
The current look is stock Tailwind (system font, cool grays, `rounded-2xl` +
`shadow-sm` cards on a gray gradient, gray-on-gray nav states, default blue focus
rings) — competent and anonymous.

### Hard no-touch list

- `teamColors.ts` / `colorPalette.ts` / `displayTeamColors.ts` values
- Chart.js datasets, options, datalabel styling, legends, tooltips
- `chartConfig.ts` defaults (`#26262660` pills, tension, point radii …)
- Chart container heights (`chartDimensions.ts`) and the 2-col chart grid
- Embed generator output (ships its own scoped styles)
- White chart canvas — charts always render on white, in every direction

One **opt-in** exception, decided by Alex at implementation time: setting
`ChartJS.defaults.font.family` to the new UI font (one line in `chartConfig.ts`,
trivially reversible). Default is OFF — charts keep Chart.js's Helvetica stack.

---

## The three directions

Same structure and density in all three; the mocks in the artifact render identical
chart markup so only the frame varies.

### A · Press Box — the site becomes a publication _(recommended)_

The site of an analyst who writes. Warm paper, ink, hairline rules; charts sit like
printed figures. Zero shadows, zero gradients.

| Token | Value |
|---|---|
| Paper / surface | `#FBFAF7` / `#FFFFFF` |
| Ink / byline | `#1C1917` / `#78716C` |
| Hairline | `#E5E1DB` (structural rules `#1C1917`) |
| Accent | selected team's color; `#8E2434` crimson as no-team default |
| Radius | 4px |
| Type | **Inter Tight** (800 display, 500 UI, 700 tabular numerals) + Geist Mono or similar for kickers/datelines |

Signature moves: masthead wordmark over a double rule; nav = text tabs with 2px
accent underline; small-caps mono kickers ("2025 · WEEK 8 · NEYLAND STADIUM");
stat tiles become **ruled columns** (no boxes) under a heavy rule; score numerals in
team colors in the matchup headline; selector fields squared with small-caps labels;
solid-ink CTA. Effort **M**. Risk: reads quiet.

### B · Film Room — dark chrome, charts as lit screens

Projection-room slate, condensed broadcast caps, scoreboard mono numerals, one
telestrator-yellow accent used in exactly three places (wordmark tick, active tab,
CTA). Charts keep their white canvas = the brightest objects on the page.

| Token | Value |
|---|---|
| Room / panel | `#12151A` / `#171B21` |
| Text / secondary | `#E9ECF0` / `#8E99A6` |
| Line | `#2A313B` |
| Accent | `#F5C84C` telestrator yellow (fixed) |
| Team color | tile stripe + score numerals only (lightened for dark bg) |
| Radius | 8px |
| Type | **Barlow Condensed** (display caps) + **Barlow** (UI) + **IBM Plex Mono** (numerals) |

Effort **M+** (dark QA on modals, tables, toasts, box scores). Risk: high-contrast
"mode" look; boldest, most sports-native.

### C · Front Office — precision tool, accented by the team

Modern ops product: cool-neutral ground, crisp 1px borders, segmented nav with a
true white active pill, mono digits. The personality is the **team-accent system**:
`--team` drives CTA, focus rings, and active states.

| Token | Value |
|---|---|
| Ground / surface | `#F7F8FA` / `#FFFFFF` |
| Ink / secondary | `#17191C` / `#5C6470` |
| Border | `#E4E7EB` |
| Accent | `var(--team)` from the CFBD team record; ink monochrome before selection |
| Radius | 10px |
| Type | **Geist** (UI) + **Geist Mono** (data) |

Effort **S–M**. Risk: generic without the team accent — the accent is mandatory here.

---

## Cross-cutting system (ships with any direction)

- **Fonts self-hosted** via `@fontsource/*` packages imported in `main.tsx` — no
  CDN request, no layout shift, works offline.
- **Tokens** as CSS custom properties + `tailwind.config.js` `theme.extend`
  (colors, radius, shadow, font families). Components consume tokens only.
- **Team-accent variable** (A: editorial accent · B: stripes · C: whole interactive
  layer): on team select, set `--team` / `--team-soft` from the CFBD `Team.color`
  already fetched (with an HSL lightness clamp for pale golds). Persist through the
  existing color-override URL params.
- **States**: one focus-visible ring style (accent-colored, not default blue);
  disabled = reduced opacity + cursor, never a twin gray; loading skeletons shaped
  like the final layout; empty states redrawn smaller and typographic; error
  banners tokenized.
- **Numerals**: `font-variant-numeric: tabular-nums` (A) or mono (B/C) wherever
  digits stack — tiles, box-score tables, play tables.
- **Micro-interactions**: ≤150 ms color/border transitions; `prefers-reduced-motion`
  respected; no entrance animations.
- **Favicon/OG pass** at the end so shared links match the new identity.

## Phasing (for the implementation session)

Phase 0 depends on three CODE_REVIEW items — extract before restyling so every
later phase touches one file, not four pages:

- **Phase 0 — Foundations.** `AppShell` (P1-2), `MetricCard` (P1-4), `ChartCard`
  (P1-5) extractions; install fonts; add tokens. _No visual change yet; screenshots
  prove parity._
- **Phase 1 — Chrome.** Header/wordmark, nav, footer, info+contact modals in the
  chosen direction. All four pages inherit via AppShell.
- **Phase 2 — Controls.** GameSelector, SeasonSelector, sub-tab pills
  (Trends/Ratings), TeamFilterDropdown, color-override pickers, CTA buttons.
- **Phase 3 — Content surfaces.** ChartCard frame, stat tiles, box-score tables,
  Discover cards, data-definition accordions, Toast, empty/loading/error states.
- **Phase 4 — Polish.** Focus/hover audit, responsive audit (390 px), favicon/OG,
  optional team-accent system, optional chart font alignment (default off).

Each phase is an isolated commit with before/after screenshots on the branch —
main untouched until Alex approves.

## DECISION (made by Alex, 2026-02-05)

**Build A · Press Box, amended with C's text treatment. No all-caps anywhere.**

What that means concretely — this amendment overrides the A spec above wherever
they conflict:

- **Keep from A:** warm paper `#FBFAF7`, ink, hairline rules, zero
  shadows/gradients, 4px radii, masthead + double rule, underline nav tabs,
  ruled stat columns (no boxes), charts as white plates, team-color accent with
  crimson default, solid-ink CTA.
- **Drop from A:** every uppercase / small-caps / letterspaced treatment — the
  mono kickers, tile labels, datelines, and selector field labels are **not**
  uppercased.
- **Adopt from C:** sentence-case labels and meta text styled like Front
  Office's — quiet 12–13px medium weight in byline gray (`#78716C`), e.g.
  "Success rate", "2025 · Week 8 · Neyland Stadium". Meta rows may use C's
  subtle chip treatment where it earns its keep.
- **Numerals:** tabular figures for big stats (Inter Tight `tnum`); the B-style
  mono digits are optional and only if they read well without uppercase labels
  around them.
- **Faces:** Inter Tight for display + headings stays. For body/UI text, start
  with Inter Tight at sentence case; if it still reads too editorial, Geist for
  UI text (C's face) with Inter Tight reserved for display is the sanctioned
  fallback — decide by eye during Phase 1 with screenshots.

**No dark mode — light-only site (Alex, 2026-02-05).** The charts render on
white by design, and dark surrounds behind white chart canvases are too high
contrast. Do not ship a dark theme, a `prefers-color-scheme: dark` variant, or
dark chrome of any kind — this formally retires Direction B, and no "dark mode
later" hooks should be added. The paper background is the one and only ground.

Rationale trail: A harmonizes best with white-canvas charts; the caps-heavy
apparatus was the part of A rejected as too costumey; dark chrome was rejected
for contrast against the white chart canvas. B and C remain documented above
for reference only.
