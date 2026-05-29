import { useMemo } from 'react';
import type { PlayData } from '../types';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { buildGameWave, extractFieldGoals, type WavePoint } from '../utils/gameWave';

interface RawPlayLike {
  offense?: string;
  play_type?: string;
  playType?: string;
  play_text?: string;
  playText?: string;
  quarter?: number;
  period?: number;
  clock?: { minutes?: number; seconds?: number };
}

interface GameWaveChartProps {
  plays: PlayData[];
  team: string;
  opponent: string;
  teamColorId: string;
  opponentColorId: string;
  rawPlays?: RawPlayLike[];
}

interface ShadeColors {
  explosive: string;
  success: string;
  light: string;
}

// Geometry, in viewBox units where 1 unit = one dot cell.
const DOT_R = 0.4;
const QUARTER_GAP = 0.7;
const LABEL_BAND = 1.9;
const RIGHT_PAD = 0.6;

const GameWaveChart = ({
  plays,
  team,
  opponent,
  teamColorId,
  opponentColorId,
  rawPlays = [],
}: GameWaveChartProps) => {
  const fieldGoals = useMemo(() => extractFieldGoals(rawPlays), [rawPlays]);
  const model = useMemo(() => buildGameWave(plays, team, fieldGoals), [plays, team, fieldGoals]);

  const topColors = useMemo<ShadeColors>(() => getDisplayTeamColors(team, teamColorId), [team, teamColorId]);
  const bottomColors = useMemo<ShadeColors>(
    () => getDisplayTeamColors(opponent, opponentColorId),
    [opponent, opponentColorId],
  );

  const geom = useMemo(() => {
    const { segmentsPerQuarter: spq, regulationQuarters: reg, columnCount, hasOvertime } = model;
    const otColumn = reg * spq;

    const xOf = (column: number) => {
      const qi = column >= otColumn ? reg : Math.floor(column / spq);
      return column + 0.5 + qi * QUARTER_GAP;
    };

    const displayTop = Math.max(model.topMax, 1);
    const displayBottom = Math.max(model.bottomMax, 1);
    const centerY = displayTop;

    const yOf = (point: WavePoint) =>
      point.side === 'top' ? centerY - point.position + 0.5 : centerY + point.position - 0.5;

    const vbWidth = xOf(columnCount - 1) + RIGHT_PAD;
    const vbHeight = displayTop + displayBottom + LABEL_BAND;
    const labelY = displayTop + displayBottom + 1.05;

    // Quarter labels centered under each quarter's columns.
    const quarterMarks: { x: number; label: string }[] = [];
    for (let qi = 0; qi < reg; qi += 1) {
      const first = qi * spq;
      const last = first + spq - 1;
      quarterMarks.push({ x: (xOf(first) + xOf(last)) / 2, label: `Q${qi + 1}` });
    }
    if (hasOvertime) quarterMarks.push({ x: xOf(otColumn), label: 'OT' });

    // Faint dividers between quarters (and before OT).
    const dividers: number[] = [];
    for (let qi = 1; qi < reg; qi += 1) {
      dividers.push((xOf(qi * spq - 1) + xOf(qi * spq)) / 2);
    }
    if (hasOvertime) dividers.push((xOf(otColumn - 1) + xOf(otColumn)) / 2);

    return { xOf, yOf, vbWidth, vbHeight, centerY, labelY, quarterMarks, dividers };
  }, [model]);

  const colorOf = (point: WavePoint): string => {
    const colors = point.side === 'top' ? topColors : bottomColors;
    if (point.isScore) return colors.explosive;
    if (point.outcome === 'explosive') return colors.explosive;
    if (point.outcome === 'success') return colors.success;
    return colors.light;
  };

  const maxWidthPx = Math.min(900, Math.round(geom.vbWidth * 24));

  if (model.points.length === 0) return null;

  const Swatch = ({ color, label }: { color: string; label: string }) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-neutral-500">{label}</span>
    </span>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-neutral-900">Game wave</h2>
        <p className="text-sm text-neutral-500">
          Each dot is a play, binned by game clock. {team} stacks up, {opponent} stacks down.
          Explosive plays sit nearest the center line; scoring plays show points (7 = TD, 3 = FG).
        </p>
      </div>

      <div className="w-full mx-auto" style={{ maxWidth: `${maxWidthPx}px` }}>
        <svg
          viewBox={`0 0 ${geom.vbWidth} ${geom.vbHeight}`}
          style={{ width: '100%', height: 'auto' }}
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
              stroke="#e5e5e5"
              strokeWidth={0.03}
            />
          ))}

          {/* Center line */}
          <line
            x1={0}
            x2={geom.vbWidth}
            y1={geom.centerY}
            y2={geom.centerY}
            stroke="#d4d4d4"
            strokeWidth={0.04}
          />

          {/* Dots */}
          {model.points.map((point, i) => {
            const cx = geom.xOf(point.column);
            const cy = geom.yOf(point);
            return (
              <g key={`pt-${i}`}>
                <circle cx={cx} cy={cy} r={DOT_R} fill={colorOf(point)} stroke="#ffffff" strokeWidth={0.05}>
                  <title>
                    {`${point.team} — ${
                      point.outcome === 'explosive'
                        ? 'Explosive'
                        : point.outcome === 'fieldGoal'
                          ? 'Field goal'
                          : point.outcome === 'success'
                            ? 'Successful'
                            : 'Unsuccessful'
                    }${point.down ? ` (${point.yardsGained} yds on ${point.down} & ${point.distance})` : ''}\n${point.playText}`}
                  </title>
                </circle>
                {point.label && (
                  <text
                    x={cx}
                    y={cy}
                    fontSize={0.5}
                    fontWeight="bold"
                    fill={point.isScore ? '#ffffff' : '#374151'}
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Quarter marks */}
          {geom.quarterMarks.map((mark) => (
            <text
              key={`q-${mark.label}`}
              x={mark.x}
              y={geom.labelY}
              fontSize={0.62}
              fontWeight="bold"
              fill="#737373"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {mark.label}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
        <Swatch color={topColors.explosive} label="Explosive" />
        <Swatch color={topColors.success} label="Successful" />
        <Swatch color={topColors.light} label="Unsuccessful" />
        <span className="text-xs text-neutral-400">Numbers mark scoring plays (7 = TD, 3 = FG); i = interception.</span>
      </div>
    </div>
  );
};

export default GameWaveChart;
