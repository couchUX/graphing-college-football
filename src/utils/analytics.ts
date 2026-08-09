/**
 * Google Analytics event helper.
 *
 * Wraps the `gtag` global so call sites don't repeat the `window as any` cast
 * and the existence check, and so analytics is a no-op anywhere gtag isn't
 * loaded (local dev, tests, ad blockers).
 */

type GtagParams = Record<string, string | number | boolean | undefined>;

type GtagWindow = Window & {
  gtag?: (command: string, event: string, params?: GtagParams) => void;
};

export const track = (event: string, params: GtagParams = {}): void => {
  if (typeof window === 'undefined') return;
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', event, params);
};
