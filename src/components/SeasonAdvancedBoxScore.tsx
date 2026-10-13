import React from 'react';
import { AveragedBoxScoreStat, BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import { buildBoxScoreEmbedHtml } from '../utils/boxScoreEmbed';
import ShareMenu from './ShareMenu';

// Generate season box score embed HTML (team vs. combined opponents)
const generateSeasonBoxScoreEmbed = (
  allStats: AveragedBoxScoreStat[],
  teamName: string,
  year: number,
  gamesCount: number,
  mode: BoxScoreMode,
  selectedTeamColor: string
): string => {
  const teamColors = getDisplayTeamColors(teamName, selectedTeamColor);
  const modeLabel = mode === 'totals' ? 'Totals' : 'Averages';

  const trendsUrl = (() => {
    const params = new URLSearchParams();
    params.set('year', year.toString());
    params.set('team', teamName);
    if (selectedTeamColor !== 'default') {
      params.set('teamColor', selectedTeamColor);
    }
    return `https://graphingcollegefootball.com/trends?${params.toString()}`;
  })();

  return buildBoxScoreEmbedHtml({
    title: `Season Box Score (${modeLabel})`,
    subtitle: `${teamName} - ${year} Season (${gamesCount} games)`,
    sourceUrl: trendsUrl,
    left: { label: teamName, color: teamColors.success || '#6b7280' },
    right: { label: 'Opponents', color: '#9CA3AF' },
    rows: allStats.map(stat => ({
      label: stat.label,
      leftValue: String(stat.teamValue),
      rightValue: String(stat.oppValue),
    })),
  });
};

interface SeasonBoxScoreTableProps {
  stats: AveragedBoxScoreStat[];
  team: string;
  tableTitle: string;
  selectedTeamColor: string;
  gamesCount: number;
  isFirst: boolean;
  // Override the right-hand column (defaults to a gray "Opponents" column).
  // Team vs. Team passes the opponent team's name and color here.
  oppLabel?: string;
  oppColor?: string;
}

export const SeasonBoxScoreTable: React.FC<SeasonBoxScoreTableProps> = ({
  stats,
  team,
  tableTitle,
  selectedTeamColor,
  gamesCount: _gamesCount,
  isFirst,
  oppLabel = 'Opponents',
  oppColor
}) => {
  const teamColors = getDisplayTeamColors(team, selectedTeamColor);
  const oppColors = {
    success: '#9CA3AF',
    explosive: '#6B7280',
    light: '#F3F4F6',
    colorDark: '#4B5563'
  };

  return (
    <div className={`bg-white overflow-hidden ${
      isFirst
        ? 'rounded-none md:rounded-lg border border-neutral-200'
        : 'rounded-b-lg md:rounded-lg border-0 border-l border-r border-b border-neutral-200 md:border'
    }`}>
      <table className="min-w-full table-fixed">
        <colgroup>
          <col className="w-auto" />
          <col className="w-24" />
          <col className="w-24" />
        </colgroup>
        <thead className={isFirst ? '' : 'hidden md:table-header-group'}>
          <tr className="bg-neutral-600 text-white">
            <th
              className="px-4 py-3 text-left text-sm font-semibold border-b-4"
              style={{ borderBottomColor: '#475569' }}
            >
              {tableTitle}
            </th>
            <th
              className="px-4 py-3 text-center text-sm font-semibold border-b-4"
              style={{ borderBottomColor: teamColors.success || '#6b7280' }}
            >
              {team}
            </th>
            <th
              className="px-4 py-3 text-center text-sm font-semibold border-b-4"
              style={{ borderBottomColor: oppColor || oppColors.success }}
            >
              {oppLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {stats.map((stat, index) => (
            <tr key={stat.label} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
              <td className="px-4 py-3 text-sm font-medium text-neutral-900">{stat.label}</td>
              <td className="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">{stat.teamValue}</td>
              <td className="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">{stat.oppValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface SeasonAdvancedBoxScoreProps {
  team: string;
  year: number;
  firstTableStats: AveragedBoxScoreStat[];
  secondTableStats: AveragedBoxScoreStat[];
  selectedTeamColor: string;
  gamesCount: number;
  mode: BoxScoreMode;
  onModeChange: (mode: BoxScoreMode) => void;
}

const SeasonAdvancedBoxScore: React.FC<SeasonAdvancedBoxScoreProps> = ({
  team,
  year,
  firstTableStats,
  secondTableStats,
  selectedTeamColor,
  gamesCount,
  mode,
  onModeChange
}) => {
  const buildEmbed = () =>
    generateSeasonBoxScoreEmbed(
      [...firstTableStats, ...secondTableStats],
      team,
      year,
      gamesCount,
      mode,
      selectedTeamColor
    );

  return (
    <div id="box-score" data-share-card className="mb-8">
      {/* Mobile: Header card (white) separate from tables */}
      {/* Desktop: Full card with header and tables together */}

      {/* Mobile-only header card */}
      <div className="md:hidden bg-white rounded-t-2xl shadow-sm border border-neutral-200 border-b-0 pt-4 px-6 pb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="headline text-[22px] font-bold text-ink">Box score (season)</h2>
          <div className="flex items-center gap-2">
            {/* Combined toggle buttons. Left out of a shared image: the
                table title already says which mode it shows. */}
            <div className="flex border border-neutral-300 rounded-lg overflow-hidden h-8" data-share-exclude>
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
            <ShareMenu title="Box score (season)" getEmbedCode={buildEmbed} />
          </div>
        </div>
      </div>

      {/* Desktop: Full card container */}
      <div className="md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-neutral-200 md:pt-5 md:px-6 md:pb-6">
        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <h2 className="headline text-[22px] font-bold text-ink">Box score (season)</h2>
          <div className="flex items-center gap-2">
            {/* Combined toggle buttons. Left out of a shared image: the
                table title already says which mode it shows. */}
            <div className="flex border border-neutral-300 rounded-lg overflow-hidden h-8" data-share-exclude>
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
            <ShareMenu title="Box score (season)" getEmbedCode={buildEmbed} />
          </div>
        </div>

        {/* Tables */}
        <div className="flex flex-col md:flex-row gap-0 md:gap-6">
          <div className="flex-1">
            <SeasonBoxScoreTable
              stats={firstTableStats}
              team={team}
              tableTitle={`${team} - ${year} Season (${mode === 'totals' ? 'Total' : 'Avg'})`}
              selectedTeamColor={selectedTeamColor}
              gamesCount={gamesCount}
              isFirst={true}
            />
          </div>
          <div className="flex-1">
            <SeasonBoxScoreTable
              stats={secondTableStats}
              team={team}
              tableTitle="Stats (cont'd)"
              selectedTeamColor={selectedTeamColor}
              gamesCount={gamesCount}
              isFirst={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonAdvancedBoxScore;
