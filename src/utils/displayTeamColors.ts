import { getTeamColors } from './teamColors';
import { colorPalette } from './colorPalette';

interface TeamColors {
  success: string;
  explosive: string;
  light: string;
  color?: string;
  colorDark?: string;
}

// Convert a color option to the TeamColors format
const colorOptionToTeamColors = (colorOption: { primary: string; light: string; dark: string }): TeamColors => {
  return {
    success: colorOption.primary + 'CC', // Add alpha for transparency
    explosive: colorOption.dark + 'CC',   // Add alpha for transparency
    light: colorOption.light + 'CC',     // Add alpha for transparency
    color: colorOption.primary,
    colorDark: colorOption.dark,
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