/**
 * Chart data for the passing charts.
 *
 * These live here rather than in `chartHelpers.ts` on purpose: the existing
 * chart helpers, options and dimensions are deliberately tuned and off-limits
 * (see CLAUDE.md). The depth bars below reproduce the exact dataset shape
 * `createTeamVsOpponentBarData` emits — same stacks, same NCAA reference line,
 * same "# Plays" legend placeholder — so a pass-depth chart sitting next to the
 * by-down chart is visually indistinguishable from its neighbours.
 *
 * Every callback stored on chart data here reads only from its arguments and
 * from values baked in at copy time, so `generateChartEmbed` can serialize it.
 */
import { NCAA_AVERAGE_SR } from './chartConfig';
import { PassPlay, PassingSplit, groupByPassDepth, DEPTH_LABELS } from './passing';

/** The slice of a chartjs-plugin-datalabels context these formatters read. */
interface DatalabelContext {
  dataIndex: number;
}

/** The player-chart color triple, as `displayTeamColors` hands it over. */
interface PlayerColorTriple {
  success: string;
  explosive: string;
  light: string;
}

/** Player names get long; the y-axis has one line per player. */
const truncateName = (name: string, maxLength = 14): string =>
  name.length <= maxLength ? name : `${name.slice(0, maxLength - 1)}…`;

/**
 * Team vs. opponent SR and XR split by pass depth.
 *
 * Mirrors the shape of the other by-category bars so it can share
 * `createBarOptions` and sit in the same grid row.
 */
export const createDepthBarData = (
  teamRows: PassPlay[],
  opponentRows: PassPlay[],
  team: string,
  opponentTeam: string,
  teamColors: { success: string; explosive: string },
  opponentColors: { success: string; explosive: string }
) => {
  const teamData = groupByPassDepth(teamRows);
  const opponentData = groupByPassDepth(opponentRows);
  const labels = [...DEPTH_LABELS];

  const pick = (rows: ReturnType<typeof groupByPassDepth>, key: 'sr' | 'xr' | 'count') =>
    labels.map(label => {
      const found = rows.find(d => d.label === label);
      return found ? found[key] : 0;
    });

  const teamCounts = pick(teamData, 'count');
  const oppCounts = pick(opponentData, 'count');

  return {
    labels,
    datasets: [
      {
        data: pick(teamData, 'xr'),
        stack: 'Team',
        label: `${team} XR`,
        backgroundColor: teamColors.explosive,
        datalabels: { display: false },
      },
      {
        data: pick(teamData, 'sr'),
        stack: 'Team',
        label: `${team} SR`,
        backgroundColor: teamColors.success,
        datalabels: {
          display: true,
          formatter: (_value: number, context: DatalabelContext) => teamCounts[context.dataIndex],
        },
      },
      {
        data: pick(opponentData, 'xr'),
        stack: 'Opponent',
        label: `${opponentTeam} XR`,
        backgroundColor: opponentColors.explosive,
        datalabels: { display: false },
      },
      {
        data: pick(opponentData, 'sr'),
        stack: 'Opponent',
        label: `${opponentTeam} SR`,
        backgroundColor: opponentColors.success,
        datalabels: {
          display: true,
          formatter: (_value: number, context: DatalabelContext) => oppCounts[context.dataIndex],
        },
      },
      {
        type: 'line' as const,
        data: Array(labels.length).fill(NCAA_AVERAGE_SR),
        label: 'NCAA Avg SR',
        borderColor: '#757575',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        datalabels: { display: false },
      },
      {
        // The shared legend builder in chartOptions.ts special-cases this exact
        // label to draw the white "count" swatch, so it has to stay '# Plays'
        // even though these counts are attempts. The embed's definitions spell
        // the distinction out.
        type: 'line' as const,
        data: Array(labels.length).fill(null),
        label: '# Plays',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgba(0, 0, 0, 0)',
        borderWidth: 0,
        pointRadius: 0,
        showLine: false,
        fill: false,
        datalabels: { display: false },
      },
    ],
  };
};

/**
 * Per-player air yards and yards after the catch.
 *
 * Three segments, in the order the ball travels: air yards that were caught,
 * yards added after the catch, then air yards thrown on passes that fell
 * incomplete. The first two sum to yards gained; the third shows how much was
 * being attempted but not completed, which is the whole reason to separate
 * them. Segment colors follow the site's player-chart triple.
 */
export const createDepthYacData = (players: (PassingSplit & { teamColors?: PlayerColorTriple })[]) => {
  const labels = players.map(p => truncateName(p.name));
  const meta = players.map(p => ({
    attempts: p.attempts,
    completions: p.completions,
    completionRate: p.completionRate,
    aDOT: p.aDOT,
  }));

  return {
    labels,
    meta,
    datasets: [
      {
        label: 'Air yards (completed)',
        data: players.map(p => p.airYardsCompleted),
        backgroundColor: players.map(p => p.teamColors?.success ?? 'rgba(120,113,108,0.8)'),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Yards after catch',
        data: players.map(p => p.yardsAfterCatch),
        backgroundColor: players.map(p => p.teamColors?.explosive ?? 'rgba(68,64,60,0.9)'),
        borderColor: '#374151',
        borderWidth: 1,
      },
      {
        label: 'Air yards (incomplete)',
        data: players.map(p => p.airYardsIncomplete),
        backgroundColor: players.map(p => p.teamColors?.light ?? 'rgba(214,209,200,0.7)'),
        borderColor: '#374151',
        borderWidth: 1,
      },
    ],
  };
};

/**
 * Attempts and completion rate for one player, for a chart label.
 * Kept here so the Games and Trends charts word it identically.
 */
export const describeProduction = (split: PassingSplit): string =>
  `${split.completions}/${split.attempts} · ${Math.round(split.completionRate * 100)}% · ${split.aDOT.toFixed(1)} aDOT`;
