import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy } from 'lucide-react';
import type { PlayData } from '../types';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import {
  buildGameWave,
  DEFAULT_SEGMENTS_PER_QUARTER,
  extractFieldGoals,
  extractFumbles,
  REGULATION_QUARTERS,
  type RawPlayLike,
} from '../utils/gameWave';
import {
  buildWaveGeometry,
  DOT_LABEL_COLOR,
  DOT_R,
  GRID_COLOR,
  LABEL_BAND,
  MINUTE_LABEL_COLOR,
  QUARTER_LABEL_COLOR,
  vbWidthUnits,
  waveDotColor,
  waveDotTooltip,
  type WaveShadeColors,
} from '../utils/gameWaveGeometry';
import { buildGameWaveEmbedHtml } from '../utils/gameWaveEmbed';

/** Card title, shared with the embed and the "copied" toast. */
export const GAME_WAVE_TITLE = 'Game Wave';

interface GameWaveChartProps {
  plays: PlayData[];
  team: string;
  opponent: string;
  teamColorId: string;
  opponentColorId: string;
  rawPlays?: RawPlayLike[];
  /** Line under the title in the embed (game context). */
  subtitle?: string;
  /** Embed footer link target ("See all charts"). */
  sourceUrl?: string;
  /** Omit to hide the embed button. Receives the ready-to-paste HTML. */
  onCopyEmbed?: (embedCode: string) => void;
  isCopied?: boolean;
}

// Smallest the (centered) chart area can be dragged to.
const MIN_CHART_WIDTH = 240;
// Keyboard nudge step for the resize handles, in px of margin per arrow press.
const RESIZE_STEP = 24;

// Responsive time-binning. As the chart area gets wider we subdivide each
// quarter into more (finer) clock tranches so the wave fills the horizontal
// space and the stacks flatten out, rather than blowing the dots up huge.
// Candidates run from 3/quarter (~5 min bins) to 15/quarter (~1 min bins).
const SEGMENT_CANDIDATES = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
const MIN_CELL_PX = 18; // don't let a single dot cell render narrower than this
const MIN_PLAYS_PER_CELL = 0.9; // and don't subdivide so far the wave goes sparse/flat

// Pick the finest granularity whose dots stay legible and whose bins stay dense
// enough. Candidates are ascending and px-per-cell is monotonically decreasing,
// so the first candidate that fails either guard ends the search.
const chooseSegmentsPerQuarter = (width: number, hasOvertime: boolean, totalPlays: number): number => {
  if (!width) return DEFAULT_SEGMENTS_PER_QUARTER;
  let chosen = SEGMENT_CANDIDATES[0];
  for (const n of SEGMENT_CANDIDATES) {
    const cellPx = width / vbWidthUnits(n, hasOvertime);
    if (cellPx < MIN_CELL_PX) break;
    const columns = REGULATION_QUARTERS * n + (hasOvertime ? 1 : 0);
    if (totalPlays > 0 && totalPlays / (2 * columns) < MIN_PLAYS_PER_CELL) break;
    chosen = n;
  }
  return chosen;
};

