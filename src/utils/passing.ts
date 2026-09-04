/**
 * Joining CFBD pass attempts onto our processed plays.
 *
 * The passing endpoints carry depth and yards-after-catch but no success or
 * explosiveness; `processPlayData` carries success and explosiveness but knows
 * nothing about where the ball went. Both key on the same play ID, so joining
 * them gives every chart on this page both halves without changing either
 * definition.
 *
 * Coverage is the thing to watch. Air yards and location are charting-derived
 * upstream and are not present on every attempt (the API says so itself via its
 * `*AttemptsAvailable` counts). Rather than draw a confident-looking chart from
 * a third of the attempts, callers check `meetsCoverageFloor()` and hide the
 * chart when the data isn't there.
 */
import { PlayData } from '../types';
import { PassingPlay, PassDepth } from '../services/passingApi';

/** A pass attempt with our own success/explosiveness attached from `/plays`. */
export interface PassPlay {
  playId: string;
  gameId: number;
  offense: string;
  defense: string;
  down: number;
  distance: number;
  quarter: number;
  passer: string | null;
  passerId: string | null;
  target: string | null;
  targetId: string | null;
  outcome: PassingPlay['outcome'];
  airYards: number | null;
  yardsAfterCatch: number | null;
  totalYards: number | null;
  depth: PassDepth | null;
  direction: PassingPlay['passDirection'];
  location: PassingPlay['passLocation'];
  /** True when the throw was never a real attempt at a receiver. */
  isDeadBall: boolean;
  /** From the joined play, not the passing endpoint. */
  success: boolean;
  explosiveness: boolean;
  /** False when no play matched, so success/explosiveness are unknown. */
  matched: boolean;
}

export interface PassingCoverage {
  /** Attempts left after dropping unparseable rows. */
  attempts: number;
  /** Attempts that found their play, so carry success and explosiveness. */
  matched: number;
  /** Attempts carrying air yards (the denominator for depth charts). */
  withAirYards: number;
  /** Attempts carrying a six-zone location. */
  withLocation: number;
  /** Completions carrying yards after catch. */
  withYac: number;
}

export interface JoinedPassing {
  rows: PassPlay[];
  coverage: PassingCoverage;
}

/**
 * Below this share of attempts carrying air yards, the depth charts hide rather
 * than draw. Older seasons may have no charting data at all, and a bar built
 * from a handful of attempts reads as fact when it isn't.
 */
export const COVERAGE_FLOOR = 0.6;

export const meetsCoverageFloor = (coverage: PassingCoverage | undefined): boolean =>
  Boolean(coverage && coverage.attempts > 0 && coverage.withAirYards / coverage.attempts >= COVERAGE_FLOOR);

/** "412 of 480 attempts charted" — for a chart subtitle or an embed footnote. */
export const describeCoverage = (coverage: PassingCoverage | undefined): string => {
  if (!coverage || coverage.attempts === 0) return 'No charted pass attempts';
  return `${coverage.withAirYards} of ${coverage.attempts} attempts charted`;
};

/**
 * Why a passing chart has nothing to draw, for the placeholder that replaces
 * it. Worth distinguishing: no data at all usually means the season predates
 * the charting, while partial data means the throws are there but too few carry
 * a depth to average honestly.
 */
export const explainMissingCoverage = (coverage: PassingCoverage | undefined): string => {
  if (!coverage || coverage.attempts === 0) {
    return 'Depth and yards-after-catch data is not available for every season or game';
  }
  return (
    `Only ${coverage.withAirYards} of ${coverage.attempts} pass attempts carry depth data — ` +
    `too few to chart without misleading (${Math.round(COVERAGE_FLOOR * 100)}% needed)`
  );
};

/**
 * Join attempts to plays on the play ID.
 *
 * Unparseable rows are dropped outright. Spikes, throwaways and intentional
 * grounding are kept — they are attempts and belong in a completion-rate
 * denominator — but flagged so depth and location aggregates can leave them
 * out, since none of them were aimed at a receiver.
 */
export const joinPassingToPlays = (plays: PlayData[], passes: PassingPlay[]): JoinedPassing => {
  const playById = new Map<string, PlayData>();
  plays.forEach(play => playById.set(String(play.id), play));

  const rows: PassPlay[] = [];

  passes.forEach(pass => {
    if (pass.parseStatus === 'invalid') return;

    const play = playById.get(String(pass.playId));
    const isDeadBall = pass.isSpike || pass.isThrowaway || pass.isIntentionalGrounding;

    rows.push({
      playId: String(pass.playId),
      gameId: pass.gameId,
      offense: pass.offense,
      defense: pass.defense,
      down: pass.down,
      distance: pass.distance,
      quarter: play?.quarter ?? pass.period,
      passer: pass.passer,
      passerId: pass.passerId,
      target: pass.target,
      targetId: pass.targetId,
      outcome: pass.outcome,
      airYards: pass.airYards,
      yardsAfterCatch: pass.yardsAfterCatch,
      totalYards: pass.totalYards,
      depth: pass.passDepth,
      direction: pass.passDirection,
      location: pass.passLocation,
      isDeadBall,
      success: play?.success ?? false,
      explosiveness: play?.explosiveness ?? false,
      matched: Boolean(play),
    });
  });

  const coverage: PassingCoverage = {
    attempts: rows.length,
    matched: rows.filter(r => r.matched).length,
    withAirYards: rows.filter(r => r.airYards != null).length,
    withLocation: rows.filter(r => r.location != null).length,
    withYac: rows.filter(r => r.outcome === 'completion' && r.yardsAfterCatch != null).length,
  };

  return { rows, coverage };
};

