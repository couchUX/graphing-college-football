import type React from 'react';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { AveragedBoxScore, AveragedBoxScoreStat, BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { buildBoxScoreEmbedHtml } from '../utils/boxScoreEmbed';
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

const CopyEmbedButton: React.FC<{ copied: boolean; onClick: () => void }> = ({ copied, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
      copied ? 'border-green-300 bg-green-50' : 'border-neutral-300 hover:bg-neutral-50'
    }`}
    title={copied ? 'Copied!' : 'Copy embed code'}
  >
    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-neutral-600" />}
  </button>
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
  const [copied, setCopied] = useState(false);
  const teamAColor = getDisplayTeamColors(teamA, colorA).success;
  const oppColor = getDisplayTeamColors(teamB, colorB).success;
  const first = mergeStats(statsA.firstTableStats, statsB.firstTableStats);
  const second = mergeStats(statsA.secondTableStats, statsB.secondTableStats);
  const modeLabel = mode === 'totals' ? 'Total' : 'Avg';

  const handleCopyEmbed = async () => {
    if (!navigator.clipboard?.writeText) {
      console.error('Clipboard not available in this browser');
      return;
    }
    // Link back to this exact comparison (same params TeamCompareView persists).
    const params = new URLSearchParams();
    params.set('view', 'compare');
    params.set('aTeam', teamA);
    params.set('bTeam', teamB);
    params.set('compareYear', String(year));
    if (colorA !== 'default') params.set('aColor', colorA);
    if (colorB !== 'default') params.set('bColor', colorB);

    const embedHTML = buildBoxScoreEmbedHtml({
      // Reflect the calculation mode the table is currently showing.
      title: `Box Score (${mode === 'totals' ? 'Totals' : 'Averages'})`,
      subtitle: `${teamA} vs. ${teamB} - ${year} Season`,
      sourceUrl: `https://graphingcollegefootball.com/trends?${params.toString()}`,
      left: { label: teamA, color: teamAColor || '#6b7280' },
      right: { label: teamB, color: oppColor || '#9CA3AF' },
      rows: [...first, ...second].map(stat => ({
        label: stat.label,
        leftValue: String(stat.teamValue),
        rightValue: String(stat.oppValue),
      })),
    });

    try {
      await navigator.clipboard.writeText(embedHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
    }
  };

  return (
    <div className="mb-8">
      {/* Mobile-only header card (matches Season trends box score) */}
      <div className="md:hidden bg-white rounded-t-2xl shadow-sm border border-neutral-200 border-b-0 pt-4 px-6 pb-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} onModeChange={onModeChange} />
            <CopyEmbedButton copied={copied} onClick={handleCopyEmbed} />
          </div>
        </div>
      </div>

      {/* Desktop: full card */}
      <div className="md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-neutral-200 md:pt-5 md:px-6 md:pb-6">
        <div className="hidden md:flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} onModeChange={onModeChange} />
            <CopyEmbedButton copied={copied} onClick={handleCopyEmbed} />
          </div>
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
