import React from 'react';
import BoxScoreTable from './BoxScoreTable';
import { BoxScoreStat } from '../hooks/useBoxScore';

interface BoxScoreContainerProps {
  firstTableStats: BoxScoreStat[];
  secondTableStats: BoxScoreStat[];
  team1Name: string;
  team2Name: string;
  overrideTeam1ToGray: boolean;
  overrideTeam2ToGray: boolean;
}

const BoxScoreContainer: React.FC<BoxScoreContainerProps> = ({
  firstTableStats,
  secondTableStats,
  team1Name,
  team2Name,
  overrideTeam1ToGray,
  overrideTeam2ToGray,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 pt-4 px-4 pb-4 sm:pt-5 sm:px-6 sm:pb-6 mb-8">
      <h2 className="text-xl font-semibold text-neutral-900 mb-6">Box Score</h2>
      <div className="flex flex-col md:flex-row gap-0 md:gap-6">
        <div className="flex-1">
          <BoxScoreTable
            stats={firstTableStats}
            team1Name={team1Name}
            team2Name={team2Name}
            tableTitle="Stats"
            overrideTeam1ToGray={overrideTeam1ToGray}
            overrideTeam2ToGray={overrideTeam2ToGray}
            isFirst={true}
          />
        </div>
        <div className="flex-1">
          <BoxScoreTable
            stats={secondTableStats}
            team1Name={team1Name}
            team2Name={team2Name}
            tableTitle="Stats (cont'd)"
            overrideTeam1ToGray={overrideTeam1ToGray}
            overrideTeam2ToGray={overrideTeam2ToGray}
            isFirst={false}
          />
        </div>
      </div>
    </div>
  );
};

export default BoxScoreContainer;