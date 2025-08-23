// Curated color palette for team customization
// Each color has primary, light, and dark variants for consistent chart styling

export interface ColorOption {
  id: string;
  primary: string;
  light: string;
  dark: string;
}

export const colorPalette: ColorOption[] = [
  // Reds
  {
    id: 'red',
    primary: '#DC2626',
    light: '#FEE2E2',
    dark: '#991B1B'
  },
  {
    id: 'red-orange',
    primary: '#EA580C',
    light: '#FED7AA',
    dark: '#C2410C'
  },
  {
    id: 'crimson',
    primary: '#BE123C',
    light: '#FCE7F3',
    dark: '#881337'
  },
  {
    id: 'maroon',
    primary: '#9F1239',
    light: '#FFE4E1',
    dark: '#7F1D1D'
  },

  // Blues
  {
    id: 'blue',
    primary: '#2563EB',
    light: '#DBEAFE',
    dark: '#1D4ED8'
  },
  {
    id: 'navy',
    primary: '#1E40AF',
    light: '#E0E7FF',
    dark: '#1E3A8A'
  },
  {
    id: 'sky',
    primary: '#0EA5E9',
    light: '#E0F2FE',
    dark: '#0C4A6E'
  },
  {
    id: 'navy-blue',
    primary: '#1E3A8A',
    light: '#E0E7FF',
    dark: '#1E40AF'
  },
  {
    id: 'teal',
    primary: '#0D9488',
    light: '#CCFBF1',
    dark: '#134E4A'
  },

  // Greens
  {
    id: 'green',
    primary: '#16A34A',
    light: '#DCFCE7',
    dark: '#166534'
  },
  {
    id: 'emerald',
    primary: '#059669',
    light: '#D1FAE5',
    dark: '#064E3B'
  },
  {
    id: 'forest',
    primary: '#15803D',
    light: '#F0FDF4',
    dark: '#14532D'
  },

  // Purples
  {
    id: 'purple',
    primary: '#9333EA',
    light: '#F3E8FF',
    dark: '#6B21A8'
  },
  {
    id: 'indigo',
    primary: '#4F46E5',
    light: '#E0E7FF',
    dark: '#3730A3'
  },
  {
    id: 'violet',
    primary: '#7C3AED',
    light: '#EDE9FE',
    dark: '#5B21B6'
  },

  // Yellows/Oranges
  {
    id: 'yellow',
    primary: '#FACC15',
    light: '#FEF3C7',
    dark: '#A16207'
  },
  {
    id: 'gold',
    primary: '#D97706',
    light: '#FED7AA',
    dark: '#92400E'
  },
  {
    id: 'dull-gold',
    primary: '#CA8A04',
    light: '#FEF3C7',
    dark: '#854D0E'
  },
  {
    id: 'orange',
    primary: '#F97316',
    light: '#FFEDD5',
    dark: '#C2410C'
  },

  // Other colors
  {
    id: 'pink',
    primary: '#EC4899',
    light: '#FCE7F3',
    dark: '#BE185D'
  },
  {
    id: 'rose',
    primary: '#F43F5E',
    light: '#FFE4E6',
    dark: '#BE123C'
  },
  {
    id: 'brown',
    primary: '#A16207',
    light: '#FEF3C7',
    dark: '#78350F'
  },
  {
    id: 'slate',
    primary: '#64748B',
    light: '#F1F5F9',
    dark: '#334155'
  }
];