import { getTeamColors } from './teamColors';
import { colorPalette } from './colorPalette';

interface TeamColors {
  success: string;
  explosive: string;
  light: string;
  color?: string;
  colorDark?: string;
}

// Helper function to convert hex to HSL
const hexToHsl = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
};

// Helper function to convert HSL to hex
const hslToHex = (h: number, s: number, l: number): string => {
  h /= 360; s /= 100; l /= 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Smart explosive color calculation
const calculateExplosiveColor = (primaryColor: string, isPlayerChart: boolean = false): string => {
  try {
    const [h, s, l] = hexToHsl(primaryColor);

    // Much more conservative darkening for player charts
    if (isPlayerChart) {
      if (l < 25) {
        // Very dark colors - minimal extra darkening
        const newL = Math.max(l - 8, 5);
        const newS = Math.min(s + 10, 100);
        return hslToHex(h, newS, newL);
      } else if (l < 50) {
        // Medium-dark colors - very gentle darkening
        const newL = Math.max(l - 6, 12);
        const newS = Math.min(s + 5, 100);
        return hslToHex(h, newS, newL);
      } else {
        // Light colors - barely any darkening
        const newL = Math.max(l - 4, 20);
        return hslToHex(h, s, newL);
      }
    }

    // Regular chart darkening (original logic)
    if (l < 35) {
      const newL = Math.max(l - 18, 3);
      const newS = Math.min(s + 20, 100);
      return hslToHex(h, newS, newL);
    } else if (l < 55) {
      const newL = Math.max(l - 30, 8);
      const newS = Math.min(s + 15, 100);
      return hslToHex(h, newS, newL);
    } else if (l < 75) {
      const newL = Math.max(l - 40, 12);
      return hslToHex(h, s, newL);
    } else {
      const newL = Math.max(l - 45, 15);
      return hslToHex(h, s, newL);
    }
  } catch (error) {
    // Balanced fallback darkening
    const multiplier = isPlayerChart ? 0.25 : 0.4; // More aggressive for player charts
    return primaryColor.replace(/^#/, '#').replace(/[0-9a-f]/gi, (char) => {
      const num = parseInt(char, 16);
      return Math.max(0, Math.floor(num * multiplier)).toString(16);
    });
  }
};

// Convert a color option to the TeamColors format
const colorOptionToTeamColors = (colorOption: { primary: string; light: string; dark: string }, isPlayerChart: boolean = false): TeamColors => {
  const explosiveColor = calculateExplosiveColor(colorOption.primary, isPlayerChart);

  return {
    success: colorOption.primary + 'CC', // Add alpha for transparency
    explosive: explosiveColor + 'CC',     // Smart darkening with alpha
    light: colorOption.light + 'CC',     // Add alpha for transparency
    color: colorOption.primary,
    colorDark: explosiveColor,
  };
};

export const getDisplayTeamColors = (teamName: string, customColorId?: string): TeamColors => {
  // If custom color is specified and not 'default', use the custom color
  if (customColorId && customColorId !== 'default') {
    const customColor = colorPalette.find(color => color.id === customColorId);
    if (customColor) {
      return colorOptionToTeamColors(customColor);
    }
  }

  // Otherwise use the team's default colors
  return getTeamColors(teamName);
};

// Helper function to convert rgba to hex
const rgbaToHex = (rgba: string): string => {
  try {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (!match) return rgba;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch (error) {
    return rgba;
  }
};

// Special function for player charts with extra dark explosive colors
export const getDisplayTeamColorsForPlayerChart = (teamName: string, customColorId?: string): TeamColors => {
  // If custom color is specified and not 'default', use the custom color with normal explosive darkening
  if (customColorId && customColorId !== 'default') {
    const customColor = colorPalette.find(color => color.id === customColorId);
    if (customColor) {
      // Special handling for gold colors - they get too dark with normal player chart logic
      if (customColor.id === 'gold' || customColor.id === 'dull-gold') {
        const normalColors = colorOptionToTeamColors(customColor, false); // Get normal colors first
        const existingExplosiveHex = normalColors.colorDark || normalColors.explosive.replace(/CC$/, '');

        // Apply minimal additional darkening for gold colors to prevent over-darkening
        const [h, s, l] = hexToHsl(existingExplosiveHex);
        const gentleL = Math.max(l - 8, 20); // -8% lightness for golds (slightly more than before)
        const gentleExplosive = hslToHex(h, s, gentleL);

        return {
          ...normalColors,
          explosive: gentleExplosive + 'CC',
          colorDark: gentleExplosive,
        };
      }

      // For other custom colors, apply conservative darkening to the existing dark color, not the primary
      const normalColors = colorOptionToTeamColors(customColor, false); // Get normal colors first
      const existingExplosiveHex = normalColors.colorDark || normalColors.explosive.replace(/CC$/, '');

      // Apply gentle additional darkening to the already-dark explosive color
      const enhancedExplosive = calculateExplosiveColor(existingExplosiveHex, true);

      return {
        ...normalColors,
        explosive: enhancedExplosive + 'CC',
        colorDark: enhancedExplosive,
      };
    }
  }

  // For default team colors, enhance the existing explosive color instead of recalculating
  const teamColors = getTeamColors(teamName);

  // Convert the existing explosive rgba color to hex for processing
  const existingExplosiveHex = rgbaToHex(teamColors.explosive);

  // Apply additional darkening to the existing explosive color
  const enhancedExplosive = calculateExplosiveColor(existingExplosiveHex, true);

  return {
    ...teamColors,
    explosive: enhancedExplosive + 'CC',
    colorDark: enhancedExplosive,
  };
};