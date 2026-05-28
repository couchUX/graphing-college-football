import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { AlertCircle, TrendingUp } from 'lucide-react';
import type { Team } from '../services/api';
import { fetchSPRatingsHistory, type SPRating } from '../services/ratingsApi';
import { useTeams } from '../hooks/useTeams';
import { initializeChartDefaults } from '../utils/chartConfig';
import TeamPicker from './TeamPicker';

initializeChartDefaults();

const SERIES = [
  { key: 'overall', label: 'Overall', color: '#171717' },
  { key: 'offense', label: 'Offense', color: '#2563eb' },
  { key: 'defense', label: 'Defense', color: '#dc2626' },
  { key: 'specialTeams', label: 'Special teams', color: '#9333ea' },
] as const;

const ratingValue = (rating: SPRating, key: (typeof SERIES)[number]['key']): number | null => {
  switch (key) {
    case 'overall':
      return rating.rating ?? null;
    case 'offense':
      return rating.offense?.rating ?? null;
    case 'defense':
      return rating.defense?.rating ?? null;
    case 'specialTeams':
      return rating.specialTeams?.rating ?? null;
  }
};

const MultiYearSpTrends: React.FC = () => {
  const { teams, loading: loadingTeams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [ratings, setRatings] = useState<SPRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTeam) {
      setRatings([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchSPRatingsHistory(selectedTeam.school)
      .then((data) => {
        if (active) setRatings(data);
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setError('Failed to load SP+ history for this team.');
          setRatings([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTeam]);

  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: ratings.map((r) => String(r.year)),
      datasets: SERIES.map((series) => ({
        label: series.label,
        data: ratings.map((r) => ratingValue(r, series.key)),
        borderColor: series.color,
        backgroundColor: series.color,
        borderWidth: 2,
        spanGaps: true,
      })),
    }),
    [ratings],
  );

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'center' },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0]?.label} season`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: 'Season' } },
        y: { title: { display: true, text: 'SP+ rating (points)' } },
      },
    }),
    [],
  );

  const latest = ratings.length > 0 ? ratings[ratings.length - 1] : null;

  return (
    <div>
      <div className="pb-6 mb-6 border-b border-neutral-200 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:rounded-2xl sm:shadow sm:border sm:border-neutral-200 sm:pt-5 sm:px-6 sm:pb-6 sm:mb-8 sm:border-b-0">
        <div className="max-w-md">
          <TeamPicker
            label="Team"
            value={selectedTeam}
            onChange={setSelectedTeam}
            teams={teams}
            loading={loadingTeams}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-6 mb-8">
          <p className="text-neutral-700 font-medium">Loading SP+ history...</p>
        </div>
      )}

      {!loading && !error && selectedTeam && ratings.length > 0 && (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">
              {selectedTeam.school} - SP+ rating history
            </h2>
            <p className="text-neutral-600">
              {ratings[0].year}–{ratings[ratings.length - 1].year}
              {latest && typeof latest.ranking === 'number'
                ? ` • Most recent: ${latest.rating?.toFixed(1)} (No. ${latest.ranking})`
                : ''}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm pt-5 px-4 pb-4 sm:px-6 sm:pb-6 mb-4">
            <div className="h-[420px]">
              <Line data={chartData} options={options} />
            </div>
          </div>

          <p className="text-sm text-neutral-500">
            Higher is better for Overall and Offense. For Defense, lower ratings indicate fewer
            adjusted points allowed (a stronger defense). Source: collegefootballdata.com SP+.
          </p>
        </>
      )}

      {!loading && !error && !selectedTeam && (
        <div className="text-center py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-16">
            <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Select a team to see its multi-year SP+ trend
            </h3>
            <p className="text-neutral-600 max-w-md mx-auto">
              Track how a program's Overall, Offense, Defense, and Special Teams SP+ ratings have
              changed across seasons.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && selectedTeam && ratings.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-sm">
            No SP+ history found for {selectedTeam.school}.
          </p>
        </div>
      )}
    </div>
  );
};

export default MultiYearSpTrends;
