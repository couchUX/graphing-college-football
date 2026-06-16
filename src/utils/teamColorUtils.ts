import { getDisplayTeamColors } from './displayTeamColors';

// Parse an rgb(a)/hex color into [r, g, b].
export const parseColor = (color: string): [number, number, number] => {
  const m = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const hex = color.replace('#', '');
  if (hex.length >= 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return [23, 23, 23];
};

export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

// The primary line color for a single team (used when comparing two teams,
// one line each). 'default' falls back to the team's own primary color.
export const teamLineColor = (teamName: string, colorId: string): string => {
  const c = getDisplayTeamColors(teamName, colorId);
  return c.color || c.success;
};

// SP+ series colors for a single team, ordered to match the SERIES list
// (Overall, Offense, Defense, Special teams): Overall = the dark team color,
// Offense = the primary team color, Defense = a neutral gray, Special teams = a
// light tint of the team color. 'default' uses the team's own colors.
export const seriesColorsFor = (teamName: string, colorId: string): string[] => {
  const c = getDisplayTeamColors(teamName, colorId);
  const primary = c.color || c.success; // Offense — primary team color
  const dark = c.colorDark || c.explosive; // Overall — dark team color
  const [r, g, b] = parseColor(primary);
  const [h, s] = rgbToHsl(r, g, b);
  const sat = Math.round(Math.min(Math.max(s, 45), 85));
  const light = `hsl(${Math.round(h)}, ${sat}%, 68%)`; // Special teams — light tint
  return [dark, primary, '#9CA3AF', light];
};
