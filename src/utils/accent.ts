/**
 * Editorial accent driven by the selected team.
 *
 * The Press Box direction uses one accent stroke (nav underline, CTA hover,
 * focus rings, score numerals). When a team is on screen that stroke becomes
 * the team's own color; with no team selected it stays the crimson default.
 *
 * Team colors come straight from the palette the charts already use, so the
 * chrome and the visualizations never disagree. Very light colors (pale golds,
 * whites) are darkened until they hold up as text//UI ink on paper.
 */

const DEFAULT_ACCENT = '#8E2434';

/** Accepts '#abc', '#aabbcc' and the 'rgba(r, g, b, a)' strings the team
 *  palette stores; returns a plain 6-digit hex or null. */
const clampHex = (input: string): string | null => {
  const value = input.trim();

  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (rgba) {
    const [, r, g, b] = rgba;
    return `#${[r, g, b]
      .map(n => Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  const m = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(value);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return `#${h.toLowerCase()}`;
};

const toRgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

/** Relative luminance (WCAG). Used to reject accents too pale to read on paper. */
const luminance = (hex: string): number => {
  const { r, g, b } = toRgb(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** Mix toward black until the color is dark enough to serve as UI ink. */
const darkenToward = (hex: string, target: number): string => {
  let { r, g, b } = toRgb(hex);
  let guard = 0;
  while (luminance(`#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`) > target && guard < 24) {
    r = Math.round(r * 0.88);
    g = Math.round(g * 0.88);
    b = Math.round(b * 0.88);
    guard += 1;
  }
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Normalize any team color into an accent that reads on paper.
 * Returns the crimson default when the input isn't a usable hex color.
 */
export const toAccentColor = (raw?: string | null): string => {
  const hex = raw ? clampHex(raw) : null;
  if (!hex) return DEFAULT_ACCENT;
  // 0.30 keeps saturated mid-tones (Alabama crimson, Oregon green) intact while
  // pulling pale golds and whites down to something legible.
  return luminance(hex) > 0.3 ? darkenToward(hex, 0.3) : hex;
};

/**
 * Set (or reset) the page accent. Called when a team is selected; passing
 * nothing restores the default.
 */
export const applyAccent = (raw?: string | null): void => {
  if (typeof document === 'undefined') return;
  const accent = toAccentColor(raw);
  const { r, g, b } = toRgb(accent);
  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.10)`);
};
