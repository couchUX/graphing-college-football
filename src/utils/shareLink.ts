// Deep links to a single chart: `/games?year=2025&team=Alabama#win-probability`.
//
// Every shareable card carries an `id` (the fragment) and `data-share-card`
// (so the share menu can find the card it sits in, and so the scroll on
// arrival only ever chases our own cards). The query string already holds the
// page's whole view state, so the link reopens the same game or season and
// then lands on the chart.

/** The marker attribute on a shareable card's root element. */
export const SHARE_CARD_ATTR = 'data-share-card';

/** Set for a moment on a card the visitor arrived at, to show which one it is. */
export const SHARE_LINKED_ATTR = 'data-share-linked';

/** Query values a link should carry in place of the address bar's. */
export type LinkParams = Record<string, string | null>;

/** The params behind the data on screen. See pinLoadedParams. */
const loadedParams = new Map<string, string | null>();

/** The address bar's current values for `keys`. Take one as a fetch starts. */
export const snapshotParams = (keys: readonly string[]): LinkParams => {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(keys.map(key => [key, params.get(key)]));
};

/**
 * Record what a finished fetch loaded.
 *
 * The pickers write a pending choice into the address bar the moment it's
 * made, but the charts only change when the data does: pick another game, or
 * untick one on Season trends without pressing Fetch, and the URL already
 * describes a view nobody has loaded. Until the next fetch lands, card links
 * take these keys from here. Everything else — colors, filters, modes, which
 * apply the moment they change — still comes from the live address bar.
 */
export const pinLoadedParams = (snapshot: LinkParams): void => {
  Object.entries(snapshot).forEach(([key, value]) => loadedParams.set(key, value));
};

/**
 * This page, as it's showing, pointing at one card. `overrides` are a card's
 * own settings that the page-wide URL can't hold (a player chart's team
 * filter when the three disagree).
 */
export const cardLink = (id: string, overrides: LinkParams = {}): string => {
  const url = new URL(window.location.href);
  const apply = (key: string, value: string | null) => {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  };
  loadedParams.forEach((value, key) => apply(key, value));
  Object.entries(overrides).forEach(([key, value]) => apply(key, value));
  url.hash = id;
  return url.toString();
};

/** How long to wait for a linked card to render. Season loads fetch one game at a time. */
const WAIT_MS = 60_000;
/** After landing, how long to hold the card in place while content above it settles. */
const SETTLE_MS = 2_500;
/** Matches the share-linked animation in index.css. */
const HIGHLIGHT_MS = 2_400;
/** Any of these means the reader has taken the page back. */
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/**
 * Scroll to the card a link points at, once it exists.
 *
 * The browser looks for the fragment as the HTML loads, long before React has
 * fetched a game and drawn its charts, so the native jump never finds
 * anything. This watches the DOM until the card appears, then holds it at the
 * top of the viewport while the sections above it (box score, metric cards)
 * finish arriving and push it down. Any scroll, tap or keypress from the
 * reader cancels all of it — at no point does the page pull itself away from
 * someone who has started reading.
 *
 * Returns the cleanup.
 */
export const followLinkedCard = (id: string): (() => void) => {
  let mutations: MutationObserver | null = null;
  let resizes: ResizeObserver | null = null;
  const timers: number[] = [];

  const stop = () => {
    mutations?.disconnect();
    resizes?.disconnect();
    timers.forEach(timer => window.clearTimeout(timer));
    USER_INPUT.forEach(type => window.removeEventListener(type, stop, true));
  };

  USER_INPUT.forEach(type => window.addEventListener(type, stop, { capture: true, passive: true }));

  const land = (card: HTMLElement) => {
    mutations?.disconnect();
    const align = () => card.scrollIntoView({ block: 'start' });
    align();

    card.setAttribute(SHARE_LINKED_ATTR, '');
    // Outside `timers` on purpose: stopping early must not strand the highlight.
    window.setTimeout(() => card.removeAttribute(SHARE_LINKED_ATTR), HIGHLIGHT_MS);

    resizes = new ResizeObserver(align);
    resizes.observe(document.body);
    timers.push(window.setTimeout(stop, SETTLE_MS));
  };

  /** True once there's nothing left to wait for. */
  const check = (): boolean => {
    const target = document.getElementById(id);
    if (!target) return false;
    // Someone else's anchor (Ratings' #data-definitions handles itself).
    if (target.hasAttribute(SHARE_CARD_ATTR)) land(target);
    else stop();
    return true;
  };

  if (!check()) {
    mutations = new MutationObserver(() => {
      check();
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    timers.push(window.setTimeout(stop, WAIT_MS));
  }

  return stop;
};
