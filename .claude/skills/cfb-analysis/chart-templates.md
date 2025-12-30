# Chart.js Templates

This file provides reusable Chart.js configurations that match the styling of the main Graphing College Football application.

## Chart.js Setup

Always include these scripts in your HTML:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
```

## Base Chart Options

Default options used across all charts:

```javascript
const baseOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 2,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        padding: 15,
        font: {
          size: 12,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
        },
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      titleFont: {
        size: 13,
        weight: 'bold'
      },
      bodyFont: {
        size: 12
      },
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1
    },
    datalabels: {
      display: false // Disabled by default, enable per dataset
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        font: {
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      },
      ticks: {
        font: {
          size: 11
        }
      }
    }
  }
};
```

## 1. Success Rate by Category (Bar Chart)

For comparing SR across quarters, downs, distances, etc.

```javascript
async function createSuccessRateChart(teamName, year, category = 'quarter') {
  // Fetch data
  const plays = await fetchSeasonData(teamName, year);
  const teamPlays = plays.filter(p => p.offense === teamName);
  const opponentPlays = plays.filter(p => p.offense !== teamName);

  // Group data
  const teamGrouped = groupByCategory(teamPlays, category);
  const opponentGrouped = groupByCategory(opponentPlays, category);

  const labels = Object.keys(teamGrouped);
  const teamSR = labels.map(label => {
    const group = teamGrouped[label];
    const successful = group.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));
    return (successful.length / group.length * 100).toFixed(1);
  });
  const oppSR = labels.map(label => {
    const group = opponentGrouped[label] || [];
    if (group.length === 0) return 0;
    const successful = group.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));
    return (successful.length / group.length * 100).toFixed(1);
  });

  const colors = await getTeamColors(teamName);

  const config = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${teamName} Offense SR`,
          data: teamSR,
          backgroundColor: colors.success,
          borderColor: colors.explosive,
          borderWidth: 2
        },
        {
          label: `Opponents Offense SR`,
          data: oppSR,
          backgroundColor: 'rgba(100, 116, 139, 0.7)',
          borderColor: 'rgba(51, 65, 85, 1)',
          borderWidth: 2
        },
        {
          type: 'line',
          label: 'NCAA Average (43.3%)',
          data: Array(labels.length).fill(43.3),
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales.y,
          max: 100,
          ticks: {
            ...baseOptions.scales.y.ticks,
            callback: (value) => value + '%'
          }
        }
      },
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: `${teamName} ${category} Success Rate - ${year} Season`,
          font: { size: 16, weight: 'bold' },
          padding: 20
        },
        tooltip: {
          ...baseOptions.plugins.tooltip,
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y}%`;
            }
          }
        }
      }
    }
  };

  return new Chart(document.getElementById('chart'), config);
}
```

## 2. Player Stats (Stacked Bar Chart)

For showing player performance with explosive/successful/unsuccessful breakdowns.

```javascript
async function createPlayerStatsChart(teamName, year, playType = 'rush') {
  const plays = await fetchSeasonData(teamName, year);
  const teamPlays = plays.filter(p => p.offense === teamName);

  // Aggregate player stats
  const players = aggregatePlayersByType(teamPlays, playType);
  const topPlayers = players.slice(0, 10); // Top 10 players

  const labels = topPlayers.map(p => p.name);
  const explosive = topPlayers.map(p => p.explosive);
  const successful = topPlayers.map(p => p.successful);
  const unsuccessful = topPlayers.map(p => p.unsuccessful);

  const colors = await getTeamColors(teamName);

  const config = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: playType === 'rush' ? 'Explosive rushes' : 'Explosive catches',
          data: explosive,
          backgroundColor: colors.explosive,
          borderColor: '#374151',
          borderWidth: 1
        },
        {
          label: playType === 'rush' ? 'Successful rushes' : 'Successful catches',
          data: successful,
          backgroundColor: colors.success,
          borderColor: '#374151',
          borderWidth: 1
        },
        {
          label: playType === 'rush' ? 'Unsuccessful rushes' : 'Other catches',
          data: unsuccessful,
          backgroundColor: '#FFFFFF',
          borderColor: '#374151',
          borderWidth: 1
        }
      ]
    },
    options: {
      ...baseOptions,
      indexAxis: 'y', // Horizontal bars
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            font: { size: 11 }
          }
        }
      },
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: `${teamName} Top ${playType === 'rush' ? 'Rushers' : 'Receivers'} - ${year} Season`,
          font: { size: 16, weight: 'bold' },
          padding: 20
        }
      }
    }
  };

  return new Chart(document.getElementById('chart'), config);
}
```

## 3. Team vs. Team Comparison

For head-to-head or season comparison between two teams.

```javascript
async function createTeamComparisonChart(team1, team2, year, metric = 'SR') {
  // Fetch data for both teams
  const team1Plays = await fetchSeasonData(team1, year);
  const team2Plays = await fetchSeasonData(team2, year);

  const team1Offense = team1Plays.filter(p => p.offense === team1);
  const team2Offense = team2Plays.filter(p => p.offense === team2);

  // Group by category (e.g., down)
  const categories = ['1st Down', '2nd Down', '3rd Down', '4th Down'];
  const team1Data = [];
  const team2Data = [];

  for (let down = 1; down <= 4; down++) {
    const t1Plays = team1Offense.filter(p => p.down === down);
    const t2Plays = team2Offense.filter(p => p.down === down);

    if (metric === 'SR') {
      const t1Success = t1Plays.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));
      const t2Success = t2Plays.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));
      team1Data.push((t1Success.length / t1Plays.length * 100).toFixed(1));
      team2Data.push((t2Success.length / t2Plays.length * 100).toFixed(1));
    }
  }

  const colors1 = await getTeamColors(team1);
  const colors2 = await getTeamColors(team2);

  const config = {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [
        {
          label: team1,
          data: team1Data,
          backgroundColor: colors1.success,
          borderColor: colors1.explosive,
          borderWidth: 2
        },
        {
          label: team2,
          data: team2Data,
          backgroundColor: colors2.success,
          borderColor: colors2.explosive,
          borderWidth: 2
        },
        {
          type: 'line',
          label: 'NCAA Average (43.3%)',
          data: [43.3, 43.3, 43.3, 43.3],
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales.y,
          max: 100,
          ticks: {
            callback: (value) => value + '%'
          }
        }
      },
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: `${team1} vs ${team2} - Success Rate by Down (${year})`,
          font: { size: 16, weight: 'bold' },
          padding: 20
        }
      }
    }
  };

  return new Chart(document.getElementById('chart'), config);
}
```

## 4. Offense vs. Defense (Team Performance)

Show team's offensive performance vs. opponents' offensive performance (team's defensive performance).

```javascript
async function createOffenseDefenseChart(teamName, year) {
  const plays = await fetchSeasonData(teamName, year);

  // Split into offense and defense
  const offensivePlays = plays.filter(p => p.offense === teamName);
  const defensivePlays = plays.filter(p => p.offense !== teamName); // Opponents' offense

  // Calculate metrics by down
  const categories = ['1st', '2nd', '3rd', '4th'];
  const offenseSR = [];
  const defenseSR = [];

  for (let down = 1; down <= 4; down++) {
    const offPlays = offensivePlays.filter(p => p.down === down);
    const defPlays = defensivePlays.filter(p => p.down === down);

    const offSuccess = offPlays.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));
    const defSuccess = defPlays.filter(p => calculateSuccess(p.down, p.distance, p.yards_gained));

    offenseSR.push((offSuccess.length / offPlays.length * 100).toFixed(1));
    defenseSR.push((defSuccess.length / defPlays.length * 100).toFixed(1));
  }

  const colors = await getTeamColors(teamName);

  const config = {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [
        {
          label: `${teamName} Offense`,
          data: offenseSR,
          backgroundColor: colors.success,
          borderColor: colors.explosive,
          borderWidth: 2
        },
        {
          label: `Opponents Offense (${teamName} Defense)`,
          data: defenseSR,
          backgroundColor: 'rgba(220, 38, 38, 0.7)',
          borderColor: 'rgba(153, 27, 27, 1)',
          borderWidth: 2
        },
        {
          type: 'line',
          label: 'NCAA Average',
          data: [43.3, 43.3, 43.3, 43.3],
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales.y,
          max: 100,
          ticks: {
            callback: (value) => value + '%'
          }
        }
      },
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: `${teamName} Offense vs Defense - ${year} Season`,
          font: { size: 16, weight: 'bold' },
          padding: 20
        },
        subtitle: {
          display: true,
          text: 'Success Rate by Down',
          font: { size: 13 },
          padding: { bottom: 15 }
        }
      }
    }
  };

  return new Chart(document.getElementById('chart'), config);
}
```

## 5. Line Chart (Trend Over Games)

Track performance across individual games in a season.

```javascript
async function createSeasonTrendChart(teamName, year, metric = 'SR') {
  const headers = {
    'Accept': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY_HERE'
  };

  const gamesResponse = await fetch(
    `https://api.collegefootballdata.com/games?year=${year}&team=${encodeURIComponent(teamName)}`,
    { headers }
  );
  const games = await gamesResponse.json();

  const labels = [];
  const dataPoints = [];

  for (const game of games) {
    const playsResponse = await fetch(
      `https://api.collegefootballdata.com/plays?gameId=${game.id}`,
      { headers }
    );
    const plays = await playsResponse.json();
    const teamPlays = plays.filter(p => p.offense === teamName);

    // Calculate metric for this game
    if (metric === 'SR') {
      const successful = teamPlays.filter(p =>
        calculateSuccess(p.down, p.distance, p.yards_gained)
      );
      dataPoints.push((successful.length / teamPlays.length * 100).toFixed(1));
    }

    // Label: Opponent name
    const opponent = game.homeTeam === teamName ? game.awayTeam : game.homeTeam;
    labels.push(`vs ${opponent}`);
  }

  const colors = await getTeamColors(teamName);

  const config = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${teamName} Success Rate`,
          data: dataPoints,
          borderColor: colors.explosive,
          backgroundColor: colors.success,
          tension: 0.2,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: false
        },
        {
          label: 'NCAA Average',
          data: Array(labels.length).fill(43.3),
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales.y,
          max: 100,
          ticks: {
            callback: (value) => value + '%'
          }
        },
        x: {
          ...baseOptions.scales.x,
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        ...baseOptions.plugins,
        title: {
          display: true,
          text: `${teamName} Success Rate Trend - ${year} Season`,
          font: { size: 16, weight: 'bold' },
          padding: 20
        }
      }
    }
  };

  return new Chart(document.getElementById('chart'), config);
}
```

## Save Chart as PNG

Include this function in every generated HTML to allow users to save charts:

```javascript
function saveChart() {
  const canvas = document.getElementById('chart');
  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 'cfb-analysis.png';
  link.href = url;
  link.click();
}
```

## Helper Functions

Include these in your generated HTML:

```javascript
// Group plays by category
function groupByCategory(plays, category) {
  const groups = {};

  plays.forEach(play => {
    let key;
    if (category === 'quarter') {
      key = play.quarter > 4 ? 'OT' : `Q${play.quarter}`;
    } else if (category === 'down') {
      key = `${play.down}${play.down === 1 ? 'st' : play.down === 2 ? 'nd' : play.down === 3 ? 'rd' : 'th'}`;
    } else if (category === 'playType') {
      key = play.play_type?.toLowerCase().includes('rush') ? 'Rush' : 'Pass';
    } else if (category === 'distance') {
      if (play.distance <= 3) key = 'Short (1-3)';
      else if (play.distance <= 7) key = 'Medium (4-7)';
      else key = 'Long (8+)';
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(play);
  });

  return groups;
}

// Aggregate multi-game data
async function fetchSeasonData(team, year) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY_HERE'
  };

  const gamesResponse = await fetch(
    `https://api.collegefootballdata.com/games?year=${year}&team=${encodeURIComponent(team)}`,
    { headers }
  );
  const games = await gamesResponse.json();

  let allPlays = [];
  for (const game of games) {
    const playsResponse = await fetch(
      `https://api.collegefootballdata.com/plays?gameId=${game.id}`,
      { headers }
    );
    const plays = await playsResponse.json();
    allPlays = allPlays.concat(plays);
  }

  return allPlays;
}
```

## Notes

- Always include NCAA average reference line (43.3% for SR)
- Use team colors from `getTeamColors()` function
- For multi-game analysis, aggregate both team offense AND opponent offense (defensive performance)
- Include loading states and error handling
- Format percentages to 1 decimal place
- Use stacked bars for player charts
- Use grouped bars for team comparisons
