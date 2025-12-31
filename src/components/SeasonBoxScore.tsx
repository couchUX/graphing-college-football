import React from 'react';
import { PerGameMetric } from '../types';

interface SeasonBoxScoreProps {
  team: string;
  year: number;
  perGameMetrics: PerGameMetric[];
  teamColors: {
    success: string;
    explosive: string;
    light: string;
    colorDark: string;
  };
}

const SeasonBoxScore: React.FC<SeasonBoxScoreProps> = ({
  team,
  year,
  perGameMetrics,
  teamColors
}) => {
  if (!perGameMetrics || perGameMetrics.length === 0) return null;

  // Calculate averages
  const avgTeamSR = perGameMetrics.reduce((sum, g) => sum + g.teamSR, 0) / perGameMetrics.length;
  const avgTeamXR = perGameMetrics.reduce((sum, g) => sum + g.teamXR, 0) / perGameMetrics.length;
  const avgOppSR = perGameMetrics.reduce((sum, g) => sum + g.oppSR, 0) / perGameMetrics.length;
  const avgOppXR = perGameMetrics.reduce((sum, g) => sum + g.oppXR, 0) / perGameMetrics.length;

  const totalTeamPlays = perGameMetrics.reduce((sum, g) => sum + g.teamPlays, 0);
  const avgTeamPlays = totalTeamPlays / perGameMetrics.length;
  const totalOppPlays = perGameMetrics.reduce((sum, g) => sum + g.oppPlays, 0);
  const avgOppPlays = totalOppPlays / perGameMetrics.length;

  const totalTeamScore = perGameMetrics.reduce((sum, g) => sum + g.teamScore, 0);
  const avgTeamScore = totalTeamScore / perGameMetrics.length;
  const totalOppScore = perGameMetrics.reduce((sum, g) => sum + g.oppScore, 0);
  const avgOppScore = totalOppScore / perGameMetrics.length;

  const wins = perGameMetrics.filter(g => g.teamScore > g.oppScore).length;
  const losses = perGameMetrics.filter(g => g.teamScore < g.oppScore).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-neutral-900">
          Season Averages - {team} ({year})
        </h3>
        <p className="text-sm text-neutral-600">
          {wins}-{losses} record across {perGameMetrics.length} games
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-200">
              <th className="text-left py-2 font-semibold text-neutral-700">Team</th>
              <th className="text-center py-2 font-semibold text-neutral-700">Avg Score</th>
              <th className="text-center py-2 font-semibold text-neutral-700">Avg Plays</th>
              <th className="text-center py-2 font-semibold text-neutral-700">Avg SR</th>
              <th className="text-center py-2 font-semibold text-neutral-700">Avg XR</th>
            </tr>
          </thead>
          <tbody>
            {/* Team Row */}
            <tr className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="py-3 font-medium" style={{ color: teamColors.colorDark }}>
                {team}
              </td>
              <td className="text-center py-3 font-semibold text-neutral-900">
                {avgTeamScore.toFixed(1)}
              </td>
              <td className="text-center py-3 text-neutral-700">
                {avgTeamPlays.toFixed(1)}
              </td>
              <td className="text-center py-3">
                <span
                  className="inline-block px-2 py-1 rounded text-sm font-medium"
                  style={{
                    backgroundColor: teamColors.light,
                    color: teamColors.colorDark
                  }}
                >
                  {(avgTeamSR * 100).toFixed(1)}%
                </span>
              </td>
              <td className="text-center py-3">
                <span
                  className="inline-block px-2 py-1 rounded text-sm font-medium"
                  style={{
                    backgroundColor: teamColors.light,
                    color: teamColors.colorDark
                  }}
                >
                  {(avgTeamXR * 100).toFixed(1)}%
                </span>
              </td>
            </tr>

            {/* Opponent Row */}
            <tr className="hover:bg-neutral-50">
              <td className="py-3 font-medium text-neutral-600">
                All Opponents
              </td>
              <td className="text-center py-3 font-semibold text-neutral-900">
                {avgOppScore.toFixed(1)}
              </td>
              <td className="text-center py-3 text-neutral-700">
                {avgOppPlays.toFixed(1)}
              </td>
              <td className="text-center py-3">
                <span className="inline-block px-2 py-1 rounded text-sm font-medium bg-neutral-100 text-neutral-700">
                  {(avgOppSR * 100).toFixed(1)}%
                </span>
              </td>
              <td className="text-center py-3">
                <span className="inline-block px-2 py-1 rounded text-sm font-medium bg-neutral-100 text-neutral-700">
                  {(avgOppXR * 100).toFixed(1)}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SeasonBoxScore;
