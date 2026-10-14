import { useEffect, useState } from 'react';
import { followLinkedCard } from '../utils/shareLink';

/**
 * Land on the chart a deep link points at (`#win-probability`). AppShell runs
 * this once per page load.
 */
export const useLinkedCard = (): void => {
  // Read during render, before any child effect runs: the Games and Season
  // pickers rewrite the address bar as they restore their state, and the hash
  // has to be in hand before anything can drop it.
  const [hash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));

  useEffect(() => {
    let id = '';
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return; // A malformed fragment can't name one of our cards.
    }
    if (!id) return;
    return followLinkedCard(id);
  }, [hash]);
};
