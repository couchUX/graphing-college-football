// Chart dimension constants
// These control the heights of charts throughout the app and in embeds
// Adjust these values to change chart heights globally

export const CHART_HEIGHTS = {
  // Default chart heights (Win Probability + Team charts)
  DEFAULT_DESKTOP: 325,  // px
  DEFAULT_MOBILE: 280,   // px - adjust this to make charts shorter on mobile

  // Season trends line charts (one x-axis label per opponent)
  // These need extra height in embeds: the rotated opponent labels eat a big
  // chunk of the container, leaving the plot area cramped at the default height
  TRENDS_LINE_DESKTOP: 440,
  TRENDS_LINE_MOBILE: 360,

  // Player chart heights (these have specific heights and are not affected by DEFAULT values)
  PLAYER_RUSHERS: 372,
  PLAYER_PASSERS: 280,
  PLAYER_RECEIVERS: 624,
};
