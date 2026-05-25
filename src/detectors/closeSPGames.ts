import { fetchAllGames, TeamGame } from '../services/api';
import { fetchSPRatings, SPRating } from '../services/ratingsApi';
import { cachedFetch } from '../utils/apiCache';
import { getDisplayTeamColors } from '../utils/displayTeamColors';
import type { Detector, DetectorResult, DetectorFilters } from './types';

const POWER4 = ['ACC', 'SEC', 'Big 12', 'Big Ten'];
const TOP_N = 15;

interface CloseMatchup {
  game: TeamGame;
  homeRating: number;
  awayRating: number;
  gap: number;
  ratingFavorite: string;
  underdog: string;
  favoriteWon: boolean | null; // null if not completed
}

const isInConference = (teamConf: string | undefined, filter?: string): boolean => {
  if (!teamConf) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'power4') return POWER4.includes(teamConf);
  return teamConf === filter;
};

const passesConferenceFilter = (
  homeConf: string | undefined,
  awayConf: string | undefined,
  filter?: string
): boolean => {
  if (!filter || filter === 'all') return true;
  // Show games where at least one team matches the conference filter.
  return isInConference(homeConf, filter) || isInConference(awayConf, filter);
};

const buildMatchups = (
  games: TeamGame[],
  ratingByTeam: Map<string, SPRating>,
  filters: DetectorFilters
): CloseMatchup[] => {
  const matchups: CloseMatchup[] = [];

  for (const g of games) {
    if (!g.completed) continue;
    if (g.homeClassification !== 'fbs' || g.awayClassification !== 'fbs') continue;

    const home = ratingByTeam.get(g.homeTeam);
    const away = ratingByTeam.get(g.awayTeam);
    if (!home || !away) continue;

    if (!passesConferenceFilter(g.homeConference, g.awayConference, filters.conference)) continue;
    if (filters.team && g.homeTeam !== filters.team && g.awayTeam !== filters.team) continue;

    const gap = Math.abs(home.rating - away.rating);
    const favorite = home.rating >= away.rating ? g.homeTeam : g.awayTeam;
    const underdog = favorite === g.homeTeam ? g.awayTeam : g.homeTeam;
    const favoriteScore = favorite === g.homeTeam ? g.homePoints : g.awayPoints;
    const underdogScore = favorite === g.homeTeam ? g.awayPoints : g.homePoints;

    matchups.push({
      game: g,
      homeRating: home.rating,
      awayRating: away.rating,
      gap,
      ratingFavorite: favorite,
      underdog,
      favoriteWon: favoriteScore != null && underdogScore != null
        ? favoriteScore > underdogScore
        : null,
    });
  }

  return matchups.sort((a, b) => a.gap - b.gap).slice(0, TOP_N);
};

const matchupLabel = (m: CloseMatchup): string => {
  const g = m.game;
  const sep = g.neutralSite ? 'vs' : '@';
  return `${g.awayTeam} ${sep} ${g.homeTeam}`;
};

const matchupLabelWithWeek = (m: CloseMatchup): string => {
  const g = m.game;
  const sep = g.neutralSite ? 'vs' : '@';
  return `${g.awayTeam} ${sep} ${g.homeTeam} (W${g.week})`;
};

const matchupScoreText = (m: CloseMatchup): string => {
  const g = m.game;
  return `${g.awayTeam} ${g.awayPoints} — ${g.homeTeam} ${g.homePoints}`;
};

