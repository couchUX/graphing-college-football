import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { AveragedBoxScoreStat, BoxScoreMode } from '../utils/seasonBoxScoreMetrics';
import { getDisplayTeamColors } from '../utils/displayTeamColors';

// Generate season box score embed HTML
const generateSeasonBoxScoreEmbed = (
  allStats: AveragedBoxScoreStat[],
  teamName: string,
  year: number,
  gamesCount: number,
  mode: BoxScoreMode,
  selectedTeamColor: string
): string => {
  const teamColors = getDisplayTeamColors(teamName, selectedTeamColor);
  const oppColors = {
    success: '#9CA3AF',
    explosive: '#6B7280',
    light: '#F3F4F6',
    colorDark: '#4B5563'
  };

  const modeLabel = mode === 'totals' ? 'Totals' : 'Averages';
  const subtitle = `${teamName} - ${year} Season (${gamesCount} games)`;

  // Generate URL to trends page
  const trendsUrl = (() => {
    const params = new URLSearchParams();
    params.set('year', year.toString());
    params.set('team', teamName);
    if (selectedTeamColor !== 'default') {
      params.set('teamColor', selectedTeamColor);
    }
    return `https://graphingcollegefootball.com/trends?${params.toString()}`;
  })();

  const statsRows = allStats.map((stat, index) => `
    <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}">
      <td class="px-4 py-3 text-sm font-medium text-neutral-900">${stat.label}</td>
      <td class="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">${stat.teamValue}</td>
      <td class="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">${stat.oppValue}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Season Box Score - ${teamName} ${year}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
            background: #f8fafc;
        }
        .embed-container {
            background: white;
            border-radius: 12px;
            border: 1px solid #e5e5e5;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            max-width: 800px;
            margin: 0 auto;
            padding: 0;
        }
        .header {
            padding: 18px 24px 14px;
            border-bottom: 1px solid #e5e5e5;
            background: white;
        }
        .title {
            font-size: 18px;
            font-weight: 600;
            color: #171717;
            margin: 0;
        }
        .subtitle {
            font-size: 11px;
            font-weight: 400;
            color: #737373;
            margin: 4px 0 0 0;
        }
        .table-wrapper {
            padding: 0;
        }
        table {
            min-width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
        }
        .col-stat { width: auto; }
        .col-team { width: 140px; }
        thead tr {
            background-color: #525252;
            color: white;
        }
        th {
            padding: 12px 16px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            border-bottom: 4px solid #475569;
            text-align: center;
        }
        th.stat-header {
            text-align: left;
        }
        tbody tr {
            border-bottom: 1px solid #e5e5e5;
        }
        .bg-white {
            background-color: #ffffff;
        }
        .bg-neutral-50 {
            background-color: #fafafa;
        }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .font-medium { font-weight: 500; }
        .font-semibold { font-weight: 600; }
        .text-neutral-900 { color: #171717; }
        .text-center { text-align: center; }
        .embed-footer {
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #737373;
        }
        .embed-footer-top {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 12px 16px;
        }
        .embed-footer-link {
            color: #737373;
            text-decoration: none;
            font-weight: 500;
        }
        .embed-footer-link:hover {
            color: #525252;
            text-decoration: underline;
        }

        @media (max-width: 640px) {
            .header { padding: 12px 16px; }
            th, td { padding: 8px 12px; }
            .title { font-size: 16px; }
            .embed-footer-top { padding: 8px 12px; }
            .col-team { width: 80px; }
            th, td { font-size: 13px; }
        }
    </style>
</head>
<body>
    <div class="embed-container">
        <div class="header">
            <h3 class="title">Season Box Score (${modeLabel})</h3>
            <p class="subtitle">${subtitle}</p>
        </div>
        <div class="table-wrapper">
            <table>
                <colgroup>
                    <col class="col-stat" />
                    <col class="col-team" />
                    <col class="col-team" />
                </colgroup>
                <thead>
                    <tr>
                        <th class="stat-header">Stats</th>
                        <th style="border-bottom-color: ${teamColors.success || '#6b7280'}; text-align: center;">${teamName}</th>
                        <th style="border-bottom-color: ${oppColors.success}; text-align: center;">Opponents</th>
                    </tr>
                </thead>
                <tbody>
                    ${statsRows}
                </tbody>
            </table>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${trendsUrl}" class="embed-footer-link" target="_blank">See all charts</a>
            </div>
        </div>
    </div>
</body>
</html>`;
};

interface SeasonBoxScoreTableProps {
  stats: AveragedBoxScoreStat[];
  team: string;
  tableTitle: string;
  selectedTeamColor: string;
  gamesCount: number;
  isFirst: boolean;
}

const SeasonBoxScoreTable: React.FC<SeasonBoxScoreTableProps> = ({
  stats,
  team,
  tableTitle,
  selectedTeamColor,
  gamesCount,
  isFirst
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
              style={{ borderBottomColor: oppColors.success }}
            >
              Opponents
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
  const [copied, setCopied] = useState(false);

  const handleCopyEmbed = async () => {
    // Generate season box score embed HTML
    const embedHTML = generateSeasonBoxScoreEmbed(
      [...firstTableStats, ...secondTableStats],
      team,
      year,
      gamesCount,
      mode,
      selectedTeamColor
    );

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
      {/* Mobile: Header card (white) separate from tables */}
      {/* Desktop: Full card with header and tables together */}

      {/* Mobile-only header card */}
      <div className="md:hidden bg-white rounded-t-2xl shadow-sm border border-neutral-200 border-b-0 pt-4 px-6 pb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
          <div className="flex items-center gap-2">
            {/* Combined toggle buttons */}
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
            <button
              onClick={handleCopyEmbed}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copied
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copied ? "Copied!" : "Copy embed code"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Full card container */}
      <div className="md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-neutral-200 md:pt-5 md:px-6 md:pb-6">
        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">Box Score (Season)</h2>
          <div className="flex items-center gap-2">
            {/* Combined toggle buttons */}
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
            <button
              onClick={handleCopyEmbed}
              className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                copied
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
              title={copied ? "Copied!" : "Copy embed code"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-neutral-600" />
              )}
            </button>
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
