import type React from 'react';
import type { AveragedBoxScore, AveragedBoxScoreStat, BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { SeasonBoxScoreTable } from './SeasonAdvancedBoxScore';

interface CompareBoxScoreProps {
  teamA: string;
  teamB: string;
  statsA: AveragedBoxScore;
  statsB: AveragedBoxScore;
  colorA: string;
  colorB: string;
  year: number;
  mode: BoxScoreMode;
  onModeChange: (mode: BoxScoreMode) => void;
}

// Pair each team's own value (teamValue) into one stat row so the two teams are
// compared directly, reusing SeasonBoxScoreTable's styling (team column +
// right-hand column repurposed as Team B instead of "Opponents").
const mergeStats = (
  a: AveragedBoxScoreStat[],
  b: AveragedBoxScoreStat[],
): AveragedBoxScoreStat[] =>
  a.map((stat, i) => ({
    label: stat.label,
    teamValue: stat.teamValue,
    oppValue: b[i]?.teamValue ?? '—',
  }));

const ModeToggle: React.FC<{ mode: BoxScoreMode; onModeChange: (m: BoxScoreMode) => void }> = ({
  mode,
  onModeChange,
}) => (
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
);

const CompareBoxScore: React.FC<CompareBoxScoreProps> = ({
  teamA,
  teamB,
  statsA,
  statsB,
  colorA,
  colorB,
  year,
  mode,
  onModeChange,
}) => {
  const oppColor = getDisplayTeamColors(teamB, colorB).success;
  const first = mergeStats(statsA.firstTableStats, statsB.firstTableStats);
  const second = mergeStats(statsA.secondTableStats, statsB.secondTableStats);
  const modeLabel = mode === 'totals' ? 'Total' : 'Avg';

  return (
    <div className="mb-8">
      {/* Mobile-only header card (matches Season trends box score) */}
      <div className="md:hidden bg-white rounded-t-2xl shadow-sm border border-neutral-200 border-b-0 pt-4 px-6 pb-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
          <ModeToggle mode={mode} onModeChange={onModeChange} />
        </div>
      </div>

      {/* Desktop: full card */}
      <div className="md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-neutral-200 md:pt-5 md:px-6 md:pb-6">
        <div className="hidden md:flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
          <ModeToggle mode={mode} onModeChange={onModeChange} />
        </div>

        <div className="flex flex-col md:flex-row gap-0 md:gap-6">
          <div className="flex-1">
            <SeasonBoxScoreTable
              stats={first}
              team={teamA}
              tableTitle={`${year} Season (${modeLabel})`}
              selectedTeamColor={colorA}
              gamesCount={0}
              isFirst={true}
              oppLabel={teamB}
              oppColor={oppColor}
            />
          </div>
          <div className="flex-1">
            <SeasonBoxScoreTable
              stats={second}
              team={teamA}
              tableTitle="Stats (cont'd)"
              selectedTeamColor={colorA}
              gamesCount={0}
              isFirst={false}
              oppLabel={teamB}
              oppColor={oppColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareBoxScore;
