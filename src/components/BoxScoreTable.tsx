import React from 'react';
import { BoxScoreStat } from '../hooks/useBoxScore';
import { getDisplayTeamColors } from '../utils/displayTeamColors';

interface BoxScoreTableProps {
  stats: BoxScoreStat[];
  team1Name: string;
  team2Name: string;
  tableTitle: string;
  selectedTeamColor: string;
  selectedOpponentColor: string;
  isFirst: boolean;
}

const BoxScoreTable: React.FC<BoxScoreTableProps> = ({ 
  stats, 
  team1Name, 
  team2Name, 
  tableTitle, 
  selectedTeamColor, 
  selectedOpponentColor,
  isFirst 
}) => {
  // Get team colors
  const team1Colors = getDisplayTeamColors(team1Name, selectedTeamColor);
  const team2Colors = getDisplayTeamColors(team2Name, selectedOpponentColor);
  
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
              style={{ borderBottomColor: team1Colors.success || '#6b7280' }}
            >
              {team1Name || 'Team 1'}
            </th>
            <th 
              className="px-4 py-3 text-center text-sm font-semibold border-b-4"
              style={{ borderBottomColor: team2Colors.success || '#6b7280' }}
            >
              {team2Name || 'Team 2'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {stats.map((stat, index) => (
            <tr key={stat.label} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
              <td className="px-4 py-3 text-sm font-medium text-neutral-900">{stat.label}</td>
              <td className="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">{stat.team1Value}</td>
              <td className="px-4 py-3 text-sm text-neutral-900 text-center font-semibold">{stat.team2Value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BoxScoreTable;