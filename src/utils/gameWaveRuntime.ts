export type WaveSide = 'top' | 'bottom';
export type WaveOutcome = 'explosive' | 'success' | 'other' | 'fieldGoal' | 'fumble';

/** A play (or scoring/turnover event) before it's binned into a clock column. */
export interface WaveEvent {
  side: WaveSide;
  quarter: number;
  minutes: number;
  seconds: number;
  outcome: WaveOutcome;
  label: string | null; // text drawn inside the dot: points ('6'–'8', '3'), or 'i' / 'f'
  isScore: boolean;
  playText: string;
  yardsGained: number;
  down: number;
  distance: number;
}

/** An event once it has a column and a place in that column's stack. */
export interface WavePoint extends WaveEvent {
  column: number; // 0-based time bin
  position: number; // stack distance from the center line, 1-based
}

export interface GameWaveModel {
  points: WavePoint[];
  columnCount: number;
  segmentsPerQuarter: number;
  regulationQuarters: number;
  topMax: number;
  bottomMax: number;
  hasOvertime: boolean;
}

/** The three shades a team's dots are drawn in (from `getDisplayTeamColors`). */
export interface WaveShadeColors {
  explosive: string;
  success: string;
  light: string;
}

export interface WaveMark {
  x: number;
  label: string;
}

export interface WaveGeometry {
  xOf: (column: number) => number;
  yOf: (point: WavePoint) => number;
  vbWidth: number;
  vbHeight: number;
  centerY: number;
  labelY: number;
  minuteLabelY: number;
  quarterMarks: WaveMark[];
  minuteMarks: WaveMark[];
  dividers: number[];
}

export interface WaveSvgSpec {
  model: GameWaveModel;
  geometry: WaveGeometry;
  team: string;
  opponent: string;
  topColors: WaveShadeColors;
  bottomColors: WaveShadeColors;
}

/** What `bindTooltip` needs: where the dots live, where to draw, and how to look a dot up. */
export interface WaveTooltipSpec {
  /** Element containing the wave's SVG; the tooltip is positioned inside it. */
  host: HTMLElement;
  /** Empty element the tooltip draws into, a child of `host`. */
  tooltip: HTMLElement;
  /** The point a dot's `data-point` index refers to in the current model. */
  pointAt: (index: number) => WavePoint | undefined;
  team: string;
  opponent: string;
}

export type WaveRuntime = ReturnType<typeof createWaveRuntime>;

/**
 * Everything the Game Wave needs at render time: how wide a bin should be, how
 * plays stack inside it, where each dot lands, and how to draw the whole thing
 * as SVG with a tooltip on every dot.
 *
 * It is one self-contained closure on purpose. The embed generator ships this
 * function's OWN SOURCE (`Function.prototype.toString`) inside the copied HTML,
 * so a pasted chart re-bins itself in its container using the very code the
 * page runs — the two can't drift apart, because there is only one of them.
 *
 * That puts two rules on everything below:
 *
 * 1. No references out of this closure. Not an import, not a module constant —
 *    the bundler renames those, and the renamed name means nothing inside the
 *    emitted copy. Arguments, locals and true globals only. (Types are fine:
 *    they're erased before any of this becomes a string.)
 * 2. No syntax the build might down-compile into a helper call — object/array
 *    spread, async/await, class fields. The helper would be defined outside
 *    this function and the copy would throw. `Object.assign` and `concat` do
 *    the same jobs as plain runtime calls.
 */
