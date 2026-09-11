import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { PlayData } from '../types';
import { useChartData } from '../hooks/useChartData';
import { useToast } from '../hooks/useToast';
import { track } from '../utils/analytics';
import GameWaveChart, { GAME_WAVE_TITLE } from './GameWaveChart';
import ChartCard from './ChartCard';
import {
  createLineOptionsPlayNumberSRXR,
  createLineOptionsTeamPlay,
  createPlayMapOptions,
  createBarOptions,
  createDriveOptions,
  createPlayerOptions,
  createWinProbabilityOptions
} from '../utils/chartOptions';
import { initializeChartDefaults } from '../utils/chartConfig';
import { generateChartEmbed } from '../utils/chartEmbedGenerator';
import { BASE_DEFINITIONS } from '../utils/embedDefinitions';
import { CHART_HEIGHTS } from '../constants/chartDimensions';

// Initialize Chart.js defaults
initializeChartDefaults();

interface ChartsGridProps {
  plays: PlayData[];
  team: string;
  selectedTeamColor?: string;
  selectedOpponentColor?: string;
  currentParams?: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
    gameId?: string;
  } | null;
  winProbabilityData?: Record<string, any>[];
  rawApiData?: Record<string, any>[];
}

/** A chart as both a rendered node and everything its embed needs. */
interface ChartEntry {
  id: string;
  title: string;
  node: React.ReactNode;
  data: any;
  options: any;
  chartType: 'bar' | 'line';
  height?: number;
  mobileHeight?: number;
}

/** The Game Wave isn't a Chart.js chart, so it carries its own id for the
 *  copy-button state and the embed analytics event. */
const GAME_WAVE_ID = 'game-wave';

/** Chart-specific bullets for the embed's "Data definitions" accordion. */
const definitionsFor = (chartId: string): string[] => {
  if (chartId === 'win-probability') {
    return [
      '<strong>Win Probability:</strong> Likelihood of winning based on game situation',
      '<strong>Line Color:</strong> Gradient reflects which team is favored',
      '<strong>50% Line:</strong> Dashed line indicates even odds',
      '<strong>Data Source:</strong> <a href="https://collegefootballdata.com/win-probability" target="_blank" style="color: #525252; text-decoration: underline;">CollegeFootballData.com</a> win probability models',
    ];
  }
  if (chartId.includes('play-map')) {
    return [
      ...BASE_DEFINITIONS,
      '<strong>Play Map:</strong> Each point represents yards gained on a single play',
      '<strong>Circles:</strong> Rushing plays, <strong>Triangles:</strong> Passing plays',
    ];
  }
  if (chartId.includes('drive-metrics')) {
    return [
      ...BASE_DEFINITIONS,
      '<strong>Drive Metrics:</strong> Success and explosiveness rates calculated per drive',
      '<strong>Play counts:</strong> Gray bars show number of plays in each drive',
    ];
  }
  if (chartId.includes('rush-rate')) {
    return [
      ...BASE_DEFINITIONS,
      '<strong>Rush Rate:</strong> Percentage of offensive plays that are rushing attempts',
      '<strong>Gray area:</strong> Represents 50/50 balanced offense',
    ];
  }
  if (chartId.startsWith('top-')) {
    return BASE_DEFINITIONS;
  }
  if (chartId.endsWith('-bars') || chartId === 'overall-team-performance') {
    return [
      ...BASE_DEFINITIONS,
      '<strong># Plays:</strong> Numbers shown in bars represent total play counts',
      '<strong>NCAA Avg:</strong> Dashed line shows 42% (roughly NCAA average) success rate',
    ];
  }
  return [...BASE_DEFINITIONS, '<strong>Gray area:</strong> Represents 42% (roughly NCAA average) success rate'];
};

/** Team filter for the player charts. Module scope so it isn't remounted (and
 *  doesn't lose focus) on every parent render. */
const TeamFilterDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  teamName: string;
  opponentName: string;
  label: string;
}> = ({ value, onChange, teamName, opponentName, label }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={label}
    className="select-field w-auto py-1 pl-2.5 pr-8 text-[13px] text-neutral-700"
  >
    <option value="both">Both teams</option>
    <option value={teamName}>{teamName}</option>
    <option value={opponentName}>{opponentName}</option>
  </select>
);

