import type React from 'react';
import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { PlayData } from '../types';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { initializeChartDefaults } from '../utils/chartConfig';
import { buildGameWave, type WaveOutcome, type WavePoint } from '../utils/gameWave';

initializeChartDefaults();

interface GameWaveChartProps {
  plays: PlayData[];
  team: string;
  opponent: string;
  teamColorId: string;
  opponentColorId: string;
}

interface ShadeColors {
  explosive: string;
  success: string;
  light: string;
}

const colorForOutcome = (outcome: WaveOutcome, colors: ShadeColors): string =>
  outcome === 'explosive' ? colors.explosive : outcome === 'success' ? colors.success : colors.light;

const GameWaveChart: React.FC<GameWaveChartProps> = ({
  plays,
  team,
  opponent,
  teamColorId,
  opponentColorId,
}) => {
  const model = useMemo(() => buildGameWave(plays, team), [plays, team]);

  const topColors = useMemo<ShadeColors>(() => getDisplayTeamColors(team, teamColorId), [team, teamColorId]);
  const bottomColors = useMemo<ShadeColors>(
    () => getDisplayTeamColors(opponent, opponentColorId),
    [opponent, opponentColorId],
  );

  const { topPoints, bottomPoints } = useMemo(() => {
    const top: WavePoint[] = [];
    const bottom: WavePoint[] = [];
    for (const point of model.points) {
      (point.side === 'top' ? top : bottom).push(point);
    }
    return { topPoints: top, bottomPoints: bottom };
  }, [model]);

  const data = useMemo<ChartData<'scatter'>>(() => {
    const makeDataset = (points: WavePoint[], colors: ShadeColors, label: string) => ({
      label,
      data: points.map((p) => ({ x: p.x, y: p.y })),
      backgroundColor: colors.success,
      pointBackgroundColor: points.map((p) => colorForOutcome(p.outcome, colors)),
      pointBorderColor: 'rgba(255,255,255,0.85)',
      pointBorderWidth: 1,
      pointRadius: 7,
      pointHoverRadius: 9,
      datalabels: {
        display: (ctx: { dataIndex: number }) => points[ctx.dataIndex]?.label != null,
        formatter: (_value: unknown, ctx: { dataIndex: number }) => points[ctx.dataIndex]?.label ?? '',
        color: 'white',
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        padding: 0,
        font: { size: 10, weight: 'bold' as const },
      },
    });

    return {
      datasets: [
        makeDataset(topPoints, topColors, team),
        makeDataset(bottomPoints, bottomColors, opponent),
      ],
    };
  }, [topPoints, bottomPoints, topColors, bottomColors, team, opponent]);

  const pointsByDataset = useMemo(() => [topPoints, bottomPoints], [topPoints, bottomPoints]);

  const options = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'center' },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx) => {
              const point = pointsByDataset[ctx.datasetIndex]?.[ctx.dataIndex];
              if (!point) return '';
              const outcome =
                point.outcome === 'explosive'
                  ? 'Explosive'
                  : point.outcome === 'success'
                    ? 'Successful'
                    : 'Unsuccessful';
              return [
                `${point.team} — ${outcome}`,
                `${point.yardsGained} yds on ${point.down} & ${point.distance}`,
                point.playText,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: -0.5,
          max: model.columnCount - 0.5,
          grid: { display: false },
          ticks: {
            stepSize: 1,
            autoSkip: false,
            callback: (value) => model.columnLabels[value as number] ?? '',
            font: { size: 11 },
          },
        },
        y: {
          min: -(model.bottomMax + 1),
          max: model.topMax + 1,
          ticks: { display: false },
          border: { display: false },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? '#d4d4d4' : 'transparent'),
          },
        },
      },
    }),
    [model, pointsByDataset],
  );

  if (model.points.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-neutral-900">Game wave</h2>
        <p className="text-sm text-neutral-500">
          Each dot is a play, binned by game clock. {team} stacks up, {opponent} stacks down.
          Darker dots are more successful (explosive &gt; successful &gt; unsuccessful).
        </p>
      </div>
      <div className="h-[460px]">
        <Scatter data={data} options={options} />
      </div>
    </div>
  );
};

export default GameWaveChart;