export const createWaveRuntime = () => {
  const QUARTER_MINUTES = 15;
  const REGULATION_QUARTERS = 4;
  // Default clock tranches per quarter (~2.1 min each), used until a width is
  // known. The chart picks a finer or coarser value once it can measure.
  const DEFAULT_SEGMENTS_PER_QUARTER = 7;

  // Responsive time-binning. As the chart area gets wider we subdivide each
  // quarter into more (finer) clock tranches so the wave fills the horizontal
  // space and the stacks flatten out, rather than blowing the dots up huge.
  // Candidates run from 3/quarter (~5 min bins) to 15/quarter (~1 min bins).
  const SEGMENT_CANDIDATES = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
  const MIN_CELL_PX = 18; // don't let a single dot cell render narrower than this
  const MIN_PLAYS_PER_CELL = 0.9; // and don't subdivide so far the wave goes sparse/flat

  // Geometry, in viewBox units where 1 unit = one dot cell.
  const DOT_R = 0.4;
  const QUARTER_GAP = 0.7;
  const LABEL_BAND = 1.9;
  const RIGHT_PAD = 0.6;
  // Half-height of the central axis lane reserved for the minute labels; the
  // two teams' dots stack above and below it (never into it).
  const AXIS_HALF = 0.625;

  const palette = {
    // Quarter dividers, matching the warm hairline used by card borders.
    grid: '#E5E1DB',
    minuteLabel: '#A8A29B',
    quarterLabel: '#737373',
    dotLabel: '#374151',
    scoreLabel: '#ffffff',
    dotStroke: '#ffffff',
  };

  // Dot tooltips wear Chart.js 4's default tooltip look, so hovering the wave
  // reads like hovering any other chart on the site: translucent black, the
  // 12px Helvetica stack, a bold title, and a caret pointing at the dot.
  const TOOLTIP = {
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    fontSize: 12,
    lineHeight: 1.2,
    padding: 6,
    radius: 6,
    caret: 5,
    caretPadding: 2,
    titleMarginBottom: 6,
    maxWidth: 280,
  };

  const OUTCOME_LABELS: Record<WaveOutcome, string> = {
    explosive: 'Explosive',
    fieldGoal: 'Field goal',
    fumble: 'Fumble lost',
    success: 'Successful',
    other: 'Unsuccessful',
  };

  const segmentIndex = (minutes: number, seconds: number, segmentsPerQuarter: number): number => {
    const segmentMinutes = QUARTER_MINUTES / segmentsPerQuarter;
    const elapsed = QUARTER_MINUTES - (minutes + seconds / 60);
    const idx = Math.floor(elapsed / segmentMinutes);
    return Math.max(0, Math.min(segmentsPerQuarter - 1, idx));
  };

  const columnFor = (quarter: number, minutes: number, seconds: number, segmentsPerQuarter: number): number => {
    const otColumn = REGULATION_QUARTERS * segmentsPerQuarter;
    if (quarter > REGULATION_QUARTERS) return otColumn;
    const q = Math.max(1, Math.min(REGULATION_QUARTERS, quarter));
    return (q - 1) * segmentsPerQuarter + segmentIndex(minutes, seconds, segmentsPerQuarter);
  };

  // Lower rank sits closer to the center line: explosive/scoring, then
  // successful, then unsuccessful.
  const rankOf = (outcome: WaveOutcome, isScore: boolean): number => {
    if (isScore || outcome === 'explosive' || outcome === 'fieldGoal') return 0;
    if (outcome === 'success') return 1;
    return 2;
  };

  /** Bin events by game clock, then stack each bin outward from the axis. */
  const buildModel = (events: WaveEvent[], segmentsPerQuarter: number): GameWaveModel => {
    const otColumn = REGULATION_QUARTERS * segmentsPerQuarter;
    const entries: { event: WaveEvent; column: number; seq: number }[] = [];
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      entries.push({
        event,
        column: columnFor(event.quarter, event.minutes, event.seconds, segmentsPerQuarter),
        seq: i,
      });
    }

    let hasOvertime = false;
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].column === otColumn) hasOvertime = true;
    }
    const columnCount = otColumn + (hasOvertime ? 1 : 0);

    const groups = new Map<string, typeof entries>();
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const key = entry.event.side + ':' + entry.column;
      const group = groups.get(key);
      if (group) group.push(entry);
      else groups.set(key, [entry]);
    }

    const points: WavePoint[] = [];
    let topMax = 0;
    let bottomMax = 0;

    groups.forEach(group => {
      group.sort(
        (a, b) =>
          rankOf(a.event.outcome, a.event.isScore) - rankOf(b.event.outcome, b.event.isScore) || a.seq - b.seq,
      );
      group.forEach((entry, index) => {
        const position = index + 1;
        if (entry.event.side === 'top') topMax = Math.max(topMax, position);
        else bottomMax = Math.max(bottomMax, position);
        points.push(Object.assign({}, entry.event, { column: entry.column, position }) as WavePoint);
      });
    });

    return {
      points,
      columnCount,
      segmentsPerQuarter,
      regulationQuarters: REGULATION_QUARTERS,
      topMax,
      bottomMax,
      hasOvertime,
    };
  };

  /**
   * Width of the viewBox (in dot-cell units) for a given granularity. Mirrors
   * the xOf math in `buildGeometry` so a px-per-cell estimate can be taken
   * before the model for that granularity exists.
   */
  const vbWidthUnits = (segmentsPerQuarter: number, hasOvertime: boolean): number => {
    if (!hasOvertime) {
      const lastRegColumn = REGULATION_QUARTERS * segmentsPerQuarter - 1;
      return lastRegColumn + 0.5 + (REGULATION_QUARTERS - 1) * QUARTER_GAP + RIGHT_PAD;
    }
    const otColumn = REGULATION_QUARTERS * segmentsPerQuarter;
    return otColumn + 0.5 + REGULATION_QUARTERS * QUARTER_GAP + RIGHT_PAD;
  };

  /**
   * Pick the finest granularity whose dots stay legible and whose bins stay
   * dense enough. Candidates are ascending and px-per-cell is monotonically
   * decreasing, so the first candidate that fails either guard ends the search.
   */
  const chooseSegments = (width: number, hasOvertime: boolean, totalEvents: number): number => {
    if (!width) return DEFAULT_SEGMENTS_PER_QUARTER;
    let chosen = SEGMENT_CANDIDATES[0];
    for (let i = 0; i < SEGMENT_CANDIDATES.length; i += 1) {
      const n = SEGMENT_CANDIDATES[i];
      const cellPx = width / vbWidthUnits(n, hasOvertime);
      if (cellPx < MIN_CELL_PX) break;
      const columns = REGULATION_QUARTERS * n + (hasOvertime ? 1 : 0);
      if (totalEvents > 0 && totalEvents / (2 * columns) < MIN_PLAYS_PER_CELL) break;
      chosen = n;
    }
    return chosen;
  };

  const buildGeometry = (model: GameWaveModel): WaveGeometry => {
    const spq = model.segmentsPerQuarter;
    const reg = model.regulationQuarters;
    const columnCount = model.columnCount;
    const hasOvertime = model.hasOvertime;
    const otColumn = reg * spq;

    const xOf = (column: number) => {
      const qi = column >= otColumn ? reg : Math.floor(column / spq);
      return column + 0.5 + qi * QUARTER_GAP;
    };

    const displayTop = Math.max(model.topMax, 1);
    const displayBottom = Math.max(model.bottomMax, 1);
    // Center of the reserved axis lane; top dots stack above it, bottom below.
    const centerY = displayTop + AXIS_HALF;

    const yOf = (point: WavePoint) =>
      point.side === 'top'
        ? centerY - AXIS_HALF - point.position + 0.5
        : centerY + AXIS_HALF + point.position - 0.5;

    const vbWidth = xOf(columnCount - 1) + RIGHT_PAD;
    const contentBottom = displayTop + displayBottom + 2 * AXIS_HALF;
    const vbHeight = contentBottom + LABEL_BAND;
    const labelY = contentBottom + 1.05;
    // Minute ticks sit in the reserved central lane between the two stacks,
    // nudged below the exact center to sit optically right.
    const minuteLabelY = centerY + 0.2;

    // Quarter labels centered under each quarter's columns.
    const quarterMarks: WaveMark[] = [];
    for (let qi = 0; qi < reg; qi += 1) {
      const first = qi * spq;
      const last = first + spq - 1;
      quarterMarks.push({ x: (xOf(first) + xOf(last)) / 2, label: 'Q' + (qi + 1) });
    }
    if (hasOvertime) quarterMarks.push({ x: xOf(otColumn), label: 'OT' });

    // Game-clock ticks down the center lane: one per bin (segment start),
    // including each quarter's 15:00. Rounded to whole minutes; shown without a
    // colon so 3-char labels can't crowd adjacent ticks at the finest binning.
    const minuteMarks: WaveMark[] = [];
    for (let qi = 0; qi < reg; qi += 1) {
      for (let s = 0; s < spq; s += 1) {
        const remaining = Math.round((QUARTER_MINUTES * (spq - s)) / spq);
        minuteMarks.push({ x: xOf(qi * spq + s), label: String(remaining) });
      }
    }

    // Faint dividers between quarters (and before OT).
    const dividers: number[] = [];
    for (let qi = 1; qi < reg; qi += 1) {
      dividers.push((xOf(qi * spq - 1) + xOf(qi * spq)) / 2);
    }
    if (hasOvertime) dividers.push((xOf(otColumn - 1) + xOf(otColumn)) / 2);

    return { xOf, yOf, vbWidth, vbHeight, centerY, labelY, minuteLabelY, quarterMarks, minuteMarks, dividers };
  };

  // A touchdown is shaded by how the play went — a 3-yard score is successful,
  // not explosive — and its label carries the points.
  const dotColor = (point: WavePoint, topColors: WaveShadeColors, bottomColors: WaveShadeColors): string => {
    const colors = point.side === 'top' ? topColors : bottomColors;
    if (point.outcome === 'explosive' || point.outcome === 'fieldGoal') return colors.explosive;
    if (point.outcome === 'success') return colors.success;
    return colors.light;
  };

  /** Hover text for a dot: who, what happened, and the play description. */
  const dotTooltip = (point: WavePoint, team: string, opponent: string): string => {
    const who = point.side === 'top' ? team : opponent;
    const situation = point.down ? ' (' + point.yardsGained + ' yds on ' + point.down + ' & ' + point.distance + ')' : '';
    return who + ' — ' + OUTCOME_LABELS[point.outcome] + situation + '\n' + point.playText;
  };

  /** A dot's hover text split for display: its first line is the title, the play text the body. */
  const tooltipParts = (point: WavePoint, team: string, opponent: string): { title: string; body: string } => {
    const text = dotTooltip(point, team, opponent);
    const at = text.indexOf('\n');
    return at === -1 ? { title: text, body: '' } : { title: text.slice(0, at), body: text.slice(at + 1) };
  };

  /**
   * Where a tooltip goes, in px inside its host: centered over the dot with the
   * caret pointing down at it, or under the dot when it won't fit above and
   * there's more room below. Held inside the host horizontally; `caretX` is
   * the caret's center, measured from the tooltip's left edge.
   */
  const placeTooltip = (
    anchor: { x: number; top: number; bottom: number },
    size: { width: number; height: number },
    bounds: { width: number; height: number },
  ): { left: number; top: number; below: boolean; caretX: number } => {
    const gap = TOOLTIP.caret + TOOLTIP.caretPadding;
    const above = anchor.top - gap - size.height;
    const below = above < 0 && bounds.height - (anchor.bottom + gap) > anchor.top - gap;
    const left = Math.max(0, Math.min(anchor.x - size.width / 2, bounds.width - size.width));
    const edge = TOOLTIP.radius + TOOLTIP.caret;
    return {
      left,
      top: below ? anchor.bottom + gap : above,
      below,
      caretX: Math.max(edge, Math.min(anchor.x - left, size.width - edge)),
    };
  };

  /**
   * Show a tooltip for whichever dot is under the pointer, the moment it's
   * there — the SVG carries no <title>, so no slow native tooltip competes.
   * Dots are found by their data-point index through listeners on `host`, so
   * the SVG underneath can be redrawn freely. On touch screens a tap shows a
   * dot's tooltip and a tap anywhere else hides it. Text is set as text, never
   * markup. Returns `hide` (call it when the wave redraws) and `destroy`.
   */
  const bindTooltip = (spec: WaveTooltipSpec): { hide: () => void; destroy: () => void } => {
    const host = spec.host;
    const tip = spec.tooltip;
    const doc = host.ownerDocument;
    const title = doc.createElement('div');
    const body = doc.createElement('div');
    const caret = doc.createElement('div');
    tip.textContent = '';
    tip.appendChild(title);
    tip.appendChild(body);
    tip.appendChild(caret);
    Object.assign(tip.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      zIndex: '20',
      display: 'none',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      padding: TOOLTIP.padding + 'px',
      borderRadius: TOOLTIP.radius + 'px',
      background: TOOLTIP.background,
      color: TOOLTIP.color,
      fontFamily: TOOLTIP.fontFamily,
      fontSize: TOOLTIP.fontSize + 'px',
      fontWeight: 'normal',
      lineHeight: String(TOOLTIP.lineHeight),
      textAlign: 'left',
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
    });
    title.style.fontWeight = 'bold';
    Object.assign(caret.style, {
      position: 'absolute',
      width: '0px',
      height: '0px',
      borderLeft: TOOLTIP.caret + 'px solid transparent',
      borderRight: TOOLTIP.caret + 'px solid transparent',
    });
    const view = doc.defaultView;
    if (view && view.getComputedStyle(host).position === 'static') host.style.position = 'relative';

    let shown: Element | null = null;

    const hide = () => {
      shown = null;
      tip.style.display = 'none';
    };

    const show = (dot: Element) => {
      const point = spec.pointAt(Number(dot.getAttribute('data-point')));
      if (!point) {
        hide();
        return;
      }
      if (dot !== shown) {
        const parts = tooltipParts(point, spec.team, spec.opponent);
        title.textContent = parts.title;
        body.textContent = parts.body;
        title.style.marginBottom = parts.body ? TOOLTIP.titleMarginBottom + 'px' : '0px';
        tip.style.maxWidth = Math.min(TOOLTIP.maxWidth, host.clientWidth) + 'px';
        tip.style.display = 'block';
        shown = dot;
      }
      const hostBox = host.getBoundingClientRect();
      const dotBox = dot.getBoundingClientRect();
      const originX = hostBox.left + host.clientLeft;
      const originY = hostBox.top + host.clientTop;
      const spot = placeTooltip(
        { x: (dotBox.left + dotBox.right) / 2 - originX, top: dotBox.top - originY, bottom: dotBox.bottom - originY },
        { width: tip.offsetWidth, height: tip.offsetHeight },
        { width: host.clientWidth, height: host.clientHeight },
      );
      tip.style.left = spot.left + 'px';
      tip.style.top = spot.top + 'px';
      caret.style.left = spot.caretX - TOOLTIP.caret + 'px';
      caret.style.top = spot.below ? -TOOLTIP.caret + 'px' : '100%';
      caret.style.borderTop = spot.below ? '0px' : TOOLTIP.caret + 'px solid ' + TOOLTIP.background;
      caret.style.borderBottom = spot.below ? TOOLTIP.caret + 'px solid ' + TOOLTIP.background : '0px';
    };

    const dotAt = (target: EventTarget | null): Element | null => {
      const el = target as Element | null;
      if (!el || typeof el.closest !== 'function') return null;
      const dot = el.closest('[data-point]');
      return dot && host.contains(dot) ? dot : null;
    };
    const onPointer = (event: PointerEvent) => {
      const dot = dotAt(event.target);
      if (dot) show(dot);
      else hide();
    };
    // A lifting finger also "leaves" the host; on touch the tooltip stays up
    // until the next tap.
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') hide();
    };
    const onPageDown = (event: PointerEvent) => {
      if (!host.contains(event.target as Node)) hide();
    };
    host.addEventListener('pointermove', onPointer);
    host.addEventListener('pointerdown', onPointer);
    host.addEventListener('pointerleave', onLeave);
    doc.addEventListener('pointerdown', onPageDown);

    return {
      hide,
      destroy: () => {
        host.removeEventListener('pointermove', onPointer);
        host.removeEventListener('pointerdown', onPointer);
        host.removeEventListener('pointerleave', onLeave);
        doc.removeEventListener('pointerdown', onPageDown);
        hide();
      },
    };
  };

  const escapeXml = (value: string): string =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  /** Trim the float noise out of coordinates so the markup stays readable. */
  const n = (value: number): string => String(Math.round(value * 1000) / 1000);

  /** The wave as SVG markup — the string twin of the component's JSX. */
  const renderSvg = (spec: WaveSvgSpec): string => {
    const model = spec.model;
    const geom = spec.geometry;
    const parts: string[] = [];

    for (let i = 0; i < geom.dividers.length; i += 1) {
      const x = geom.dividers[i];
      parts.push(
        '<line x1="' + n(x) + '" x2="' + n(x) + '" y1="0.2" y2="' + n(geom.vbHeight - LABEL_BAND + 0.4) +
          '" stroke="' + palette.grid + '" stroke-width="0.05"/>',
      );
    }

    for (let i = 0; i < model.points.length; i += 1) {
      const point = model.points[i];
      const cx = n(geom.xOf(point.column));
      const cy = n(geom.yOf(point));
      parts.push(
        '<g><circle data-point="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + DOT_R + '" fill="' +
          escapeXml(dotColor(point, spec.topColors, spec.bottomColors)) + '" stroke="' + palette.dotStroke +
          '" stroke-width="0.05"/>' +
          (point.label
            ? '<text x="' + cx + '" y="' + cy + '" dy="0.35em" font-size="0.5" font-weight="bold" fill="' +
              (point.isScore ? palette.scoreLabel : palette.dotLabel) +
              '" text-anchor="middle" pointer-events="none">' + escapeXml(point.label) + '</text>'
            : '') +
          '</g>',
      );
    }

    for (let i = 0; i < geom.minuteMarks.length; i += 1) {
      const mark = geom.minuteMarks[i];
      parts.push(
        '<text x="' + n(mark.x) + '" y="' + n(geom.minuteLabelY) + '" font-size="0.55" fill="' +
          palette.minuteLabel + '" text-anchor="middle" dominant-baseline="central">' + escapeXml(mark.label) +
          '</text>',
      );
    }

    for (let i = 0; i < geom.quarterMarks.length; i += 1) {
      const mark = geom.quarterMarks[i];
      parts.push(
        '<text x="' + n(mark.x) + '" y="' + n(geom.labelY) + '" font-size="0.62" font-weight="bold" fill="' +
          palette.quarterLabel + '" text-anchor="middle" dominant-baseline="central">' + escapeXml(mark.label) +
          '</text>',
      );
    }

    return (
      '<svg class="wave-svg" viewBox="0 0 ' + n(geom.vbWidth) + ' ' + n(geom.vbHeight) +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
      escapeXml('Game wave: ' + spec.team + ' versus ' + spec.opponent) + '">' +
      parts.join('') +
      '</svg>'
    );
  };

  return {
    QUARTER_MINUTES,
    REGULATION_QUARTERS,
    DEFAULT_SEGMENTS_PER_QUARTER,
    DOT_R,
    LABEL_BAND,
    palette,
    buildModel,
    buildGeometry,
    chooseSegments,
    dotColor,
    dotTooltip,
    tooltipParts,
    placeTooltip,
    bindTooltip,
    renderSvg,
  };
};

/** The instance the app renders with. The embed builds its own from the source. */
export const waveRuntime = createWaveRuntime();
