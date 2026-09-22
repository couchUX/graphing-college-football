// Per-section view memory, so clicking around the masthead doesn't wipe what
// you were looking at.
//
// Every section switch is a real page load — MainNav is plain
// `<a href="/trends">`, not a client-side router — so the query string each
// page keeps its state in dies the moment you leave it. Load the Alabama–
// Missouri game on Games, glance at Trends, come back, and Games has
// forgotten you.
//
// Rather than teach four pages to serialize themselves a second way, this
// snapshots the whole query string per path on the way out and puts it back
// on the way in. Each page's existing URL-restore path does the rest: Games
// re-selects the game and re-fetches, Trends reloads the season, Ratings
// opens on the season and conference you left it on.
//
// sessionStorage rather than localStorage is deliberate: the memory lasts a
// browsing session, not forever, and each tab keeps its own, so two tabs
// parked on different seasons don't overwrite each other and a link opened
// tomorrow starts clean.
//
// One wrinkle worth knowing: a tab opened *from* this one (cmd-click, middle
// click, target=_blank) starts with a copy of this tab's sessionStorage, so it
// inherits these snapshots as its seed. The two diverge from then on — the copy
// is taken once, at creation — and a link carrying its own params is untouched
// either way, so what the new tab inherits is only ever the section state its
// opener had. That's the same continuity the feature is for, so it's left
// alone; separating them would mean tracking tab identity across a duplication
// the browser does deliberately.

const KEY_PREFIX = 'gcf:view:';

/** Only the real sections; anything else would just litter storage. */
const REMEMBERED_PATHS = new Set(['/games', '/ratings', '/trends', '/discover']);

const safeSession = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    // Blocked storage (some private modes throw on access) — the feature
    // degrades to "no memory", which is where we were before.
    return null;
  }
};

/** '' for a bare URL, so `?` and `?a=1` don't have to be handled separately. */
const currentQuery = (): string => new URLSearchParams(window.location.search).toString();

const storageKey = (path: string): string => `${KEY_PREFIX}${path}`;

/**
 * Stash the section's current query string. Called as the page goes away, by
 * which point every page has already mirrored its state into the URL.
 */
export const rememberViewState = (): void => {
  const storage = safeSession();
  if (!storage) return;

  const path = window.location.pathname;
  if (!REMEMBERED_PATHS.has(path)) return;

  try {
    const query = currentQuery();
    // Someone who cleared their filters should come back to a clean page, not
    // to the last state that happened to be worth storing.
    if (query) storage.setItem(storageKey(path), query);
    else storage.removeItem(storageKey(path));
  } catch {
    // Quota or a storage policy we can't do anything about; skip the snapshot.
  }
};

/**
 * Put a remembered query string back, but only when the URL asks no questions
 * of its own. A link someone shared — or a back-button entry — always wins:
 * a visitor opening /ratings?year=2019 gets 2019, never whatever this tab was
 * last looking at.
 *
 * Runs before React mounts so the pages read an address bar that's already
 * settled, and uses replaceState so the bare entry doesn't linger in history.
 */
export const restoreViewState = (): void => {
  const storage = safeSession();
  if (!storage) return;

  const path = window.location.pathname;
  if (!REMEMBERED_PATHS.has(path)) return;
  if (currentQuery()) return;

  try {
    const remembered = storage.getItem(storageKey(path));
    // Keep any fragment: /ratings#data-definitions carries no query, so it
    // reaches here looking bare, and rebuilding the URL without the hash would
    // strip the anchor before the page ever gets to honour it.
    if (remembered) {
      window.history.replaceState({}, '', `${path}?${remembered}${window.location.hash}`);
    }
  } catch {
    // Unreadable entry — open on the defaults.
  }
};

/**
 * Restore on the way in, then keep the snapshot current.
 *
 * `pagehide` is the save hook rather than `beforeunload`: it fires on ordinary
 * link navigations in every modern browser, including iOS Safari, where
 * `beforeunload` can't be relied on. `visibilitychange` covers the phone case
 * where a tab is backgrounded and reclaimed without ever hiding the page.
 */
export const initViewStateMemory = (): void => {
  if (typeof window === 'undefined') return;

  restoreViewState();

  window.addEventListener('pagehide', rememberViewState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') rememberViewState();
  });
};
