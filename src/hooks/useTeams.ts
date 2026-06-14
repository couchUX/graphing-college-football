import { useEffect, useState } from 'react';
import { fetchTeams, type Team } from '../services/api';

// Module-level cache so the team list is fetched once and shared across views.
let cachedTeams: Team[] | null = null;
let inflight: Promise<Team[]> | null = null;

const loadTeams = (): Promise<Team[]> => {
  if (cachedTeams) return Promise.resolve(cachedTeams);
  if (!inflight) {
    inflight = fetchTeams()
      .then((teams) => {
        cachedTeams = [...teams].sort((a, b) => a.school.localeCompare(b.school));
        return cachedTeams;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>(cachedTeams ?? []);
  const [loading, setLoading] = useState<boolean>(!cachedTeams);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Don't guard on `cachedTeams` here: if a sibling's in-flight fetch resolves
    // between this component's render and effect, an early return would strand it
    // at loading=true forever. loadTeams() resolves instantly when the cache is
    // warm, so letting it always run drives the final state correctly.
    if (!cachedTeams) setLoading(true);
    loadTeams()
      .then((data) => {
        if (active) setTeams(data);
      })
      .catch((err) => {
        console.error('Error loading teams:', err);
        if (active) setError('Failed to load teams.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { teams, loading, error };
};
