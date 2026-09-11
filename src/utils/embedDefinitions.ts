/**
 * Copy shared by every embed's "Data definitions" accordion. Kept here rather
 * than in a component so the Chart.js embeds and the Game Wave embed describe
 * the same metrics the same way.
 */

export const SP_LINK =
  '<a href="https://www.sbnation.com/college-football/2017/10/13/16457830/college-football-advanced-stats-analytics-rankings" target="_blank" style="color: #525252; text-decoration: underline;">the SP+ analytic system</a>';

export const SUCCESSFUL_PLAY_DEF =
  '<strong>Successful play:</strong> Gains enough needed yards (50% 1st down, 70% on 2nd, 100% on 3rd/4th)';

export const BASE_DEFINITIONS = [
  `Based roughly on ${SP_LINK}`,
  SUCCESSFUL_PLAY_DEF,
  '<strong>Success Rate (SR):</strong> Percentage of plays that were successful',
  '<strong>Explosiveness Rate (XR):</strong> Percentage of plays gaining 15+ yards',
];