const ChartsGrid: React.FC<ChartsGridProps> = ({
  plays,
  team,
  selectedTeamColor = 'default',
  selectedOpponentColor = 'default',
  currentParams = null,
  winProbabilityData = [],
  rawApiData = [],
}) => {
  const [copiedChart, setCopiedChart] = useState<string | null>(null);
  const { showToast: notify } = useToast();

  // Player chart team filters, seeded from the URL so shared links keep them.
  const initialTeamFilter = () =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('playerTeam') || 'both'
      : 'both';

  const [rushersTeamFilter, setRushersTeamFilter] = useState<string>(initialTeamFilter);
  const [passersTeamFilter, setPassersTeamFilter] = useState<string>(initialTeamFilter);
  const [receiversTeamFilter, setReceiversTeamFilter] = useState<string>(initialTeamFilter);

  // Reflect the filter in the URL only while all three agree, so the shared
  // link describes an unambiguous state.
  useEffect(() => {
    if (rushersTeamFilter !== passersTeamFilter || passersTeamFilter !== receiversTeamFilter) return;

    const urlParams = new URLSearchParams(window.location.search);
    if (rushersTeamFilter === 'both') {
      urlParams.delete('playerTeam');
    } else {
      urlParams.set('playerTeam', rushersTeamFilter);
    }
    const query = urlParams.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [rushersTeamFilter, passersTeamFilter, receiversTeamFilter]);

  const chartData = useChartData(plays, team, selectedTeamColor, selectedOpponentColor, winProbabilityData, rawApiData);

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
    createPlayerData,
    winProbabilityData: winProbChartData,
  } = chartData;

  // Options are pure functions of their inputs; rebuilding them on every
  // render handed 19 charts brand-new option objects on each filter change.
  const lineOptionsPlayNumberSRXR = useMemo(() => createLineOptionsPlayNumberSRXR(), []);
  const lineOptionsTeamPlay = useMemo(() => createLineOptionsTeamPlay(), []);
  const barOptions = useMemo(() => createBarOptions(), []);
  const playerOptions = useMemo(() => createPlayerOptions(), []);
  const winProbabilityOptions = useMemo(() => createWinProbabilityOptions(), []);
  const teamPlayMapOptions = useMemo(() => createPlayMapOptions(teamMinY, teamMaxY), [teamMinY, teamMaxY]);
  const opponentPlayMapOptions = useMemo(() => createPlayMapOptions(oppMinY, oppMaxY), [oppMinY, oppMaxY]);
  const driveOptions = useMemo(
    () => createDriveOptions(teamDriveData, opponentDriveData),
    [teamDriveData, opponentDriveData]
  );

  const filteredPlayers = (players: any[], teamFilter: string) =>
    teamFilter === 'both' ? players : players.filter(p => p.team === teamFilter);

  const gameSubtitle = (() => {
    if (!currentParams) return undefined;
    const teams = `${selectedTeam} vs. ${opponentTeam}`;
    const wallclock = plays[0]?.wallclock;
    if (wallclock) {
      const date = new Date(wallclock);
      if (!Number.isNaN(date.getTime())) {
        return `${teams} • ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
    return `${teams} • ${currentParams.year}`;
  })();

  /** "See all charts" target. Player charts pass their own filter so the link
   *  restores the view the embed shows, not whatever the rushers chart is on. */
  const gameUrlFor = (teamFilter?: string) => {
    if (!currentParams) return 'https://graphingcollegefootball.com';
    const params = new URLSearchParams({ year: String(currentParams.year), team: currentParams.team });
    if (currentParams.gameId) params.set('gameId', String(currentParams.gameId));
    if (selectedTeamColor !== 'default') params.set('teamColor', selectedTeamColor);
    if (selectedOpponentColor !== 'default') params.set('opponentColor', selectedOpponentColor);
    if (teamFilter && teamFilter !== 'both') params.set('playerTeam', teamFilter);
    return `https://graphingcollegefootball.com/?${params}`;
  };

  /** Put a finished embed on the clipboard and flash that chart's button. */
  const copyEmbedCode = async (
    chart: { id: string; title: string; chartType: string },
    embedCode: string
  ) => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedChart(chart.id);
      notify(`Embed code copied for ${chart.title}`);

      track('copy_embed', {
        event_category: 'user_interaction',
        event_label: `${chart.id}_${chart.title}`,
        custom_parameter_chart_id: chart.id,
        custom_parameter_chart_title: chart.title,
        custom_parameter_chart_type: chart.chartType,
        custom_parameter_team: currentParams?.team || '',
        custom_parameter_year: currentParams?.year || '',
        custom_parameter_week: currentParams?.week || '',
        custom_parameter_season_type: currentParams?.seasonType || '',
      });

      setTimeout(() => setCopiedChart(null), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      notify('Failed to copy embed code. Please try again.');
    }
  };

  /**
   * Copy an embed for a chart. The generic generator serializes the exact data
   * and options the chart is rendered with, so embeds can't drift from the app
   * the way the old hand-maintained template did.
   */
  const handleCopyEmbed = (chart: ChartEntry & { filterValue?: string }) =>
    copyEmbedCode(
      chart,
      generateChartEmbed({
        chartType: chart.chartType,
        data: chart.data,
        options: chart.options,
        title: chart.title,
        subtitle: gameSubtitle,
        sourceUrl: gameUrlFor(chart.filterValue),
        height: chart.height ?? CHART_HEIGHTS.DEFAULT_DESKTOP,
        mobileHeight: chart.mobileHeight ?? chart.height ?? CHART_HEIGHTS.DEFAULT_MOBILE,
        definitions: definitionsFor(chart.id),
      })
    );

  const hasWinProbability = Boolean(winProbChartData?.datasets?.length);

  const winProbabilityChart: ChartEntry = {
    id: 'win-probability',
    title: 'Win probability',
    mobileHeight: CHART_HEIGHTS.DEFAULT_MOBILE,
    node: <Line data={winProbChartData as any} options={winProbabilityOptions} />,
    data: winProbChartData,
    options: winProbabilityOptions,
    chartType: 'line',
  };

  const barChartData = useMemo(() => ({
    playType: createTeamVsOpponentBarData('playType'),
    quarter: createTeamVsOpponentBarData('quarter'),
    down: createTeamVsOpponentBarData('down'),
    redZone: createTeamVsOpponentBarData('redZone'),
    distance: createTeamVsOpponentBarData('distance'),
  }), [createTeamVsOpponentBarData]);

  const teamChartSpecs: Omit<ChartEntry, 'node'>[] = [
    { id: 'overall-team-performance', title: 'Overall team performance', data: overallTeamData, options: barOptions, chartType: 'bar' },
    { id: 'team-lines', title: 'SR and XR by team', data: teamLinesData, options: lineOptionsPlayNumberSRXR, chartType: 'line' },
    { id: 'team-play-type-lines', title: `SR by play type: ${selectedTeam}`, data: teamPlayTypeLinesData, options: lineOptionsTeamPlay, chartType: 'line' },
    { id: 'opponent-play-type-lines', title: `SR by play type: ${opponentTeam}`, data: opponentPlayTypeLinesData, options: lineOptionsTeamPlay, chartType: 'line' },
    { id: 'team-rush-rate', title: `Rush rate: ${selectedTeam}`, data: teamRushRateData, options: lineOptionsTeamPlay, chartType: 'line' },
    { id: 'opponent-rush-rate', title: `Rush rate: ${opponentTeam}`, data: opponentRushRateData, options: lineOptionsTeamPlay, chartType: 'line' },
    { id: 'team-play-map', title: `Play map: ${selectedTeam}`, data: teamPlayMapData, options: teamPlayMapOptions, chartType: 'line' },
    { id: 'opponent-play-map', title: `Play map: ${opponentTeam}`, data: opponentPlayMapData, options: opponentPlayMapOptions, chartType: 'line' },
    { id: 'team-drive-metrics', title: `SR, XR and play count by drive: ${selectedTeam}`, data: teamDriveChartData, options: driveOptions, chartType: 'bar' },
    { id: 'opponent-drive-metrics', title: `SR, XR and play count by drive: ${opponentTeam}`, data: opponentDriveChartData, options: driveOptions, chartType: 'bar' },
    { id: 'play-type-bars', title: 'SR and XR by play type', data: barChartData.playType, options: barOptions, chartType: 'bar' },
    { id: 'quarter-bars', title: 'SR and XR by quarter', data: barChartData.quarter, options: barOptions, chartType: 'bar' },
    { id: 'down-bars', title: 'SR and XR by down', data: barChartData.down, options: barOptions, chartType: 'bar' },
    { id: 'red-zone-bars', title: 'SR and XR by red zone', data: barChartData.redZone, options: barOptions, chartType: 'bar' },
    { id: 'distance-bars', title: 'SR and XR by distance to go', data: barChartData.distance, options: barOptions, chartType: 'bar' },
  ];

  const teamCharts: ChartEntry[] = teamChartSpecs.map(chart => ({
    ...chart,
    mobileHeight: CHART_HEIGHTS.DEFAULT_MOBILE,
    node:
      chart.chartType === 'bar' ? (
        <Bar data={chart.data} options={chart.options} />
      ) : (
        <Line data={chart.data} options={chart.options} />
      ),
  }));

  const playerCharts: (ChartEntry & {
    filterValue: string;
    onFilterChange: (value: string) => void;
  })[] = [
    {
      id: 'top-rushers',
      title: 'Top rushers',
      data: createPlayerData(filteredPlayers(allRushers, rushersTeamFilter), 'rush'),
      filterValue: rushersTeamFilter,
      onFilterChange: setRushersTeamFilter,
      height: CHART_HEIGHTS.PLAYER_RUSHERS,
      mobileHeight: CHART_HEIGHTS.PLAYER_RUSHERS,
    },
    {
      id: 'top-passers',
      title: 'Top passers',
      data: createPlayerData(filteredPlayers(allPassers, passersTeamFilter), 'pass'),
      filterValue: passersTeamFilter,
      onFilterChange: setPassersTeamFilter,
      height: CHART_HEIGHTS.PLAYER_PASSERS,
      mobileHeight: CHART_HEIGHTS.PLAYER_PASSERS,
    },
    {
      id: 'top-receivers',
      title: 'Top receivers',
      data: createPlayerData(filteredPlayers(allReceivers, receiversTeamFilter), 'receive'),
      filterValue: receiversTeamFilter,
      onFilterChange: setReceiversTeamFilter,
      height: CHART_HEIGHTS.PLAYER_RECEIVERS,
      mobileHeight: CHART_HEIGHTS.PLAYER_RECEIVERS,
    },
  ].map(chart => ({
    ...chart,
    options: playerOptions,
    chartType: 'bar' as const,
    node: <Bar data={chart.data as any} options={playerOptions} />,
  }));

  const sectionHeading = (text: string) => (
    <h2 className="rule-section headline mb-6 text-[22px] text-ink">
      {text}
    </h2>
  );

  return (
    <>

      <div>
        <section>
          {sectionHeading('Game charts')}

          <div className="mb-6">
            <GameWaveChart
              plays={plays}
              team={team}
              opponent={opponentTeam}
              teamColorId={selectedTeamColor}
              opponentColorId={selectedOpponentColor}
              rawPlays={rawApiData}
              subtitle={gameSubtitle}
              sourceUrl={gameUrlFor()}
              isCopied={copiedChart === GAME_WAVE_ID}
              onCopyEmbed={embedCode =>
                copyEmbedCode({ id: GAME_WAVE_ID, title: GAME_WAVE_TITLE, chartType: 'svg' }, embedCode)
              }
            />
          </div>

          <ChartCard
            title={winProbabilityChart.title}
            mobileHeight={winProbabilityChart.mobileHeight}
            onCopyEmbed={hasWinProbability ? () => handleCopyEmbed(winProbabilityChart) : undefined}
            isCopied={copiedChart === winProbabilityChart.id}
          >
            {hasWinProbability ? (
              winProbabilityChart.node
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <AlertCircle className="mb-3 h-8 w-8 text-neutral-400" />
                <p className="headline text-[18px] font-bold text-ink">
                  Win probability unavailable for this game
                </p>
                <p className="mt-1 text-sm text-byline">This data may not be available for all games</p>
              </div>
            )}
          </ChartCard>
        </section>

        <section>
          {sectionHeading('Team charts')}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {teamCharts.map(chart => (
              <ChartCard
                key={chart.id}
                title={chart.title}
                mobileHeight={chart.mobileHeight}
                onCopyEmbed={() => handleCopyEmbed(chart)}
                isCopied={copiedChart === chart.id}
              >
                {chart.node}
              </ChartCard>
            ))}
          </div>
        </section>

        <section>
          {sectionHeading('Player charts')}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Rushers and passers stack beside the full-height receivers chart */}
            <div className="space-y-6">
              {playerCharts.slice(0, 2).map(chart => (
                <ChartCard
                  key={chart.id}
                  title={chart.title}
                  height={chart.height}
                  mobileHeight={chart.mobileHeight}
                  onCopyEmbed={() => handleCopyEmbed(chart)}
                  isCopied={copiedChart === chart.id}
                  headerControl={
                    <TeamFilterDropdown
                      value={chart.filterValue}
                      onChange={chart.onFilterChange}
                      teamName={selectedTeam}
                      opponentName={opponentTeam}
                      label={`Filter ${chart.title.toLowerCase()} by team`}
                    />
                  }
                >
                  {chart.node}
                </ChartCard>
              ))}
            </div>

            {playerCharts.slice(2).map(chart => (
              <ChartCard
                key={chart.id}
                title={chart.title}
                height={chart.height}
                mobileHeight={chart.mobileHeight}
                onCopyEmbed={() => handleCopyEmbed(chart)}
                isCopied={copiedChart === chart.id}
                headerControl={
                  <TeamFilterDropdown
                    value={chart.filterValue}
                    onChange={chart.onFilterChange}
                    teamName={selectedTeam}
                    opponentName={opponentTeam}
                    label={`Filter ${chart.title.toLowerCase()} by team`}
                  />
                }
              >
                {chart.node}
              </ChartCard>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

export default ChartsGrid;
