import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import BoxScoreTable from './BoxScoreTable';
import { BoxScoreStat } from '../hooks/useBoxScore';
import { getDisplayTeamColors } from '../utils/displayTeamColors';

// Generate box score embed HTML
const generateBoxScoreEmbed = (
  allStats: BoxScoreStat[],
  team1Name: string,
  team2Name: string,
  selectedTeamColor: string,
  selectedOpponentColor: string,
  currentParams?: any
): string => {
  const team1Colors = getDisplayTeamColors(team1Name, selectedTeamColor);
  const team2Colors = getDisplayTeamColors(team2Name, selectedOpponentColor);

  // Generate game URL - only include necessary parameters
  const gameUrl = currentParams ? (() => {
    const params = new URLSearchParams();
    // Only include the essential parameters that the GameSelector expects
    params.set('year', currentParams.year.toString());
    params.set('team', currentParams.team);
    if (currentParams.gameId) {
      params.set('gameId', currentParams.gameId.toString());
    }
    // Note: Do NOT include week, seasonType as they're not needed for the main app URL
    
    // Add color parameters if they're not default
    if (selectedTeamColor !== 'default') {
      params.set('teamColor', selectedTeamColor);
    }
    if (selectedOpponentColor !== 'default') {
      params.set('opponentColor', selectedOpponentColor);
    }
    
    return `https://graphingcollegefootball.com/?${params.toString()}`;
  })() : 'https://graphingcollegefootball.com';

  const statsRows = allStats.map((stat, index) => `
    <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}">
      <td class="px-4 py-3 text-sm font-medium text-neutral-900">${stat.label}</td>
      <td class="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">${stat.team1Value}</td>
      <td class="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">${stat.team2Value}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Box Score - ${team1Name} vs ${team2Name}</title>
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
            padding: 18px 24px 16px;
            border-bottom: 1px solid #e5e5e5;
            background: white;
        }
        .title {
            font-size: 18px;
            font-weight: 600;
            color: #171717;
            margin: 0;
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
            <h3 class="title">Box Score</h3>
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
                        <th style="border-bottom-color: ${team1Colors.success || '#6b7280'}; text-align: center;">${team1Name || 'Team 1'}</th>
                        <th style="border-bottom-color: ${team2Colors.success || '#6b7280'}; text-align: center;">${team2Name || 'Team 2'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${statsRows}
                </tbody>
            </table>
        </div>
        <div class="embed-footer">
            <div class="embed-footer-top">
                <a href="${gameUrl}" class="embed-footer-link" target="_blank">See all charts</a>
            </div>
        </div>
    </div>
</body>
</html>`;
};

interface BoxScoreContainerProps {
  firstTableStats: BoxScoreStat[];
  secondTableStats: BoxScoreStat[];
  team1Name: string;
  team2Name: string;
  selectedTeamColor: string;
  selectedOpponentColor: string;
  onCopyEmbed?: (message: string) => void;
  currentParams?: any;
}

const BoxScoreContainer: React.FC<BoxScoreContainerProps> = ({
  firstTableStats,
  secondTableStats,
  team1Name,
  team2Name,
  selectedTeamColor,
  selectedOpponentColor,
  onCopyEmbed,
  currentParams,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEmbed = async () => {
    // Generate box score embed HTML
    const embedHTML = generateBoxScoreEmbed(
      [...firstTableStats, ...secondTableStats],
      team1Name,
      team2Name,
      selectedTeamColor,
      selectedOpponentColor,
      currentParams
    );

    try {
      await navigator.clipboard.writeText(embedHTML);
      setCopied(true);
      onCopyEmbed?.('Embed code copied for Box Score');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
    }
  };


  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-neutral-900">Box Score</h2>
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
      <div className="flex flex-col md:flex-row gap-0 md:gap-6">
        <div className="flex-1">
          <BoxScoreTable
            stats={firstTableStats}
            team1Name={team1Name}
            team2Name={team2Name}
            tableTitle="Stats"
            selectedTeamColor={selectedTeamColor}
            selectedOpponentColor={selectedOpponentColor}
            isFirst={true}
          />
        </div>
        <div className="flex-1">
          <BoxScoreTable
            stats={secondTableStats}
            team1Name={team1Name}
            team2Name={team2Name}
            tableTitle="Stats (cont'd)"
            selectedTeamColor={selectedTeamColor}
            selectedOpponentColor={selectedOpponentColor}
            isFirst={false}
          />
        </div>
      </div>
    </div>
  );
};

export default BoxScoreContainer;