/**
 * Attempts aimed at a receiver and carrying depth — the honest input for
 * anything split by short/deep or by zone.
 */
export const chartedAttempts = (rows: PassPlay[]): PassPlay[] =>
  rows.filter(r => !r.isDeadBall && r.airYards != null);

/** SR/XR for one bucket of attempts, shaped like `groupByCategory` results. */
export interface DepthGroup {
  label: string;
  count: number;
  sr: number;
  xr: number;
}

export const DEPTH_LABELS = ['Short (0-14)', 'Deep (15+)'] as const;

/**
 * Split attempts into short and deep.
 *
 * The API's own `passDepth` is authoritative where present; where it isn't we
 * fall back to air yards at the same 15-yard line the site already uses for
 * explosiveness, so the two ideas stay consistent.
 */
export const groupByPassDepth = (rows: PassPlay[]): DepthGroup[] => {
  const buckets = new Map<string, PassPlay[]>();
  DEPTH_LABELS.forEach(label => buckets.set(label, []));

  chartedAttempts(rows).forEach(row => {
    const isDeep = row.depth ? row.depth === 'deep' : (row.airYards ?? 0) >= 15;
    buckets.get(isDeep ? DEPTH_LABELS[1] : DEPTH_LABELS[0])!.push(row);
  });

  return DEPTH_LABELS.map(label => {
    const group = buckets.get(label)!;
    const matched = group.filter(r => r.matched);
    return {
      label,
      count: group.length,
      sr: matched.length > 0 ? matched.filter(r => r.success).length / matched.length : 0,
      xr: matched.length > 0 ? matched.filter(r => r.explosiveness).length / matched.length : 0,
    };
  });
};

/** Per-player air yards and YAC, for the depth charts. */
export interface PassingSplit {
  name: string;
  playerId: string | null;
  team: string;
  attempts: number;
  completions: number;
  completionRate: number;
  /** Air yards on completions only — the part that stacks with YAC. */
  airYardsCompleted: number;
  /** Air yards thrown on incompletions and interceptions. */
  airYardsIncomplete: number;
  yardsAfterCatch: number;
  /** Average depth of target across every charted attempt. */
  aDOT: number;
  teamColors?: unknown;
}

type SplitSide = 'passer' | 'target';

const buildSplits = (rows: PassPlay[], side: SplitSide, team: string): PassingSplit[] => {
  const groups = new Map<string, PassPlay[]>();

  chartedAttempts(rows).forEach(row => {
    const name = side === 'passer' ? row.passer : row.target;
    if (!name) return;
    const key = (side === 'passer' ? row.passerId : row.targetId) || name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const first = group[0];
      const completions = group.filter(r => r.outcome === 'completion');
      const airTotal = group.reduce((sum, r) => sum + (r.airYards ?? 0), 0);

      return {
        name: (side === 'passer' ? first.passer : first.target) || key,
        playerId: side === 'passer' ? first.passerId : first.targetId,
        team,
        attempts: group.length,
        completions: completions.length,
        completionRate: group.length > 0 ? completions.length / group.length : 0,
        airYardsCompleted: completions.reduce((sum, r) => sum + Math.max(0, r.airYards ?? 0), 0),
        airYardsIncomplete: group
          .filter(r => r.outcome !== 'completion')
          .reduce((sum, r) => sum + Math.max(0, r.airYards ?? 0), 0),
        yardsAfterCatch: completions.reduce((sum, r) => sum + Math.max(0, r.yardsAfterCatch ?? 0), 0),
        aDOT: group.length > 0 ? airTotal / group.length : 0,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
};

/** Passers on one team, most attempts first. */
export const aggregatePassers = (rows: PassPlay[], team: string): PassingSplit[] =>
  buildSplits(rows.filter(r => r.offense === team), 'passer', team);

/**
 * Targets on one team, most targets first.
 *
 * Note this counts *targets*, not catches: an incompletion attributes to the
 * intended receiver, which the play-text charts could never do. The bar still
 * only stacks yards actually gained, so an inaccurate target shows as attempts
 * without length.
 */
export const aggregateReceivers = (rows: PassPlay[], team: string): PassingSplit[] =>
  buildSplits(rows.filter(r => r.offense === team), 'target', team);

/** Combine both sides for the player charts, selected team first. */
export const combineSides = <T extends { team: string; attempts: number }>(
  teamSide: T[],
  opponentSide: T[],
  team: string,
  limit = 10
): T[] =>
  [...teamSide, ...opponentSide]
    .sort((a, b) => {
      if (a.team === team && b.team !== team) return -1;
      if (a.team !== team && b.team === team) return 1;
      return b.attempts - a.attempts;
    })
    .slice(0, limit);
