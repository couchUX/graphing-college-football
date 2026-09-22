// Read/write query-string state without clobbering params a page doesn't own.
// Every page that keeps shareable state in the URL (Team Trends, Discover)
// goes through here, so switching sub-tabs or filters only ever touches that
// view's own keys and leaves the rest of the link intact.

export const readParams = (): URLSearchParams =>
  new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

export const writeParams = (updates: Record<string, string | null | undefined>): void => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  // Keep the fragment: Ratings links to #data-definitions from its meta line,
  // and rewriting the query on any filter change used to drop it.
  const { pathname, hash } = window.location;
  window.history.replaceState({}, '', `${pathname}${qs ? `?${qs}` : ''}${hash}`);
};
