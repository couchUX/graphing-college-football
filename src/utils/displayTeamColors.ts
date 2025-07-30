import { getTeamColors } from './teamColors';

export interface TeamColors {
  success: string;
  explosive: string;
  light: string;
  color?: string;
  colorDark?: string;
}

// Predefined gray color scheme
const grayColors: TeamColors = {
  success: 'rgba(107, 114, 128, 0.8)', // gray-500
  explosive: 'rgba(75, 85, 99, 0.8)', // gray-600
  light: 'rgba(229, 231, 235, 0.8)', // gray-200
  color: '#6B7280', // gray-500
  colorDark: '#374151', // gray-700
};

export const getDisplayTeamColors = (teamName: string, overrideToGray: boolean = false): TeamColors => {
  if (overrideToGray) {
    return grayColors;
  }
  
  return getTeamColors(teamName);
};