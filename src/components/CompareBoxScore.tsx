import type React from 'react';
import type { AveragedBoxScore, AveragedBoxScoreStat, BoxScoreMode } from '../utils/seasonBoxScoreMetrics';

interface CompareBoxScoreProps {
  teamA: string;
  teamB: string;
  statsA: AveragedBoxScore;
  statsB: AveragedBoxScore;
  colorA: string;
  colorB: string;
  mode: BoxScoreMode;
  onModeChange: (mode: BoxScoreMode) => void;
}

// Pair each team's own value (teamValue) by row so the two teams are compared
// directly in one table, rather than each team vs. its own opponents.
const StatGroup: React.FC<{
  a: AveragedBoxScoreStat[];
  b: AveragedBoxScoreStat[];
  teamA: string;
  teamB: string;
  colorA: string;
  colorB: string;
}> = ({ a, b, teamA, teamB, colorA, colorB }) => (
  <div className="flex-1 overflow-hidden rounded-xl border border-neutral-200">
    <div className="grid grid-cols-3 bg-neutral-100 text-sm font-semibold">
      <div className="px-4 py-3 truncate" style={{ color: colorA }} title={teamA}>
        {teamA}
      </div>
      <div className="px-4 py-3 text-center text-neutral-500">Metric</div>
      <div className="px-4 py-3 text-right truncate" style={{ color: colorB }} title={teamB}>
        {teamB}
      </div>
    </div>
    {a.map((stat, i) => (
      <div key={stat.label} className="grid grid-cols-3 border-t border-neutral-200 items-center">
        <div className="px-4 py-2.5 text-sm font-semibold text-neutral-900">{stat.teamValue}</div>
        <div className="px-4 py-2.5 text-center text-xs text-neutral-500">{stat.label}</div>
        <div className="px-4 py-2.5 text-right text-sm font-semibold text-neutral-900">
          {b[i]?.teamValue ?? '—'}
        </div>
      </div>
    ))}
  </div>
);

const CompareBoxScore: React.FC<CompareBoxScoreProps> = ({
  teamA,
  teamB,
  statsA,
  statsB,
  colorA,
  colorB,
  mode,
  onModeChange,
}) => (
  <div className="mb-8 bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6">
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
      <div className="flex border border-neutral-300 rounded-lg overflow-hidden h-8">
        <button
          onClick={() => onModeChange('averages')}
          className={`px-3 text-sm font-medium transition-colors ${
            mode === 'averages'
              ? 'bg-neutral-200 text-neutral-600 cursor-default'
              : 'bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          Averages
        </button>
        <button
          onClick={() => onModeChange('totals')}
          className={`px-3 text-sm font-medium transition-colors border-l border-neutral-300 ${
            mode === 'totals'
              ? 'bg-neutral-200 text-neutral-600 cursor-default'
              : 'bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          Totals
        </button>
      </div>
    </div>

    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      <StatGroup
        a={statsA.firstTableStats}
        b={statsB.firstTableStats}
        teamA={teamA}
        teamB={teamB}
        colorA={colorA}
        colorB={colorB}
      />
      <StatGroup
        a={statsA.secondTableStats}
        b={statsB.secondTableStats}
        teamA={teamA}
        teamB={teamB}
        colorA={colorA}
        colorB={colorB}
      />
    </div>
  </div>
);

export default CompareBoxScore;