const LegendSwatch = ({ dotClass, label }: { dotClass: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
    {label}
  </span>
);

const HANDLE_CLASS =
  'absolute z-10 flex h-11 w-2.5 cursor-ew-resize items-center justify-center rounded-full border ' +
  'border-neutral-300 bg-white shadow-sm transition-colors hover:border-neutral-400 hover:shadow ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

// Two short vertical bars — the grip texture inside each resize handle.
const Grip = () => (
  <span className="flex gap-[2px]">
    <span className="h-3.5 w-px bg-neutral-400" />
    <span className="h-3.5 w-px bg-neutral-400" />
  </span>
);

const GameWaveChart = ({
  plays,
  team,
  opponent,
  teamColorId,
  opponentColorId,
  rawPlays = [],
  subtitle,
  sourceUrl = 'https://graphingcollegefootball.com',
  onCopyEmbed,
  isCopied = false,
}: GameWaveChartProps) => {
  // Measure the available width so the wave can re-bin as it grows/shrinks.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // User-controlled margin (px) on each side; the chart stays centered between.
  const [inset, setInset] = useState(0);
  const [draggingSide, setDraggingSide] = useState<'left' | 'right' | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxInset = Math.max(0, (containerWidth - MIN_CHART_WIDTH) / 2);
  const clampedInset = Math.min(inset, maxInset);
  const chartWidth = containerWidth > 0 ? containerWidth - 2 * clampedInset : 0;

  const fieldGoals = useMemo(() => extractFieldGoals(rawPlays), [rawPlays]);
  const fumbles = useMemo(() => extractFumbles(rawPlays), [rawPlays]);

  const hasOvertime = useMemo(
    () =>
      plays.some((p) => p.quarter > REGULATION_QUARTERS) ||
      fieldGoals.some((fg) => fg.quarter > REGULATION_QUARTERS) ||
      fumbles.some((f) => f.quarter > REGULATION_QUARTERS),
    [plays, fieldGoals, fumbles],
  );

  const segmentsPerQuarter = useMemo(
    () => chooseSegmentsPerQuarter(chartWidth, hasOvertime, plays.length + fieldGoals.length + fumbles.length),
    [chartWidth, hasOvertime, plays.length, fieldGoals.length, fumbles.length],
  );

  const model = useMemo(
    () => buildGameWave(plays, team, fieldGoals, segmentsPerQuarter, fumbles),
    [plays, team, fieldGoals, segmentsPerQuarter, fumbles],
  );

  const topColors = useMemo<WaveShadeColors>(() => getDisplayTeamColors(team, teamColorId), [team, teamColorId]);
  const bottomColors = useMemo<WaveShadeColors>(
    () => getDisplayTeamColors(opponent, opponentColorId),
    [opponent, opponentColorId],
  );

  const geom = useMemo(() => buildWaveGeometry(model), [model]);

  // The embed bakes the binning showing on screen, then sizes itself to
  // whatever container it lands in — no resize handles travel with it.
  const handleCopyEmbed = () => {
    onCopyEmbed?.(
      buildGameWaveEmbedHtml({
        model,
        team,
        opponent,
        topColors,
        bottomColors,
        title: GAME_WAVE_TITLE,
        subtitle,
        sourceUrl,
      }),
    );
  };

  // Resize handles: dragging either side adjusts the symmetric margin so the
  // chart grows/shrinks about its center. Pointer capture keeps the drag alive
  // outside the handle; the side guard ignores plain hover-move events.
  const startDrag = (side: 'left' | 'right') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingSide(side);
  };
  const onDragMove = (side: 'left' | 'right') => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingSide !== side) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fromEdge = side === 'left' ? e.clientX - rect.left : rect.right - e.clientX;
    setInset(Math.max(0, Math.min(fromEdge, maxInset)));
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDraggingSide(null);
  };
  // Arrow keys move the handle in its own direction, so the meaning of left/right
  // is mirrored per side: moving a handle toward the page edge widens the chart
  // (less margin), moving it toward the center narrows it (more margin).
  const onHandleKey = (side: 'left' | 'right') => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (direction === 0) return;
    e.preventDefault();
    // Left handle: moving right (+1) adds margin; right handle: moving right widens.
    const insetDelta = (side === 'left' ? direction : -direction) * RESIZE_STEP;
    setInset((i) => Math.max(0, Math.min(i + insetDelta, maxInset)));
  };

  if (model.points.length === 0) return null;


  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-neutral-200">
        <h3 className="headline relative top-px text-[17px] font-bold text-ink">{GAME_WAVE_TITLE}</h3>

        {onCopyEmbed && (
          <button
            onClick={handleCopyEmbed}
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg border transition-colors ${
              isCopied
                ? 'border-accent text-accent'
                : 'border-neutral-300 text-byline hover:border-neutral-400 hover:text-ink'
            }`}
            title={isCopied ? 'Copied' : 'Copy embed code'}
            aria-label={isCopied ? 'Embed code copied' : `Copy embed code for ${GAME_WAVE_TITLE}`}
          >
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
      {/* Inline legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-500">
        <span className="text-neutral-400">Plays binned by game clock</span>
        <span className="text-neutral-300">·</span>
        <span className="inline-flex items-center gap-1">
          <ArrowUp size={13} strokeWidth={2.5} style={{ color: topColors.explosive }} />
          <span className="font-medium text-neutral-700">{team}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowDown size={13} strokeWidth={2.5} style={{ color: bottomColors.explosive }} />
          <span className="font-medium text-neutral-700">{opponent}</span>
        </span>
        <span className="text-neutral-300">·</span>
        <LegendSwatch dotClass="bg-neutral-700" label="Explosive" />
        <LegendSwatch dotClass="bg-neutral-400" label="Successful" />
        <LegendSwatch dotClass="bg-neutral-200 ring-1 ring-inset ring-neutral-300" label="Unsuccessful" />
      </div>

      {/* Resizable chart area: drag either handle to size the wave. It stays
          centered and the revealed margins fill with a faint dotted backdrop. */}
      <div
        ref={containerRef}
        className={`relative w-full ${draggingSide ? 'select-none' : ''}`}
        style={{
          backgroundImage: 'radial-gradient(circle, #E0D8CD 1.1px, transparent 1.1px)',
          backgroundSize: '9px 9px',
        }}
      >
        <div
          className="mx-auto rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
          style={{ width: chartWidth ? `${chartWidth}px` : '100%' }}
        >
          <svg
            viewBox={`0 0 ${geom.vbWidth} ${geom.vbHeight}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Game wave: ${team} versus ${opponent}`}
          >
            {/* Quarter dividers */}
            {geom.dividers.map((x, i) => (
              <line
                key={`div-${i}`}
                x1={x}
                x2={x}
                y1={0.2}
                y2={geom.vbHeight - LABEL_BAND + 0.4}
                stroke={GRID_COLOR}
                strokeWidth={0.05}
              />
            ))}

            {/* Dots */}
            {model.points.map((point, i) => {
              const cx = geom.xOf(point.column);
              const cy = geom.yOf(point);
              return (
                <g key={`pt-${i}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={DOT_R}
                    fill={waveDotColor(point, topColors, bottomColors)}
                    stroke="#ffffff"
                    strokeWidth={0.05}
                  >
                    <title>{waveDotTooltip(point)}</title>
                  </circle>
                  {point.label && (
                    <text
                      x={cx}
                      y={cy}
                      dy="0.35em"
                      fontSize={0.5}
                      fontWeight="bold"
                      fill={point.isScore ? '#ffffff' : DOT_LABEL_COLOR}
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {point.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Game-clock minute ticks in the reserved central axis lane */}
            {geom.minuteMarks.map((mark, i) => (
              <text
                key={`min-${i}`}
                x={mark.x}
                y={geom.minuteLabelY}
                fontSize={0.55}
                fill={MINUTE_LABEL_COLOR}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {mark.label}
              </text>
            ))}

            {/* Quarter marks */}
            {geom.quarterMarks.map((mark) => (
              <text
                key={`q-${mark.label}`}
                x={mark.x}
                y={geom.labelY}
                fontSize={0.62}
                fontWeight="bold"
                fill={QUARTER_LABEL_COLOR}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {mark.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Drag handles, centered on each edge of the chart area. */}
        {containerWidth > 0 && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chart from the left"
              aria-valuemin={MIN_CHART_WIDTH}
              aria-valuemax={Math.round(containerWidth)}
              aria-valuenow={Math.round(chartWidth)}
              tabIndex={0}
              onPointerDown={startDrag('left')}
              onPointerMove={onDragMove('left')}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onHandleKey('left')}
              className={HANDLE_CLASS}
              style={{ left: clampedInset, top: '50%', transform: 'translate(-50%, -50%)', touchAction: 'none' }}
            >
              <Grip />
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chart from the right"
              aria-valuemin={MIN_CHART_WIDTH}
              aria-valuemax={Math.round(containerWidth)}
              aria-valuenow={Math.round(chartWidth)}
              tabIndex={0}
              onPointerDown={startDrag('right')}
              onPointerMove={onDragMove('right')}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onHandleKey('right')}
              className={HANDLE_CLASS}
              style={{ right: clampedInset, top: '50%', transform: 'translate(50%, -50%)', touchAction: 'none' }}
            >
              <Grip />
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default GameWaveChart;
