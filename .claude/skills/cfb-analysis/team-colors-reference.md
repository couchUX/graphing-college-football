# Team Colors Reference

This file provides team color information for creating visually consistent charts. The colors are derived from `src/utils/displayTeamColors.ts` and `src/utils/colorPalette.ts`.

## How Colors Work

Each team has three main colors used in charts:
- **Success Color** (light): For successful plays
- **Explosive Color** (dark): For explosive plays
- **Light Color** (very light): For unsuccessful plays or backgrounds

## Color Palette IDs

The app uses these predefined color palettes. When a team is not in the custom overrides, it falls back to API colors or these palettes:

```javascript
const colorPalette = {
  'crimson': { primary: '#BE123C', light: '#FCE7F3', dark: '#881337' },
  'red': { primary: '#DC2626', light: '#FEE2E2', dark: '#991B1B' },
  'maroon': { primary: '#9F1239', light: '#FFE4E1', dark: '#7F1D1D' },
  'blue': { primary: '#2563EB', light: '#DBEAFE', dark: '#1D4ED8' },
  'navy': { primary: '#1E40AF', light: '#E0E7FF', dark: '#1E3A8A' },
  'orange': { primary: '#F97316', light: '#FFEDD5', dark: '#C2410C' },
  'purple': { primary: '#9333EA', light: '#F3E8FF', dark: '#6B21A8' },
  'gold': { primary: '#D97706', light: '#FED7AA', dark: '#92400E' },
  'green': { primary: '#16A34A', light: '#DCFCE7', dark: '#166534' },
  'slate': { primary: '#64748B', light: '#F1F5F9', dark: '#334155' }
};
```

## Getting Team Colors (JavaScript)

### Simple Method (Use Team API Colors)

```javascript
async function getTeamColors(teamName) {
  // Fetch team info from API
  const response = await fetch('https://api.collegefootballdata.com/teams');
  const teams = await response.json();
  const team = teams.find(t => t.school === teamName);

  if (!team) {
    // Fallback to default colors
    return {
      success: 'rgba(59, 130, 246, 0.7)',    // Blue
      explosive: 'rgba(37, 99, 235, 1)',     // Darker blue
      light: 'rgba(219, 234, 254, 0.5)',     // Light blue
      color: '#3B82F6'
    };
  }

  // Use team's primary color from API
  const primary = team.color;

  return {
    success: hexToRgba(primary, 0.7),
    explosive: darkenColor(primary),
    light: lightenColor(primary),
    color: primary,
    colorDark: darkenColor(primary)
  };
}

// Helper functions
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenColor(hex) {
  // Simple darkening: reduce each RGB component
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenColor(hex) {
  // Convert to very light version with alpha
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(4), 16);
  return `rgba(${r}, ${g}, ${b}, 0.2)`;
}
```

## Common Team Color Examples

For quick reference, here are some common teams with their typical colors:

```javascript
const commonTeamColors = {
  'Alabama': {
    success: 'rgba(158, 27, 50, 0.7)',
    explosive: 'rgba(118, 20, 38, 1)',
    light: 'rgba(158, 27, 50, 0.2)',
    color: '#9E1B32'
  },
  'Georgia': {
    success: 'rgba(186, 12, 47, 0.7)',
    explosive: 'rgba(136, 19, 55, 1)',
    light: 'rgba(186, 12, 47, 0.2)',
    color: '#BA0C2F'
  },
  'Ohio State': {
    success: 'rgba(187, 0, 0, 0.7)',
    explosive: 'rgba(136, 0, 0, 1)',
    light: 'rgba(187, 0, 0, 0.2)',
    color: '#BB0000'
  },
  'Michigan': {
    success: 'rgba(0, 39, 76, 0.7)',
    explosive: 'rgba(0, 20, 40, 1)',
    light: 'rgba(0, 39, 76, 0.2)',
    color: '#00274C'
  },
  'Texas': {
    success: 'rgba(191, 87, 0, 0.7)',
    explosive: 'rgba(140, 60, 0, 1)',
    light: 'rgba(191, 87, 0, 0.2)',
    color: '#BF5700'
  },
  'LSU': {
    success: 'rgba(70, 29, 124, 0.7)',
    explosive: 'rgba(50, 20, 90, 1)',
    light: 'rgba(70, 29, 124, 0.2)',
    color: '#461D7C'
  },
  'Oklahoma': {
    success: 'rgba(132, 5, 24, 0.7)',
    explosive: 'rgba(100, 4, 18, 1)',
    light: 'rgba(132, 5, 24, 0.2)',
    color: '#841618'
  },
  'Clemson': {
    success: 'rgba(245, 102, 0, 0.7)',
    explosive: 'rgba(194, 65, 12, 1)',
    light: 'rgba(245, 102, 0, 0.2)',
    color: '#F56600'
  },
  'Notre Dame': {
    success: 'rgba(12, 35, 64, 0.7)',
    explosive: 'rgba(8, 23, 43, 1)',
    light: 'rgba(12, 35, 64, 0.2)',
    color: '#0C2340'
  },
  'USC': {
    success: 'rgba(153, 27, 30, 0.7)',
    explosive: 'rgba(115, 20, 23, 1)',
    light: 'rgba(153, 27, 30, 0.2)',
    color: '#990000'
  }
};
```

## Usage in Charts

```javascript
// For a single team chart
async function createTeamChart(teamName, data) {
  const colors = await getTeamColors(teamName);

  const chartConfig = {
    type: 'bar',
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [{
        label: 'Success Rate',
        data: data,
        backgroundColor: colors.success,
        borderColor: colors.explosive,
        borderWidth: 2
      }]
    },
    options: {
      // ... chart options
    }
  };

  return new Chart(ctx, chartConfig);
}
```

## Two-Team Comparison

When comparing two teams, fetch colors for both:

```javascript
async function createComparisonChart(team1, team2, data1, data2) {
  const colors1 = await getTeamColors(team1);
  const colors2 = await getTeamColors(team2);

  const chartConfig = {
    type: 'bar',
    data: {
      labels: ['1st Down', '2nd Down', '3rd Down', '4th Down'],
      datasets: [
        {
          label: team1,
          data: data1,
          backgroundColor: colors1.success,
          borderColor: colors1.explosive,
          borderWidth: 2
        },
        {
          label: team2,
          data: data2,
          backgroundColor: colors2.success,
          borderColor: colors2.explosive,
          borderWidth: 2
        }
      ]
    },
    options: {
      // ... chart options
    }
  };

  return new Chart(ctx, chartConfig);
}
```

## NCAA Average Reference Line

When adding NCAA average reference lines, use neutral gray:

```javascript
{
  type: 'line',
  label: 'NCAA Average',
  data: [43.3, 43.3, 43.3, 43.3], // Repeat for each label
  borderColor: '#757575',
  borderWidth: 2,
  borderDash: [3, 3],
  pointRadius: 0,
  fill: false
}
```

## Notes

- Always fetch team colors from the API when possible for accuracy
- Fall back to color palette for custom color selection
- Use consistent alpha values: 0.7 for success, 1.0 for explosive, 0.2 for light
- For player charts, colors are slightly less saturated to prevent visual fatigue
