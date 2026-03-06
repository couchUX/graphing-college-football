import { PlayData, PlayerStats } from '../types';

export const aggregateSeasonPlayerStats = (
  allPlays: PlayData[],
  team: string
): {
  topPassers: PlayerStats[];
  topRushers: PlayerStats[];
  topReceivers: PlayerStats[];
} => {
  const teamPlays = allPlays.filter(p => p.offense === team);

  // Aggregate passer stats
  const passerMap = new Map<string, PlayerStats>();
  const passingPlays = teamPlays.filter(p =>
    p.playType?.toLowerCase().includes('pass') ||
    p.playType?.toLowerCase().includes('sack') ||
    p.playType?.toLowerCase().includes('interception')
  );

  passingPlays.forEach(play => {
    if (!play.passer) return;

    const existing = passerMap.get(play.passer) || {
      name: play.passer,
      explosive: 0,
      successful: 0,
      unsuccessful: 0,
      int: 0,
      total: 0
    };

    if (play.playType?.toLowerCase().includes('interception')) {
      existing.int = (existing.int || 0) + 1;
      existing.unsuccessful += 1;
    } else if (play.explosiveness) {
      existing.explosive += 1;
    } else if (play.success) {
      existing.successful += 1;
    } else {
      existing.unsuccessful += 1;
    }
    existing.total += 1;

    passerMap.set(play.passer, existing);
  });

  // Aggregate rusher stats
  const rusherMap = new Map<string, PlayerStats>();
  const rushingPlays = teamPlays.filter(p =>
    p.playType?.toLowerCase().includes('rush') ||
    p.playType?.toLowerCase().includes('run')
  );

  rushingPlays.forEach(play => {
    if (!play.rusher) return;

    const existing = rusherMap.get(play.rusher) || {
      name: play.rusher,
      explosive: 0,
      successful: 0,
      unsuccessful: 0,
      total: 0
    };

    if (play.explosiveness) {
      existing.explosive += 1;
    } else if (play.success) {
      existing.successful += 1;
    } else {
      existing.unsuccessful += 1;
    }
    existing.total += 1;

    rusherMap.set(play.rusher, existing);
  });

  // Aggregate receiver stats
  const receiverMap = new Map<string, PlayerStats>();
  const completedPasses = teamPlays.filter(p =>
    (p.playType?.toLowerCase().includes('pass') ||
     p.playType?.toLowerCase().includes('completion')) &&
    !p.playType?.toLowerCase().includes('incomplete') &&
    !p.playType?.toLowerCase().includes('interception')
  );

  completedPasses.forEach(play => {
    if (!play.receiver) return;

    const existing = receiverMap.get(play.receiver) || {
      name: play.receiver,
      explosive: 0,
      successful: 0,
      unsuccessful: 0,
      uns_catches: 0,
      total: 0
    };

    if (play.explosiveness) {
      existing.explosive += 1;
    } else if (play.success) {
      existing.successful += 1;
    } else {
      existing.uns_catches = (existing.uns_catches || 0) + 1;
      existing.unsuccessful += 1;
    }
    existing.total += 1;

    receiverMap.set(play.receiver, existing);
  });

  // Sort and return top 10
  const sortByTotal = (a: PlayerStats, b: PlayerStats) => b.total - a.total;

  return {
    topPassers: Array.from(passerMap.values()).sort(sortByTotal).slice(0, 10),
    topRushers: Array.from(rusherMap.values()).sort(sortByTotal).slice(0, 10),
    topReceivers: Array.from(receiverMap.values()).sort(sortByTotal).slice(0, 10)
  };
};
