import { useEffect } from 'react';
import { SITE_URL } from '../constants/site';

/**
 * Keep `<link rel="canonical">` pointing at the canonical host, whatever host
 * actually served the request.
 *
 * This has to be pinned rather than read from `window.location.origin`: the
 * project's original `cfb-adv-metrics-dashboard.vercel.app` name is still
 * attached and still resolves, so a page reached through it would name that
 * duplicate as its own canonical — advertising the split this is meant to
 * consolidate, and doing it on exactly the host we don't want indexed.
 *
 * `path` is everything after the origin, so a page can canonicalise the view
 * rather than the route: Games and Trends include the params that identify the
 * game or season on screen, while Ratings and Discover canonicalise the bare
 * route, since their year/conference/sort are filters over one page rather
 * than separate documents.
 */
export const useCanonical = (path: string): void => {
  useEffect(() => {
    document.querySelector('link[rel="canonical"]')?.remove();

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${SITE_URL}${path}`;
    document.head.appendChild(canonical);
  }, [path]);
};
