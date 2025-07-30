import React from 'react';
import { Copy, TrendingUp, Target, Users, MapPin, Activity, Clock, Flag, Zap } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { PlayData } from '../types';
import { getTeamColors } from '../utils/teamColors';
import { calculatePlayerStats } from '../utils/metrics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

// Set Chart.js global defaults to match the reference JS file exactly
ChartJS.defaults.plugins.legend.align = 'start';
ChartJS.defaults.maintainAspectRatio = false;
ChartJS.defaults.plugins.legend.labels.borderRadius = 15;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
ChartJS.defaults.plugins.legend.labels.padding = 12;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.elements.line.tension = 0.25;
ChartJS.defaults.elements.line.borderWidth = 1;
ChartJS.defaults.elements.point.pointRadius = 4;
ChartJS.defaults.elements.point.pointHoverRadius = 8;
ChartJS.defaults.elements.point.pointBorderWidth = 1;
ChartJS.defaults.plugins.datalabels.color = 'white';
ChartJS.defaults.plugins.datalabels.backgroundColor = '#26262660';
ChartJS.defaults.plugins.datalabels.padding = 4;
ChartJS.defaults.plugins.datalabels.borderRadius = 4;

interface ChartsGridProps {
  plays: PlayData[];
  team: string;
}

const ChartsGrid: React.FC<ChartsGridProps> = ({ plays, team }) => {
  const handleCopyEmbed = (chartId: string, title: string) => {
    const embedCode = `<iframe src="https://your-domain.com/embed/chart/${chartId}" width="600" height="400" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    console.log(`Embed code copied for: ${title}`);
  };

  // Get opponent team
  const opponentTeam = plays.find(p => p.offense !== team && p.defense !== team)?.offense || 
                      plays.find(p => p.defense !== team)?.defense || 'Opponent';

  // Filter plays by team
  const teamPlays = plays.filter(p => p.offense === team);
  const opponentPlays = plays.filter(p => p.offense === opponentTeam);

  // Get team colors
  const teamColors = getTeamColors(team);
  const opponentColors = getTeamColors(opponentTeam);

  // Helper function to get point colors based on success/explosiveness
  const getPointColors = (playsArray: PlayData[], teamColors: any) => {
    return playsArray.map(play => {
      if (play.explosiveness) return teamColors.explosive;
      if (play.success) return teamColors.success;
      return 'rgba(255,255,255,0.9)';
    });
  };

  // Helper function to group plays by category and calculate SR/XR
  const groupByCategory = (playsArray: PlayData[], category: 'quarter' | 'down' | 'playType' | 'redZone' | 'distance') => {
    const groups: { [key: string]: PlayData[] } = {};
    
    playsArray.forEach(play => {
      let key: string;
      if (category === 'quarter') {
        key = `Q${play.quarter}`;
      } else if (category === 'down') {
        key = `${play.down}${play.down === 1 ? 'st' : play.down === 2 ? 'nd' : play.down === 3 ? 'rd' : 'th'} Down`;
      } else if (category === 'playType') {
        key = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run') ? 'Rush' : 'Pass';
      } else if (category === 'redZone') {
        key = play.yardsToGoal <= 20 ? 'Red Zone' : 'Other';
      } else if (category === 'distance') {
        if (play.distance <= 3) key = 'Short (1-3)';
        else if (play.distance <= 7) key = 'Medium (4-7)';
        else key = 'Long (8+)';
      } else {
        key = 'Other';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(play);
    });

    return Object.entries(groups).map(([label, groupPlays]) => ({
      label,
      count: groupPlays.length,
      sr: groupPlays.length > 0 ? groupPlays.filter(p => p.success).length / groupPlays.length : 0,
      xr: groupPlays.length > 0 ? groupPlays.filter(p => p.explosiveness).length / groupPlays.length : 0
    }));
  };

  // Helper function to create quarter gridlines
  const createQuarterGridlines = (playsData: PlayData[], maxX: number, yMin: number = 0, yMax: number = 1) => {
    const quarters = Array.from(new Set(playsData.map(p => p.quarter))).sort((a, b) => a - b);
    const quarterLines: any[] = [];
    
    quarters.forEach(quarter => {
      const firstPlayOfQuarter = playsData.find(p => p.quarter === quarter);
      if (firstPlayOfQuarter) {
        quarterLines.push(
          { x: firstPlayOfQuarter.playNumber, y: yMin },
          { x: firstPlayOfQuarter.playNumber, y: yMax },
          { x: maxX, y: yMax },
          { x: maxX, y: yMin }
        );
      }
    });

    return {
      label: 'Quarters',
      data: quarterLines,
      borderColor: 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      tension: 0,
      fill: false,
      pointRadius: 0,
      showLine: true,
      datalabels: {
        display: false
      }
    };
  };

  // Helper function to create quarter gridlines for team play numbers
  const createTeamQuarterGridlines = (teamPlaysData: PlayData[], maxX: number, yMin: number = 0, yMax: number = 1) => {
    const quarters = Array.from(new Set(teamPlaysData.map(p => p.quarter))).sort((a, b) => a - b);
    const quarterLines: any[] = [];
    
    quarters.forEach(quarter => {
      const firstPlayOfQuarter = teamPlaysData.find(p => p.quarter === quarter);
      if (firstPlayOfQuarter) {
        quarterLines.push(
          { x: firstPlayOfQuarter.teamPlayNumber, y: yMin },
          { x: firstPlayOfQuarter.teamPlayNumber, y: yMax },
          { x: maxX, y: yMax },
          { x: maxX, y: yMin }
        );
      }
    });

    return {
      label: 'Quarters',
      data: quarterLines,
      borderColor: 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      tension: 0,
      fill: false,
      pointRadius: 0,
      showLine: true,
      datalabels: {
        display: false
      }
    };
  };

  // Chart options
  const percentCallback = (value: number) => `${Math.round(value * 100)}%`;
  
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      },
      tooltip: {
        filter: function(tooltipItem: any) {
          // Hide reference areas and quarter lines from tooltip
          return !tooltipItem.dataset.label.includes('NCAA Avg SR') && 
                 !tooltipItem.dataset.label.includes('50/50') && 
                 !tooltipItem.dataset.label.includes('< 0') &&
                 !tooltipItem.dataset.label.includes('Quarters');
        },
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${Math.round(context.parsed.y * 100)}%`
        }
      },
      datalabels: {
        color: 'white',
        backgroundColor: '#26262660',
        padding: 4,
        borderRadius: 4,
        display: false, // Default to false, enable per dataset as needed
      }
    },
  };

  // Tooltip configuration for charts with play text
  const tooltipWithPlayText = {
    filter: function(tooltipItem: any) {
      // Hide reference areas and quarter lines from tooltip
      return !tooltipItem.dataset.label.includes('NCAA Avg SR') && 
             !tooltipItem.dataset.label.includes('50/50') && 
             !tooltipItem.dataset.label.includes('< 0') &&
             !tooltipItem.dataset.label.includes('Quarters');
    },
    callbacks: {
      label: (context: any) => {
        const label = `${context.dataset.label}: ${Math.round(context.parsed.y * 100)}%`;
        const text = context.raw.text;
        return text ? [label, text] : label;
      }
    }
  };

  // Helper function to create filled area below reference line
  const createReferenceArea = (maxX: number, referenceY: number, label: string) => ({
    label,
    data: [
      { x: 1, y: 0 },
      { x: 1, y: referenceY },
      { x: maxX, y: referenceY },
      { x: maxX, y: 0 }
    ],
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderColor: 'transparent',
    pointRadius: 0,
    fill: true,
    tension: 0,
    showLine: true,
    datalabels: {
      display: false
    }
  });

  // Helper function to create filled area below zero for play maps
  const createBelowZeroArea = (maxX: number, minY: number = -50) => ({
    label: '< 0',
    data: [
      { x: 1, y: 0 },
      { x: 1, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: 0 }
    ],
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderColor: 'transparent',
    pointRadius: 0,
    fill: true,
    tension: 0,
    showLine: true,
    datalabels: {
      display: false
    }
  });

  // Line chart options with LINEAR X-axis for play numbers - SPECIFIC FOR SR/XR OVER TIME
  const lineOptionsPlayNumberSRXR = {
    ...baseOptions,
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: 'Play Number'
        },
        min: 1,
        ticks: {
          stepSize: 1,
          callback: (value: any) => Math.floor(value)
        },
        grid: {
          display: false // Hide default gridlines since we're using quarter lines
        }
      },
      y: {
        max: 1,
        min: 0,
        ticks: { callback: percentCallback }
      }
    },
    elements: {
      line: { tension: 0.25, borderWidth: 2.2 },
      point: { pointRadius: 0 } // Hide points on this chart
    },
    plugins: {
      ...baseOptions.plugins,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: false, // Use boxes instead of point styles
          boxWidth: 12, // Larger box size for better visibility
          boxHeight: 12, // Keep 1:1 ratio
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      },
      tooltip: tooltipWithPlayText
    }
  };

  // Line chart options with LINEAR X-axis for play numbers
  const lineOptionsPlayNumber = {
    ...baseOptions,
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: 'Play Number'
        },
        min: 1,
        ticks: {
          stepSize: 1,
          callback: (value: any) => Math.floor(value)
        },
        grid: {
          display: false // Hide default gridlines since we're using quarter lines
        }
      },
      y: {
        max: 1,
        min: 0,
        ticks: { callback: percentCallback }
      }
    },
    elements: {
      line: { tension: 0.25, borderWidth: 2.2 }
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: tooltipWithPlayText,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: true,
          generateLabels: function(chart: any) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original.call(this, chart);
            
            // Customize each label based on dataset
            labels.forEach((label: any, index: number) => {
              const dataset = chart.data.datasets[index];
              if (dataset && dataset.label) {
                if (dataset.label.includes('Rush')) {
                  label.pointStyle = 'circle';
                  label.pointStyleWidth = 4;
                } else if (dataset.label.includes('Pass')) {
                  label.pointStyle = 'triangle';
                  label.pointStyleWidth = 4;
                } else {
                  label.pointStyle = 'rect';
                  label.pointStyleWidth = 4;
                }
              }
            });
            
            return labels;
          },
          boxWidth: 20,
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      }
    }
  };

  // Line chart options with LINEAR X-axis for team play numbers
  const lineOptionsTeamPlay = {
    ...baseOptions,
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: 'Team Play Number'
        },
        min: 1,
        ticks: {
          stepSize: 1,
          callback: (value: any) => Math.floor(value)
        },
        grid: {
          display: false // Hide default gridlines since we're using quarter lines
        }
      },
      y: {
        max: 1,
        min: 0,
        ticks: { callback: percentCallback }
      }
    },
    elements: {
      line: { tension: 0.25, borderWidth: 2.2 }
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: tooltipWithPlayText,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: true,
          generateLabels: function(chart: any) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original.call(this, chart);
            
            // Customize each label based on dataset
            labels.forEach((label: any, index: number) => {
              const dataset = chart.data.datasets[index];
              if (dataset) {
                 if (dataset.pointStyle === 'circle') {
                     label.pointStyle = 'circle';
                     // This line correctly sets the size
                     label.radius = Array.isArray(dataset.pointRadius) ? 4 : dataset.pointRadius || 4;
                 } else if (dataset.pointStyle === 'triangle') {
                     label.pointStyle = 'triangle';
                     // This line correctly sets the size
                     label.radius = Array.isArray(dataset.pointRadius) ? 6 : dataset.pointRadius || 6;
                 }
              }
            });
            
            return labels;
          },
          boxWidth: 20,
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      }
    }
  };

  const barOptions = {
    ...baseOptions,
    scales: {
      y: {
        max: 1,
        min: 0,
        stacked: false,
        ticks: { callback: percentCallback }
      }
    },
    plugins: {
      ...baseOptions.plugins,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: false, // Use boxes for bar charts
          boxWidth: 12, // Smaller box size for bar charts
          boxHeight: 12, // Keep 1:1 ratio
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      }
    }
  };

  // 1. Overall Team Performance Chart
  const teamSuccessfulPlays = teamPlays.filter(p => p.success).length;
  const teamExplosivePlays = teamPlays.filter(p => p.explosiveness).length;
  const opponentSuccessfulPlays = opponentPlays.filter(p => p.success).length;
  const opponentExplosivePlays = opponentPlays.filter(p => p.explosiveness).length;

  const overallTeamData = {
    labels: [team, opponentTeam],
    datasets: [
      {
        label: 'XR',
        data: [
          teamPlays.length > 0 ? teamExplosivePlays / teamPlays.length : 0,
          opponentPlays.length > 0 ? opponentExplosivePlays / opponentPlays.length : 0
        ],
        backgroundColor: [teamColors.explosive, opponentColors.explosive],
        stack: 'SRXR',
        datalabels: {
          display: false
        }
      },
      {
        label: 'SR',
        data: [
          teamPlays.length > 0 ? teamSuccessfulPlays / teamPlays.length : 0,
          opponentPlays.length > 0 ? opponentSuccessfulPlays / opponentPlays.length : 0
        ],
        backgroundColor: [teamColors.success, opponentColors.success],
        stack: 'SRXR',
        datalabels: {
          display: true,
          formatter: (value: number, context: any) => {
            return context.dataIndex === 0 ? teamPlays.length : opponentPlays.length;
          }
        }
      },
      // NCAA Average reference line
      {
        type: 'line' as const,
        data: [0.42, 0.42],
        label: "NCAA Avg SR",
        borderColor: '#757575',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        datalabels: {
          display: false
        }
      }
    ]
  };

  // Helper function to create team vs opponent bar chart data following your pattern
  const createTeamVsOpponentBarData = (category: 'quarter' | 'down' | 'playType' | 'redZone' | 'distance') => {
    const teamData = groupByCategory(teamPlays, category);
    const opponentData = groupByCategory(opponentPlays, category);
    
    // Get all unique labels from both teams
    const allLabels = Array.from(new Set([
      ...teamData.map(d => d.label),
      ...opponentData.map(d => d.label)
    ])).sort();

    // Create data arrays ensuring all labels are represented
    const teamSR = allLabels.map(label => {
      const found = teamData.find(d => d.label === label);
      return found ? found.sr : 0;
    });
    
    const teamXR = allLabels.map(label => {
      const found = teamData.find(d => d.label === label);
      return found ? found.xr : 0;
    });
    
    const oppSR = allLabels.map(label => {
      const found = opponentData.find(d => d.label === label);
      return found ? found.sr : 0;
    });
    
    const oppXR = allLabels.map(label => {
      const found = opponentData.find(d => d.label === label);
      return found ? found.xr : 0;
    });

    // Create count arrays for data labels
    const teamCounts = allLabels.map(label => {
      const found = teamData.find(d => d.label === label);
      return found ? found.count : 0;
    });
    
    const oppCounts = allLabels.map(label => {
      const found = opponentData.find(d => d.label === label);
      return found ? found.count : 0;
    });

    return {
      labels: allLabels,
      datasets: [
        {
          data: teamXR,
          stack: 'Team',
          label: `${team} XR`,
          backgroundColor: teamColors.explosive,
          datalabels: {
            display: false
          }
        },
        {
          data: teamSR,
          stack: 'Team',
          label: `${team} SR`,
          backgroundColor: teamColors.success,
          datalabels: {
            display: true,
            formatter: (value: number, context: any) => {
              return teamCounts[context.dataIndex];
            }
          }
        },
        {
          data: oppXR,
          stack: 'Opponent',
          label: `${opponentTeam} XR`,
          backgroundColor: opponentColors.explosive,
          datalabels: {
            display: false
          }
        },
        {
          data: oppSR,
          stack: 'Opponent',
          label: `${opponentTeam} SR`,
          backgroundColor: opponentColors.success,
          datalabels: {
            display: true,
            formatter: (value: number, context: any) => {
              return oppCounts[context.dataIndex];
            }
          }
        },
        // NCAA Average reference line
        {
          type: 'line' as const,
          data: Array(allLabels.length).fill(0.42),
          label: "NCAA Avg SR",
          borderColor: '#757575',
          borderWidth: 2,
          borderDash: [3, 3],
          pointRadius: 0,
          datalabels: {
            display: false
          }
        }
      ]
    };
  };

  // LINE CHARTS USING CUMULATIVE DATA

  // 2. SR and XR by Team - using cumulative data from processed plays, X-axis = Play Number
  const maxPlayNumber = Math.max(...plays.map(p => p.playNumber));
  
  const teamLinesData = {
    datasets: [
      // Reference area first (drawn behind other elements)
      createReferenceArea(maxPlayNumber, 0.42, "NCAA Avg SR"),
      {
        data: teamPlays.map(play => ({ 
          x: play.playNumber, 
          y: play.teamCumulativeXR, 
          text: play.playText 
        })),
        label: `${team} XR`,
        borderColor: teamColors.explosive,
        borderWidth: 2.2,
        fill: false,
      },
      {
        data: teamPlays.map(play => ({ 
          x: play.playNumber, 
          y: play.teamCumulativeSR, 
          text: play.playText 
        })),
        label: `${team} SR`,
        borderColor: teamColors.success,
        borderWidth: 2.2,
        fill: false,
      },
      {
        data: opponentPlays.map(play => ({ 
          x: play.playNumber, 
          y: play.teamCumulativeXR, 
          text: play.playText 
        })),
        label: `${opponentTeam} XR`,
        borderColor: opponentColors.explosive,
        borderWidth: 2.2,
        borderDash: [4, 4],
        fill: false,
      },
      {
        data: opponentPlays.map(play => ({ 
          x: play.playNumber, 
          y: play.teamCumulativeSR, 
          text: play.playText 
        })),
        label: `${opponentTeam} SR`,
        borderColor: opponentColors.success,
        borderWidth: 2.2,
        borderDash: [4, 4],
        fill: false,
      },
      // Quarter gridlines
      createQuarterGridlines(plays, maxPlayNumber, 0, 1)
    ],
  };

  // 3. SR by Play Type - Team version, X-axis = Team Play Number
  const maxTeamPlayNumber = Math.max(...teamPlays.map(p => p.teamPlayNumber));
  
  const teamPlayTypeLinesData = {
    datasets: [
      // Reference area first
      createReferenceArea(maxTeamPlayNumber, 0.42, "NCAA Avg SR"),
      {
        data: teamPlays.map(play => ({
          x: play.teamPlayNumber,
          y: play.teamRushCumulativeSR,
          text: play.playText,
        })),
        label: `${team} Rush SR`,
        borderColor: teamColors.explosive,
        backgroundColor: teamPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          if (!isRush) return 'rgba(255,255,255,0.9)';
          return getPointColors([play], teamColors)[0];
        }),
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: teamPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          return isRush ? 4 : 0;
        }),
        pointBorderWidth: 1,
        pointBorderColor: teamColors.explosive,
        showLine: true,
      },
      {
        data: teamPlays.map(play => ({
          x: play.teamPlayNumber,
          y: play.teamPassCumulativeSR,
          text: play.playText,
        })),
        label: `${team} Pass SR`,
        borderColor: teamColors.explosive,
        backgroundColor: teamPlays.map(play => {
          const isPass = play.playType?.toLowerCase().includes('pass');
          if (!isPass) return 'rgba(255,255,255,0.9)';
          return getPointColors([play], teamColors)[0];
        }),
        borderWidth: 2,
        pointStyle: 'triangle',
        pointRadius: teamPlays.map(play => {
          const isPass = play.playType?.toLowerCase().includes('pass');
          return isPass ? 6 : 0;
        }),
        pointBorderWidth: 1,
        pointBorderColor: teamColors.explosive,
        borderDash: [4, 4],
        showLine: true,
      },
      // Quarter gridlines
      createTeamQuarterGridlines(teamPlays, maxTeamPlayNumber, 0, 1)
    ],
  };

  // 4. SR by Play Type - Opponent version, X-axis = Team Play Number
  const maxOpponentPlayNumber = Math.max(...opponentPlays.map(p => p.teamPlayNumber));
  
  const opponentPlayTypeLinesData = {
    datasets: [
      // Reference area first
      createReferenceArea(maxOpponentPlayNumber, 0.42, "NCAA Avg SR"),
      {
        data: opponentPlays.map(play => ({
          x: play.teamPlayNumber,
          y: play.teamRushCumulativeSR,
          text: play.playText,
        })),
        label: `${opponentTeam} Rush SR`,
        borderColor: opponentColors.explosive,
        backgroundColor: opponentPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          if (!isRush) return 'rgba(255,255,255,0.9)';
          return getPointColors([play], opponentColors)[0];
        }),
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: opponentPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          return isRush ? 4 : 0;
        }),
        pointBorderWidth: 1,
        pointBorderColor: opponentColors.explosive,
        showLine: true,
      },
      {
        data: opponentPlays.map(play => ({
          x: play.teamPlayNumber,
          y: play.teamPassCumulativeSR,
          text: play.playText,
        })),
        label: `${opponentTeam} Pass SR`,
        borderColor: opponentColors.explosive,
        backgroundColor: opponentPlays.map(play => {
          const isPass = play.playType?.toLowerCase().includes('pass');
          if (!isPass) return 'rgba(255,255,255,0.9)';
          return getPointColors([play], opponentColors)[0];
        }),
        borderWidth: 2,
        pointStyle: 'triangle',
        pointRadius: opponentPlays.map(play => {
          const isPass = play.playType?.toLowerCase().includes('pass');
          return isPass ? 6 : 0;
        }),
        pointBorderWidth: 1,
        pointBorderColor: opponentColors.explosive,
        borderDash: [4, 4],
        showLine: true,
      },
      // Quarter gridlines
      createTeamQuarterGridlines(opponentPlays, maxOpponentPlayNumber, 0, 1)
    ],
  };

  // 5. Rush Rate - Team version, X-axis = Team Play Number
  const teamRushRateData = {
    datasets: [
      // 50/50 reference area first
      createReferenceArea(maxTeamPlayNumber, 0.5, "50/50"),
      {
        data: teamPlays.map(play => ({
          x: play.teamPlayNumber,
          y: play.teamCumulativeRushRate,
          text: play.playText
        })),
        label: `${team} Rush Rate`,
        borderColor: teamColors.explosive,
        backgroundColor: teamColors.light,
        borderWidth: 2,
        pointBackgroundColor: teamPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          if (!isRush) return 'rgba(255,255,255,0.9)';
          return getPointColors([play], teamColors)[0];
        }),
        pointStyle: teamPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          return isRush ? 'circle' : 'triangle';
        }),
        pointRadius: teamPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          return isRush ? 4 : 5.5;
        }),
        pointBorderWidth: 1,
        pointBorderColor: teamColors.explosive,
        fill: true,
      },
      // Quarter gridlines
      createTeamQuarterGridlines(teamPlays, maxTeamPlayNumber, 0, 1)
    ],
  };

  // 6. Rush Rate - Opponent version, X-axis = Team Play Number
  const opponentRushRateData = {
    datasets: [
      // 50/50 reference area first
      createReferenceArea(maxOpponentPlayNumber, 0.5, "50/50"),
      {
        data: opponentPlays.map(play => ({
          x: play.teamPlayNumber,
          y: play.teamCumulativeRushRate,
          text: play.playText
        })),
        label: `${opponentTeam} Rush Rate`,
        borderColor: opponentColors.explosive,
        backgroundColor: opponentColors.light,
        borderWidth: 2,
        pointBackgroundColor: opponentPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          if (!isRush) return 'rgba(255,255,255,0.9)';
          return getPointColors([play], opponentColors)[0];
        }),
        pointStyle: opponentPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          return isRush ? 'circle' : 'triangle';
        }),
        pointRadius: opponentPlays.map(play => {
          const isRush = play.playType?.toLowerCase().includes('rush') || play.playType?.toLowerCase().includes('run');
          return isRush ? 4 : 5.5;
        }),
        pointBorderWidth: 1,
        pointBorderColor: opponentColors.explosive,
        fill: true,
      },
      // Quarter gridlines
      createTeamQuarterGridlines(opponentPlays, maxOpponentPlayNumber, 0, 1)
    ],
  };

  // 7. Play Map - Team version, X-axis = Play Number
  const teamRushPlays = teamPlays.filter(p => p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run'));
  const teamPassPlays = teamPlays.filter(p => p.playType?.toLowerCase().includes('pass'));

  // Calculate Y-axis bounds with defaults from your JS code
  const teamYardsGained = teamPlays.map(p => p.yardsGained);
  const teamMinY = Math.min(...teamYardsGained, -15); // Default minimum -15
  const teamMaxY = Math.max(...teamYardsGained, 75);  // Default maximum 75

  const teamPlayMapData = {
    datasets: [
      // Below zero area using the proper function
      createBelowZeroArea(maxPlayNumber, teamMinY),
      {
        label: `${team} Rush Yards`,
        data: teamRushPlays.map((play) => ({
          x: play.playNumber,
          y: play.yardsGained,
          text: play.playText
        })),
        backgroundColor: getPointColors(teamRushPlays, teamColors),
        pointStyle: 'circle',
        pointRadius: 4,
        pointBorderWidth: 1,
        pointBorderColor: teamColors.explosive,
        showLine: false,
      },
      {
        label: `${team} Pass Yards`,
        data: teamPassPlays.map((play) => ({
          x: play.playNumber,
          y: play.yardsGained,
          text: play.playText
        })),
        backgroundColor: getPointColors(teamPassPlays, teamColors),
        pointStyle: 'triangle',
        pointRadius: 5.5,
        pointBorderWidth: 1,
        pointBorderColor: teamColors.explosive,
        showLine: false,
      },
      // Quarter gridlines for play map
      createQuarterGridlines(plays, maxPlayNumber, teamMinY, teamMaxY)
    ],
  };

  // 8. Play Map - Opponent version, X-axis = Play Number
  const oppRushPlays = opponentPlays.filter(p => p.playType?.toLowerCase().includes('rush') || p.playType?.toLowerCase().includes('run'));
  const oppPassPlays = opponentPlays.filter(p => p.playType?.toLowerCase().includes('pass'));

  // Calculate Y-axis bounds with defaults from your JS code
  const oppYardsGained = opponentPlays.map(p => p.yardsGained);
  const oppMinY = Math.min(...oppYardsGained, -15); // Default minimum -15
  const oppMaxY = Math.max(...oppYardsGained, 75);  // Default maximum 75

  const opponentPlayMapData = {
    datasets: [
      // Below zero area using the proper function
      createBelowZeroArea(maxPlayNumber, oppMinY),
      {
        label: `${opponentTeam} Rush Yards`,
        data: oppRushPlays.map((play) => ({
          x: play.playNumber,
          y: play.yardsGained,
          text: play.playText
        })),
        backgroundColor: getPointColors(oppRushPlays, opponentColors),
        pointStyle: 'circle',
        pointRadius: 4,
        pointBorderWidth: 1,
        pointBorderColor: opponentColors.explosive,
        showLine: false,
      },
      {
        label: `${opponentTeam} Pass Yards`,
        data: oppPassPlays.map((play) => ({
          x: play.playNumber,
          y: play.yardsGained,
          text: play.playText
        })),
        backgroundColor: getPointColors(oppPassPlays, opponentColors),
        pointStyle: 'triangle',
        pointRadius: 5.5,
        pointBorderWidth: 1,
        pointBorderColor: opponentColors.explosive,
        showLine: false,
      },
      // Quarter gridlines for play map
      createQuarterGridlines(plays, maxPlayNumber, oppMinY, oppMaxY)
    ],
  };

  // Play Map options - using line chart with linear X-axis like other charts
  const playMapOptions = {
    ...baseOptions,
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: { display: true, text: 'Play Number' },
        min: 1,
        ticks: {
          stepSize: 1,
          callback: (value: any) => Math.floor(value)
        },
        grid: {
          display: false // Hide default gridlines since we're using quarter lines
        }
      },
      y: { 
        title: { display: true, text: 'Yards Gained' },
        min: teamMinY,
        max: teamMaxY
      }
    },
    elements: {
      line: { tension: 0, borderWidth: 0 }
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        filter: function(tooltipItem: any) {
          // Hide reference areas and quarter lines from tooltip
          return !tooltipItem.dataset.label.includes('< 0') &&
                 !tooltipItem.dataset.label.includes('Quarters');
        },
        callbacks: {
          label: (context: any) => {
            const label = `${context.dataset.label}: ${context.parsed.y} yards`;
            const text = context.raw.text;
            return text ? [label, text] : label;
          }
        }
      },
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: true,
          generateLabels: function(chart: any) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original.call(this, chart);
            
            // Customize each label based on dataset
            labels.forEach((label: any, index: number) => {
              const dataset = chart.data.datasets[index];
              if (dataset && dataset.label) {
                if (dataset.label.includes('Rush')) {
                  label.pointStyle = 'circle';
                  label.pointStyleWidth = 4;
                } else if (dataset.label.includes('Pass')) {
                  label.pointStyle = 'triangle';
                  label.pointStyleWidth = 4;
                } else {
                  label.pointStyle = 'rect';
                  label.pointStyleWidth = 4;
                }
              }
            });
            
            return labels;
          },
          boxWidth: 20,
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      }
    }
  };

  // Opponent play map options with different Y bounds
  const opponentPlayMapOptions = {
    ...playMapOptions,
    scales: {
      ...playMapOptions.scales,
      y: { 
        title: { display: true, text: 'Yards Gained' },
        min: oppMinY,
        max: oppMaxY
      }
    }
  };

  // 9. Drive Metrics - Team version
  const teamDriveGroups = teamPlays.reduce((acc, play) => {
    if (!acc[play.driveNumber]) acc[play.driveNumber] = [];
    acc[play.driveNumber].push(play);
    return acc;
  }, {} as Record<number, PlayData[]>);

  const teamDriveData = Object.entries(teamDriveGroups).map(([driveNum, drivePlays]) => ({
    label: `Drive ${driveNum}`,
    count: drivePlays.length,
    sr: drivePlays.filter(p => p.success).length / drivePlays.length,
    xr: drivePlays.filter(p => p.explosiveness).length / drivePlays.length
  }));

  const teamDriveChartData = {
    labels: teamDriveData.map(d => d.label),
    datasets: [
      {
        label: `${team} XR`,
        data: teamDriveData.map(d => d.xr),
        backgroundColor: teamColors.explosive,
        stack: 'SRXR',
        yAxisID: 'y',
        datalabels: {
          display: false
        }
      },
      {
        label: `${team} SR`,
        data: teamDriveData.map(d => d.sr),
        backgroundColor: teamColors.success,
        stack: 'SRXR',
        yAxisID: 'y',
        datalabels: {
          display: false
        }
      },
      {
        label: 'Plays in drive',
        data: teamDriveData.map(d => d.count),
        backgroundColor: 'rgba(148, 148, 148, 0.8)',
        stack: 'Plays',
        yAxisID: 'y1',
        datalabels: {
          display: true
        }
      },
    ],
  };

  // 10. Drive Metrics - Opponent version
  const opponentDriveGroups = opponentPlays.reduce((acc, play) => {
    if (!acc[play.driveNumber]) acc[play.driveNumber] = [];
    acc[play.driveNumber].push(play);
    return acc;
  }, {} as Record<number, PlayData[]>);

  const opponentDriveData = Object.entries(opponentDriveGroups).map(([driveNum, drivePlays]) => ({
    label: `Drive ${driveNum}`,
    count: drivePlays.length,
    sr: drivePlays.filter(p => p.success).length / drivePlays.length,
    xr: drivePlays.filter(p => p.explosiveness).length / drivePlays.length
  }));

  const opponentDriveChartData = {
    labels: opponentDriveData.map(d => d.label),
    datasets: [
      {
        label: `${opponentTeam} XR`,
        data: opponentDriveData.map(d => d.xr),
        backgroundColor: opponentColors.explosive,
        stack: 'SRXR',
        yAxisID: 'y',
        datalabels: {
          display: false
        }
      },
      {
        label: `${opponentTeam} SR`,
        data: opponentDriveData.map(d => d.sr),
        backgroundColor: opponentColors.success,
        stack: 'SRXR',
        yAxisID: 'y',
        datalabels: {
          display: false
        }
      },
      {
        label: 'Plays in drive',
        data: opponentDriveData.map(d => d.count),
        backgroundColor: 'rgba(148, 148, 148, 0.8)',
        stack: 'Plays',
        yAxisID: 'y1',
        datalabels: {
          display: true
        }
      },
    ],
  };

  const driveOptions = {
    ...baseOptions,
    scales: {
      y: {
        stacked: false,
        max: 1,
        ticks: { callback: percentCallback },
      },
      y1: {
        display: false,
        suggestedMax: Math.max(
          ...teamDriveData.map(d => d.count),
          ...opponentDriveData.map(d => d.count)
        ),
      }
    },
    plugins: {
      ...baseOptions.plugins,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: false, // Use boxes for bar charts
          boxWidth: 12, // Smaller box size for bar charts
          boxHeight: 12, // Keep 1:1 ratio
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      }
    }
  };

  // Player stats using the new calculatePlayerStats function for BOTH TEAMS
  const teamRushers = calculatePlayerStats(teamPlays, 'rush');
  const teamPassers = calculatePlayerStats(teamPlays, 'pass');
  const teamReceivers = calculatePlayerStats(teamPlays, 'receive');
  
  const opponentRushers = calculatePlayerStats(opponentPlays, 'rush');
  const opponentPassers = calculatePlayerStats(opponentPlays, 'pass');
  const opponentReceivers = calculatePlayerStats(opponentPlays, 'receive');

  // Combine and sort players by team, then by total plays
  const allRushers = [
    ...teamRushers.map(p => ({ ...p, team: team, teamColors })),
    ...opponentRushers.map(p => ({ ...p, team: opponentTeam, teamColors: opponentColors }))
  ].sort((a, b) => {
    // First sort by team (selected team first)
    if (a.team === team && b.team !== team) return -1;
    if (a.team !== team && b.team === team) return 1;
    // Then sort by total plays descending
    return b.total - a.total;
  });

  const allPassers = [
    ...teamPassers.map(p => ({ ...p, team: team, teamColors })),
    ...opponentPassers.map(p => ({ ...p, team: opponentTeam, teamColors: opponentColors }))
  ].sort((a, b) => {
    // First sort by team (selected team first)
    if (a.team === team && b.team !== team) return -1;
    if (a.team !== team && b.team === team) return 1;
    // Then sort by total plays descending
    return b.total - a.total;
  });

  const allReceivers = [
    ...teamReceivers.map(p => ({ ...p, team: team, teamColors })),
    ...opponentReceivers.map(p => ({ ...p, team: opponentTeam, teamColors: opponentColors }))
  ].sort((a, b) => {
    // First sort by team (selected team first)
    if (a.team === team && b.team !== team) return -1;
    if (a.team !== team && b.team === team) return 1;
    // Then sort by total plays descending
    return b.total - a.total;
  });

  const createPlayerData = (players: any[]) => ({
    labels: players.map(p => p.name),
    datasets: [
      {
        label: 'Explosive',
        data: players.map(p => p.explosive),
        backgroundColor: players.map(p => p.teamColors.explosive),
        borderColor: players.map(p => p.teamColors.colorDark),
        borderWidth: 1,
        stack: 1,
        datalabels: {
          display: (context: any) => context.dataset.data[context.dataIndex] > 0
        }
      },
      {
        label: 'Successful',
        data: players.map(p => p.successful),
        backgroundColor: players.map(p => p.teamColors.success),
        borderColor: players.map(p => p.teamColors.colorDark),
        borderWidth: 1,
        stack: 1,
        datalabels: {
          display: (context: any) => context.dataset.data[context.dataIndex] > 0
        }
      },
      {
        label: 'Unsuccessful',
        data: players.map(p => p.unsuccessful),
        backgroundColor: 'rgba(0,0,0,0.03)', // Light gray matching reference areas
        borderColor: players.map(p => p.teamColors.colorDark),
        borderWidth: 1,
        stack: 1,
        datalabels: {
          display: (context: any) => context.dataset.data[context.dataIndex] > 0
        }
      },
    ],
  });

  const playerOptions = {
    ...baseOptions,
    indexAxis: 'y' as const,
    scales: {
      y: { stacked: true },
      x: { stacked: true }
    },
    plugins: {
      ...baseOptions.plugins,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          usePointStyle: false, // Use boxes for bar charts
          boxWidth: 12, // Smaller box size for bar charts
          boxHeight: 12, // Keep 1:1 ratio
          padding: 12,
          filter: function(item: any) {
            // Hide reference areas and quarter lines from legend
            return !item.text.includes('NCAA Avg SR') && 
                   !item.text.includes('50/50') && 
                   !item.text.includes('< 0') &&
                   !item.text.includes('Quarters');
          }
        }
      }
    }
  };

  const teamCharts = [
    {
      id: 'overall-team-performance',
      title: 'SR and XR by Team',
      component: <Bar data={overallTeamData} options={barOptions} />
    },
    {
      id: 'team-sr-xr-lines',
      title: 'SR and XR over time (cumulative)',
      component: <Line data={teamLinesData} options={lineOptionsPlayNumberSRXR} />
    },
    {
      id: 'team-play-type-lines',
      title: `SR by Play Type: ${team}`,
      component: <Line data={teamPlayTypeLinesData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'opponent-play-type-lines',
      title: `SR by Play Type: ${opponentTeam}`,
      component: <Line data={opponentPlayTypeLinesData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'team-rush-rate',
      title: `Rush Rate: ${team}`,
      component: <Line data={teamRushRateData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'opponent-rush-rate',
      title: `Rush Rate: ${opponentTeam}`,
      component: <Line data={opponentRushRateData} options={lineOptionsTeamPlay} />
    },
    {
      id: 'team-play-map',
      title: `Play Map: ${team}`,
      component: <Line data={teamPlayMapData} options={playMapOptions} />
    },
    {
      id: 'opponent-play-map',
      title: `Play Map: ${opponentTeam}`,
      component: <Line data={opponentPlayMapData} options={opponentPlayMapOptions} />
    },
    {
      id: 'team-drive-metrics',
      title: `SR, XR, and Play Count by Drive: ${team}`,
      component: <Bar data={teamDriveChartData} options={driveOptions} />
    },
    {
      id: 'opponent-drive-metrics',
      title: `SR, XR, and Play Count by Drive: ${opponentTeam}`,
      component: <Bar data={opponentDriveChartData} options={driveOptions} />
    },
    {
      id: 'play-type-bars',
      title: 'SR and XR by Play Type (Bar Chart)',
      component: <Bar data={createTeamVsOpponentBarData('playType')} options={barOptions} />
    },
    {
      id: 'quarter-bars',
      title: 'SR and XR by Quarter',
      component: <Bar data={createTeamVsOpponentBarData('quarter')} options={barOptions} />
    },
    {
      id: 'down-bars',
      title: 'SR and XR by Down',
      component: <Bar data={createTeamVsOpponentBarData('down')} options={barOptions} />
    },
    {
      id: 'red-zone-bars',
      title: 'SR and XR by Red Zone',
      component: <Bar data={createTeamVsOpponentBarData('redZone')} options={barOptions} />
    },
    {
      id: 'distance-bars',
      title: 'SR and XR by Distance to Go',
      component: <Bar data={createTeamVsOpponentBarData('distance')} options={barOptions} />
    }
  ];

  const playerCharts = [
    {
      id: 'top-rushers',
      title: 'Top rushers',
      component: <Bar data={createPlayerData(allRushers)} options={playerOptions} />
    },
    {
      id: 'top-passers',
      title: 'Top passers',
      component: <Bar data={createPlayerData(allPassers)} options={playerOptions} />
    },
    {
      id: 'top-receivers',
      title: 'Top receivers',
      component: <Bar data={createPlayerData(allReceivers)} options={playerOptions} />
    }
  ];

  return (
    <div className="space-y-8">
      {/* Team Charts Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Team charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {teamCharts.map((chart) => (
            <div key={chart.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {chart.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(chart.id, chart.title)}
                  className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Copy embed code"
                >
                  <Copy className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {chart.component}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player Charts Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Player charts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Rushers and Passers stacked */}
          <div className="space-y-6">
            {/* Top Rushers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {playerCharts[0].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[0].id, playerCharts[0].title)}
                  className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Copy embed code"
                >
                  <Copy className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {playerCharts[0].component}
                </div>
              </div>
            </div>

            {/* Top Passers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {playerCharts[1].title}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopyEmbed(playerCharts[1].id, playerCharts[1].title)}
                  className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Copy embed code"
                >
                  <Copy className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="h-80">
                  {playerCharts[1].component}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Receivers spanning full height */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {playerCharts[2].title}
                </h3>
              </div>
              <button
                onClick={() => handleCopyEmbed(playerCharts[2].id, playerCharts[2].title)}
                className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Copy embed code"
              >
                <Copy className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="h-[41rem]">
                {playerCharts[2].component}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartsGrid;