import React from 'react';
import { Copy } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { PlayData } from '../types';
import { useChartData } from '../hooks/useChartData';
import {
  createLineOptionsPlayNumberSRXR,
  createLineOptionsTeamPlay,
  createPlayMapOptions,
  createBarOptions,
  createDriveOptions,
  createPlayerOptions
} from '../utils/chartOptions';
import { initializeChartDefaults } from '../utils/chartConfig';

// Initialize Chart.js defaults
initializeChartDefaults();

interface ChartsGridProps {
  plays: PlayData[];
  team: string;
  overrideTeam1ToGray?: boolean;
  overrideTeam2ToGray?: boolean;
}

const ChartsGrid: React.FC<ChartsGridProps> = ({ plays, team, overrideTeam1ToGray = false, overrideTeam2ToGray = false }) => {
  const handleCopyEmbed = (chartId: string, title: string) => {
    const embedCode = `<iframe src="https://your-domain.com/embed/chart/${chartId}" width="600" height="400" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    console.log(`Embed code copied for: ${title}`);
  };

  const chartData = useChartData(plays, team, overrideTeam1ToGray, overrideTeam2ToGray);
  const {
    team: selectedTeam,
    opponentTeam,
    overallTeamData,
    teamLinesData,
    teamPlayTypeLinesData,
    opponentPlayTypeLinesData,
    teamRushRateData,
    opponentRushRateData,
    teamPlayMapData,
    opponentPlayMapData,
    teamDriveChartData,
    opponentDriveChartData,
    teamMinY,
    teamMaxY,
    oppMinY,
    oppMaxY,
    teamDriveData,
    opponentDriveData,
    allRushers,
    allPassers,
    allReceivers,
    createTeamVsOpponentBarData,
    createPlayerData
  } = chartData;

  // Create chart options
  const lineOptionsPlayNumberSRXR = createLineOptionsPlayNumberSRXR();
  const lineOptionsTeamPlay = createLineOptionsTeamPlay();
  const barOptions = createBarOptions();
  const teamPlayMapOptions = createPlayMapOptions(teamMinY, teamMaxY);
  const opponentPlayMapOptions = createPlayMapOptions(oppMinY, oppMaxY);
  const driveOptions = createDriveOptions(teamDriveData, opponentDriveData);
  const playerOptions = createPlayerOptions();

  const teamCharts = [
    {
      id: 'overall-team-performance',
      title: 'Overall Team Performance',
      component: <Bar data={overallTeamData as any} options={barOptions} />
    },
    {
      id: 'team-lines',
      title: 'SR and XR by Team',
      component: <Line data={teamLinesData} options={lineOptionsPlayNumberSRXR} />
    },
    {
      id: 'team-play-type-lines',
      title: `SR by Play Type: ${selectedTeam}`,
      component: <Line data={teamPlayTypeLinesData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'opponent-play-type-lines',
      title: `SR by Play Type: ${opponentTeam}`,
      component: <Line data={opponentPlayTypeLinesData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'team-rush-rate',
      title: `Rush Rate: ${selectedTeam}`,
      component: <Line data={teamRushRateData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'opponent-rush-rate',
      title: `Rush Rate: ${opponentTeam}`,
      component: <Line data={opponentRushRateData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'team-play-map',
      title: `Play Map: ${selectedTeam}`,
      component: <Line data={teamPlayMapData} options={teamPlayMapOptions} />
    },
    {
      id: 'opponent-play-map',
      title: `Play Map: ${opponentTeam}`,
      component: <Line data={opponentPlayMapData} options={opponentPlayMapOptions} />
    },
    {
      id: 'team-drive-metrics',
      title: `SR, XR, and Play Count by Drive: ${selectedTeam}`,
      component: <Bar data={teamDriveChartData} options={driveOptions} />
    },
    {
      id: 'opponent-drive-metrics',
      title: `SR, XR, and Play Count by Drive: ${opponentTeam}`,
      component: <Bar data={opponentDriveChartData} options={driveOptions} />
    },
    {
      id: 'play-type-bars',
      title: 'SR and XR by Play Type (Bar Chart)',
      component: <Bar data={createTeamVsOpponentBarData('playType') as any} options={barOptions} />
    },
    {
      id: 'quarter-bars',
      title: 'SR and XR by Quarter',
      component: <Bar data={createTeamVsOpponentBarData('quarter') as any} options={barOptions} />
    },
    {
      id: 'down-bars',
      title: 'SR and XR by Down',
      component: <Bar data={createTeamVsOpponentBarData('down') as any} options={barOptions} />
    },
    {
      id: 'red-zone-bars',
      title: 'SR and XR by Red Zone',
      component: <Bar data={createTeamVsOpponentBarData('redZone') as any} options={barOptions} />
    },
    {
      id: 'distance-bars',
      title: 'SR and XR by Distance to Go',
      component: <Bar data={createTeamVsOpponentBarData('distance') as any} options={barOptions} />
    }
  ];

  const playerCharts = [
    {
      id: 'top-rushers',
      title: 'Top rushers',
      component: <Bar data={createPlayerData(allRushers, 'rush') as any} options={playerOptions} />
    },
    {
      id: 'top-passers',
      title: 'Top passers',
      component: <Bar data={createPlayerData(allPassers, 'pass') as any} options={playerOptions} />
    },
    {
      id: 'top-receivers',
      title: 'Top receivers',
      component: <Bar data={createPlayerData(allReceivers, 'receive') as any} options={playerOptions} />
    }
  ];

  return (
    <div className="space-y-8">
      {/* Team Charts Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Team charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {teamCharts.map((chart) => (
            <div key={chart.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {chart.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(chart.id, chart.title)}
                  className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Copy embed code"
                >
                  <Copy className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {chart.component}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player Charts Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Player charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Rushers and Passers stacked */}
          <div className="space-y-6">
            {/* Top Rushers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {playerCharts[0].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[0].id, playerCharts[0].title)}
                  className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Copy embed code"
                >
                  <Copy className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {playerCharts[0].component}
                </div>
              </div>
            </div>

            {/* Top Passers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {playerCharts[1].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[1].id, playerCharts[1].title)}
                  className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Copy embed code"
                >
                  <Copy className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {playerCharts[1].component}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Receivers spanning full height */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {playerCharts[2].title}
                </h3>
              </div>
              <button
                onClick={() => handleCopyEmbed(playerCharts[2].id, playerCharts[2].title)}
                className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Copy embed code"
              >
                <Copy className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="h-[41rem]">
                {playerCharts[2].component}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartsGrid;