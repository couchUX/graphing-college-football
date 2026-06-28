import { useEffect, useState } from 'react';

/**
 * Tracks whether the viewport is at or below a breakpoint (default 640px,
 * Tailwind's `sm`). Used to drive responsive behavior that can't be expressed
 * purely in CSS — e.g. data-driven chart heights computed in JS.
 */
export const useIsMobile = (breakpointPx = 640): boolean => {
  // `sm` is min-width: 640px, so "mobile" is anything strictly below it.
  const query = `(max-width: ${breakpointPx - 0.02}px)`;

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
};
