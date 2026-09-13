/**
 * Down-and-distance formatting for chart tooltips.
 *
 * The situation a play snapped from ("2nd & 7") is the context that makes a
 * play text readable, so every play-level tooltip carries it on its own line.
 * Values come from the play-by-play feed, where `down`/`distance` are always
 * the pre-snap state of the play they belong to.
 */

const ORDINALS = ['', '1st', '2nd', '3rd', '4th'];

/**
 * Format a play's pre-snap situation, e.g. "3rd & 2" or "1st & goal".
 *
 * Returns '' for anything without a real down — kickoffs, extra points,
 * timeouts and end-of-period markers all come back as down 0 — so callers can
 * treat the empty string as "no line to show".
 *
 * `yardsToGoal` is optional and only used to spot goal-to-go, where the sticks
 * are the goal line rather than a distance.
 */
export const formatDownDistance = (
  down: number | null | undefined,
  distance: number | null | undefined,
  yardsToGoal?: number | null
): string => {
  if (!down || down < 1 || down > 4) return '';

  const ordinal = ORDINALS[down];
  if (distance === null || distance === undefined) return ordinal;

  // Goal to go: CFBD sets distance to the yardage left to the end zone, so the
  // two match (or distance has been zeroed out on the goal line itself).
  const goalToGo =
    distance <= 0 || (yardsToGoal !== null && yardsToGoal !== undefined && distance >= yardsToGoal);

  return goalToGo ? `${ordinal} & goal` : `${ordinal} & ${distance}`;
};
