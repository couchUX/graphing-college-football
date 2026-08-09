import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { AlertCircle, Check, Copy, TrendingUp } from 'lucide-react';
import type { Team } from '../services/api';
import { fetchSPRatingsHistory, type SPRating } from '../services/ratingsApi';
import { useTeams } from '../hooks/useTeams';
import { initializeChartDefaults } from '../utils/chartConfig';
import TeamPicker from './TeamPicker';
import { readParams, writeParams } from '../utils/trendsUrl';
import { seriesColorsFor, teamLineColor } from '../utils/teamColorUtils';
import { generateChartEmbed } from '../utils/chartEmbedGenerator';

initializeChartDefaults();

const SERIES = [
  { key: 'overall', label: 'Overall', color: '#171717' },
  { key: 'offense', label: 'Offense', color: '#2563eb' },
  { key: 'defense', label: 'Defense', color: '#dc2626' },
  { key: 'specialTeams', label: 'Special teams', color: '#9333ea' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

const ratingValue = (rating: SPRating, key: SeriesKey): number | null => {
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
  const { teams, loading: loadingTeams, error: teamsError } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [colorId, setColorId] = useState<string>('default');
  // Optional second team — when set, the view switches to comparison mode.
  const [selectedTeamB, setSelectedTeamB] = useState<Team | null>(null);
  const [colorB, setColorB] = useState<string>('default');
  // In comparison mode we show a single aspect for both teams (rather than all
  // four per team, which would crowd the legend).
  const [aspect, setAspect] = useState<SeriesKey>('overall');
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    overall: true,
    offense: true,
    defense: true,
    specialTeams: true,
  });
  const [ratings, setRatings] = useState<SPRating[]>([]);
  const [ratingsB, setRatingsB] = useState<SPRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const restoredRef = useRef(false);

  const compareMode = !!selectedTeamB;

  // Restore selections from the URL once teams are available.
  useEffect(() => {
    if (restoredRef.current || teams.length === 0) return;
    restoredRef.current = true;
    const p = readParams();
    const school = p.get('spTeam');
    if (school) {
      const match = teams.find((t) => t.school.toLowerCase() === school.toLowerCase());
      if (match) setSelectedTeam(match);
    }
    const c = p.get('spColor');
    if (c) setColorId(c);
    const schoolB = p.get('spTeamB');
    if (schoolB) {
      const matchB = teams.find((t) => t.school.toLowerCase() === schoolB.toLowerCase());
      if (matchB) setSelectedTeamB(matchB);
    }
    const cB = p.get('spColorB');
    if (cB) setColorB(cB);
    const a = p.get('spAspect');
    if (a && SERIES.some((s) => s.key === a)) setAspect(a as SeriesKey);
  }, [teams]);

  // Persist selections to the URL.
  const handleTeamChange = (team: Team | null) => {
    setSelectedTeam(team);
    writeParams({ spTeam: team?.school ?? null });
  };
  const handleColorChange = (id: string) => {
    setColorId(id);
    writeParams({ spColor: id === 'default' ? null : id });
  };
  const handleTeamBChange = (team: Team | null) => {
    // Avoid comparing a team against itself (two identical lines).
    if (team && selectedTeam && team.school === selectedTeam.school) return;
    setSelectedTeamB(team);
    writeParams({ spTeamB: team?.school ?? null });
  };
  const handleColorBChange = (id: string) => {
    setColorB(id);
    writeParams({ spColorB: id === 'default' ? null : id });
  };
  const handleAspectChange = (key: SeriesKey) => {
    setAspect(key);
    writeParams({ spAspect: key === 'overall' ? null : key });
  };

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

  useEffect(() => {
    if (!selectedTeamB) {
      setRatingsB([]);
      setErrorB(null);
      return;
    }
    let active = true;
    setLoadingB(true);
    setErrorB(null);
    fetchSPRatingsHistory(selectedTeamB.school)
      .then((data) => {
        if (active) setRatingsB(data);
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setErrorB('Failed to load SP+ history for the second team.');
          setRatingsB([]);
        }
      })
      .finally(() => {
        if (active) setLoadingB(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTeamB]);

  const seriesColors = useMemo(
    () => (selectedTeam ? seriesColorsFor(selectedTeam.school, colorId) : SERIES.map((s) => s.color)),
    [selectedTeam, colorId],
  );
  const teamAColor = useMemo(
    () => (selectedTeam ? teamLineColor(selectedTeam.school, colorId) : '#171717'),
    [selectedTeam, colorId],
  );
  const teamBColor = useMemo(
    () => (selectedTeamB ? teamLineColor(selectedTeamB.school, colorB) : '#9CA3AF'),
    [selectedTeamB, colorB],
  );

  const aspectLabel = SERIES.find((s) => s.key === aspect)?.label ?? 'Overall';

  const chartData = useMemo<ChartData<'line'>>(() => {
    if (compareMode && selectedTeam && selectedTeamB) {
      // One aspect, one line per team. Align both teams on a shared year axis so
      // mismatched ranges still line up by season (gaps are spanned).
      const allYears = Array.from(
        new Set([...ratings, ...ratingsB].map((r) => r.year)),
      ).sort((a, b) => a - b);
      const byA = new Map(ratings.map((r) => [r.year, r]));
      const byB = new Map(ratingsB.map((r) => [r.year, r]));
      return {
        labels: allYears.map(String),
        datasets: [
          {
            label: selectedTeam.school,
            data: allYears.map((y) => {
              const r = byA.get(y);
              return r ? ratingValue(r, aspect) : null;
            }),
            borderColor: teamAColor,
            backgroundColor: teamAColor,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            spanGaps: true,
          },
          {
            label: selectedTeamB.school,
            data: allYears.map((y) => {
              const r = byB.get(y);
              return r ? ratingValue(r, aspect) : null;
            }),
            borderColor: teamBColor,
            backgroundColor: teamBColor,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            spanGaps: true,
          },
        ],
      };
    }
    // Single-team mode: all four series with per-series toggles.
    return {
      labels: ratings.map((r) => String(r.year)),
      datasets: SERIES.map((series, i) => ({ series, color: seriesColors[i] }))
        .filter(({ series }) => visibleSeries[series.key])
        .map(({ series, color }) => ({
          label: series.label,
          data: ratings.map((r) => ratingValue(r, series.key)),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          spanGaps: true,
        })),
    };
  }, [compareMode, selectedTeam, selectedTeamB, ratings, ratingsB, aspect, teamAColor, teamBColor, seriesColors, visibleSeries]);

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      // Slightly smaller point markers than the global default — the dots were
      // looking exaggerated on these multi-year lines.
      elements: { point: { radius: 3, hoverRadius: 5 } },
      plugins: {
        legend: {
          position: 'top',
          align: 'center',
          // The global default renders oversized point-style markers (~6px
          // radius). Shrink them to roughly match the 3px dots on the lines.
          labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 6, padding: 16 },
        },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0]?.label} season`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: 'Season' } },
        y: {
          title: {
            display: true,
            text: compareMode ? `SP+ ${aspectLabel} (points)` : 'SP+ rating (points)',
          },
        },
      },
    }),
    [compareMode, aspectLabel],
  );

  const chartTitle =
    compareMode && selectedTeam && selectedTeamB
      ? `${selectedTeam.school} vs. ${selectedTeamB.school} — SP+ ${aspectLabel}`
      : selectedTeam
        ? `${selectedTeam.school} - SP+ rating history`
        : '';
  // In compare mode the chart's x-axis spans the union of both teams' years.
  const subtitleYears = (compareMode ? [...ratings, ...ratingsB] : ratings).map((r) => r.year);
  const chartSubtitle =
    subtitleYears.length > 0
      ? `${Math.min(...subtitleYears)}–${Math.max(...subtitleYears)} seasons`
      : '';

  const handleCopyEmbed = async () => {
    if (!selectedTeam || ratings.length === 0) return;
    // In compare mode, don't copy while team B's history is still loading —
    // the chart (and thus the embed) would be missing its second line.
    if (loading || (compareMode && loadingB)) return;
    if (!navigator.clipboard?.writeText) {
      console.error('Clipboard not available in this browser');
      return;
    }
    try {
      // Link back to this exact view (same params the page persists to its URL).
      const params = new URLSearchParams();
      params.set('view', 'spTrends');
      params.set('spTeam', selectedTeam.school);
      if (colorId !== 'default') params.set('spColor', colorId);
      if (selectedTeamB) {
        params.set('spTeamB', selectedTeamB.school);
        if (colorB !== 'default') params.set('spColorB', colorB);
        if (aspect !== 'overall') params.set('spAspect', aspect);
      }

      const embedCode = generateChartEmbed({
        chartType: 'line',
        data: chartData,
        options,
        title: chartTitle,
        subtitle: chartSubtitle,
        sourceUrl: `https://graphingcollegefootball.com/trends?${params.toString()}`,
        height: 420,
        definitions: [
          '<strong>SP+:</strong> Bill Connelly\'s tempo- and opponent-adjusted measure of college football efficiency',
          '<strong>Overall / Offense:</strong> Higher ratings are better',
          '<strong>Defense:</strong> Lower ratings indicate fewer adjusted points allowed (a stronger defense)',
          'Source: <a href="https://collegefootballdata.com" target="_blank" style="color: #525252; text-decoration: underline;">collegefootballdata.com</a> SP+',
        ],
      });

      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      window.setTimeout(() => setCopiedEmbed(false), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
      setCopiedEmbed(false);
    }
  };

  const latest = ratings.length > 0 ? ratings[ratings.length - 1] : null;
  const combinedLoading = loading || (compareMode && loadingB);
  const combinedError = error || (compareMode ? errorB : null);
  // Team A's history is enough to render; if a second team is added but has no
  // SP+ data we still show Team A and surface an inline notice for Team B.
  const hasData = ratings.length > 0;
  const teamBMissing = compareMode && !!selectedTeamB && ratingsB.length === 0;

  return (
    <div>
      <div className="config-panel mb-7 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 min-w-0">
            <TeamPicker
              label="Team"
              value={selectedTeam}
              onChange={handleTeamChange}
              teams={teams}
              loading={loadingTeams}
              colorId={colorId}
              onColorChange={handleColorChange}
            />
          </div>
          <div className="flex-1 min-w-0">
            <TeamPicker
              label="Compare to (optional)"
              value={selectedTeamB}
              onChange={handleTeamBChange}
              teams={teams}
              loading={loadingTeams}
              placeholder="e.g., Georgia"
              colorId={colorB}
              onColorChange={handleColorBChange}
              onClear={() => handleTeamBChange(null)}
            />
          </div>
        </div>
        {teamsError && (
          <p className="text-sm text-red-700 mt-3">
            Couldn't load the team list. Check your connection and refresh to try again.
          </p>
        )}
        {selectedTeam && selectedTeamB && selectedTeam.school === selectedTeamB.school && (
          <p className="text-sm text-amber-700 mt-3">Pick two different teams to compare.</p>
        )}
      </div>

      {combinedError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{combinedError}</p>
        </div>
      )}

      {combinedLoading && (
        <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-6 mb-8">
          <p className="text-neutral-700 font-medium">Loading SP+ history...</p>
        </div>
      )}

      {!combinedLoading && !combinedError && selectedTeam && hasData && (
        <>
          <div className="mb-6">
            <h2 className="headline text-[26px] text-ink">
              {compareMode && selectedTeamB
                ? `${selectedTeam.school} vs. ${selectedTeamB.school} — SP+ ${aspectLabel}`
                : `${selectedTeam.school} - SP+ rating history`}
            </h2>
            <p className="text-neutral-600">
              {ratings[0].year}–{ratings[ratings.length - 1].year}
              {!compareMode && latest && typeof latest.ranking === 'number'
                ? ` • Most recent: ${latest.rating?.toFixed(1)} (No. ${latest.ranking})`
                : ''}
            </p>
          </div>

          {teamBMissing && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                No SP+ history found for {selectedTeamB?.school} — showing {selectedTeam.school} only.
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm pt-5 px-4 pb-4 sm:px-6 sm:pb-6 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              {compareMode ? (
                /* Comparison mode: a single aspect dropdown keeps the legend to the
                   two team names rather than eight series. */
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="sp-aspect" className="text-sm font-medium text-neutral-700">
                    Aspect
                  </label>
                  <select
                    id="sp-aspect"
                    value={aspect}
                    onChange={(e) => handleAspectChange(e.target.value as SeriesKey)}
                    className="select-field w-auto py-2 pl-3 pr-9 text-sm"
                  >
                    {SERIES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Single-team mode: per-series toggle checklist. */
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {SERIES.map((series, i) => (
                    <label
                      key={series.key}
                      className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={visibleSeries[series.key]}
                        onChange={(e) =>
                          setVisibleSeries((v) => ({ ...v, [series.key]: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-neutral-300 focus:ring-accent"
                        style={{ accentColor: seriesColors[i] }}
                      />
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: seriesColors[i] }}
                      />
                      {series.label}
                    </label>
                  ))}
                </div>
              )}
              <button
                onClick={handleCopyEmbed}
                className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                  copiedEmbed
                    ? 'border-green-300 bg-green-50'
                    : 'border-neutral-300 hover:bg-neutral-50'
                }`}
                title={copiedEmbed ? 'Copied!' : 'Copy embed code'}
              >
                {copiedEmbed ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-neutral-600" />
                )}
              </button>
            </div>
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

      {!combinedLoading && !combinedError && !selectedTeam && (
        <div className="text-center py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-16">
            <TrendingUp className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="headline text-[22px] font-bold text-ink mb-2">
              Select a team to see its multi-year SP+ trend
            </h3>
            <p className="text-neutral-600 max-w-md mx-auto">
              Track how a program's Overall, Offense, Defense, and Special Teams SP+ ratings have
              changed across seasons — or add a second team to compare a single aspect head-to-head.
            </p>
          </div>
        </div>
      )}

      {!combinedLoading && !combinedError && selectedTeam && ratings.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-sm">No SP+ history found for {selectedTeam.school}.</p>
        </div>
      )}
    </div>
  );
};

export default MultiYearSpTrends;
