import React from 'react';
import { BoxScoreStat } from '../hooks/useBoxScore';
import { getDisplayTeamColors } from '../utils/displayTeamColors';

interface BoxScoreTableProps {
  stats: BoxScoreStat[];
  team1Name: string;
  team2Name: string;
  tableTitle: string;
  overrideTeam1ToGray: boolean;
  overrideTeam2ToGray: boolean;
}

const BoxScoreTable: React.FC<BoxScoreTableProps> = ({ 
  stats, 
  team1Name, 
  team2Name, 
  tableTitle, 
  overrideTeam1ToGray, 
  overrideTeam2ToGray 
}) => {
  // Get team colors
  const team1Colors = getDisplayTeamColors(team1Name, overrideTeam1ToGray);
  const team2Colors = getDisplayTeamColors(team2Name, overrideTeam2ToGray);
  
  return (
    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      <table className="min-w-full">
        <thead>
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