export const closeSPGamesDetector: Detector = {
  id: 'close-sp-games',
  title: 'Closest matchups by SP+',
  description:
    'Games where the two teams were rated most evenly. The true toss-ups of the season — outcome was genuinely up for grabs.',

  run: async (filters: DetectorFilters): Promise<DetectorResult> => {
    const [ratings, games] = await Promise.all([
      cachedFetch(`sp-ratings:${filters.year}`, () => fetchSPRatings(filters.year)),
      cachedFetch(`all-games:${filters.year}`, () => fetchAllGames(filters.year)),
    ]);

    const ratingByTeam = new Map<string, SPRating>();
    ratings
      .filter(r =>
        r.team &&
        r.team.toLowerCase() !== 'national average' &&
        r.team.toLowerCase() !== 'ncaa average' &&
        r.team.toLowerCase() !== 'nationalaverages'
      )
      .forEach(r => ratingByTeam.set(r.team, r));

    const matchups = buildMatchups(games, ratingByTeam, filters);

    if (matchups.length === 0) {
      return {
        headline: 'No close matchups found',
        subtext: 'Try widening the conference filter or pick a different season.',
        chart: {
          type: 'bar',
          data: { labels: [], datasets: [] },
          options: { responsive: true, maintainAspectRatio: false },
        },
      };
    }

    // matchups is sorted ascending by gap — labels[0] is at the top of a horizontal bar,
    // so the closest matchup naturally sits at the top.
    const chartMatchups = matchups;
    const maxGap = matchups[matchups.length - 1].gap;

    const labels = chartMatchups.map(matchupLabel);
    const data = chartMatchups.map(m => Number(m.gap.toFixed(2)));
    const backgroundColors = chartMatchups.map(m => {
      const colors = getDisplayTeamColors(m.ratingFavorite, 'default');
      return colors.success;
    });
    const borderColors = chartMatchups.map(m => {
      const colors = getDisplayTeamColors(m.ratingFavorite, 'default');
      return colors.color || colors.success;
    });

    const result: DetectorResult = {
      headline: `${matchups.length} closest matchups by SP+`,
      subtext: `${filters.year} season • Games rated within ${matchups[matchups.length - 1].gap.toFixed(1)} SP+ points`,
      callout: 'Close-on-paper games punch above their weight as story material — outcome was genuinely uncertain before kickoff, regardless of who won.',
      chart: {
        type: 'bar',
        height: Math.max(360, chartMatchups.length * 38),
        data: {
          labels,
          datasets: [
            {
              label: 'SP+ rating gap',
              data,
              backgroundColor: backgroundColors,
              borderColor: borderColors,
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: 'end',
              align: 'end',
              clip: false,
              color: '#374151',
              font: { weight: 'bold', size: 11 },
              formatter: (value: number) => value.toFixed(2),
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
            tooltip: {
              callbacks: {
                title: (items: any) => {
                  const m = chartMatchups[items[0]?.dataIndex];
                  return m ? matchupLabelWithWeek(m) : (items[0]?.label ?? '');
                },
                label: (item: any) => {
                  const m = chartMatchups[item.dataIndex];
                  if (!m) return '';
                  const favLine = `Rating favorite: ${m.ratingFavorite} (${(m.ratingFavorite === m.game.homeTeam ? m.homeRating : m.awayRating).toFixed(1)})`;
                  const dogLine = `Underdog: ${m.underdog} (${(m.underdog === m.game.homeTeam ? m.homeRating : m.awayRating).toFixed(1)})`;
                  const scoreLine = `Final: ${matchupScoreText(m)}`;
                  const outcomeLine =
                    m.favoriteWon === null
                      ? ''
                      : m.favoriteWon
                        ? 'Favorite held serve'
                        : 'Underdog upset';
                  return [favLine, dogLine, scoreLine, outcomeLine].filter(Boolean);
                },
              },
            },
          },
          layout: {
            padding: { right: 36 },
          },
          scales: {
            x: {
              beginAtZero: true,
              // Hug the data — just enough headroom for the end-of-bar datalabel.
              suggestedMax: Math.max(maxGap * 1.12, 0.05),
              title: { display: true, text: 'SP+ rating gap (points)' },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y: {
              ticks: { font: { size: 12 } },
              grid: { display: false },
            },
          },
        },
      },
      rows: matchups.map(m => ({
        label: matchupLabelWithWeek(m),
        value: matchupScoreText(m),
        hint: `Gap ${m.gap.toFixed(2)} • Favorite ${m.ratingFavorite} ${m.favoriteWon === null ? '' : m.favoriteWon ? '(held serve)' : '(upset)'}`,
      })),
    };

    return result;
  },
};
