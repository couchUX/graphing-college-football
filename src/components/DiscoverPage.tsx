import React, { useMemo, useState } from 'react';
import { BarChart3, Award, TrendingUp, Sparkles, Calendar, Layers } from 'lucide-react';
import { MetaTags } from './MetaTags';
import DiscoverCard from './DiscoverCard';
import { detectors } from '../detectors/registry';
import type { DetectorFilters } from '../detectors/types';

type SubTab = 'season-recap' | 'weekly' | 'multi-season';

const CONFERENCES = [
  'all',
  'power4',
  'ACC',
  'SEC',
  'Big 12',
  'Big Ten',
  'American Athletic',
  'Mountain West',
  'Mid-American',
  'Conference USA',
  'Sun Belt',
];

// Default to the most recent fully completed season (one year prior to now).
const defaultRecapYear = (): number => {
  const now = new Date();
  // CFB seasons end in early January. If we're before August, the previous calendar year's season is "last complete season".
  return now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear() - 1;
};

const DiscoverPage: React.FC = () => {
  const [tab, setTab] = useState<SubTab>('season-recap');
  const [year, setYear] = useState<number>(defaultRecapYear());
  const [conference, setConference] = useState<string>('all');

  const yearOptions = useMemo(
    () => Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - i),
    []
  );

  const filters: DetectorFilters = useMemo(
    () => ({ year, conference }),
    [year, conference]
  );

  const subNavItem = (
    id: SubTab,
    label: string,
    icon: React.ReactNode,
    disabled = false
  ) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => !disabled && setTab(id)}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          active
            ? 'bg-neutral-900 text-white'
            : disabled
              ? 'bg-neutral-50 text-neutral-400 cursor-not-allowed'
              : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
        }`}
      >
        {icon}
        <span>{label}</span>
        {disabled && (
          <span className="ml-1 text-[10px] uppercase tracking-wide bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded">
            Soon
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <MetaTags
        title="Discover - Graphing College Football"
        description="Auto-surfaced college football insights — close games, upsets, efficiency leaders, and more."
        image="https://cfb-adv-metrics-dashboard.vercel.app/gcf_open-graph.jpg"
        url="https://cfb-adv-metrics-dashboard.vercel.app/discover"
      />
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
        {/* Header — matches other pages */}
        <header className="bg-white shadow-sm border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
                  Graphing College Football
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 mt-0">
                  Advanced play-by-play metrics<span className="hidden sm:inline"> and visualizations</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex w-full sm:w-auto border border-neutral-300 rounded-lg overflow-hidden h-10">
                  <a
                    href="/games"
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors bg-white text-neutral-700 hover:bg-neutral-50"
                  >
                    <BarChart3 className="h-5 w-5" />
                    <span>Games</span>
                  </a>
                  <a
                    href="/ratings"
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors border-l border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  >
                    <Award className="h-5 w-5" />
                    <span>Ratings</span>
                  </a>
                  <a
                    href="/trends"
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors border-l border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  >
                    <TrendingUp className="h-5 w-5" />
                    <span>Trends</span>
                  </a>
                  <a
                    href="/discover"
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 text-sm font-medium transition-colors border-l border-neutral-300 bg-neutral-200 text-neutral-600 cursor-default"
                  >
                    <Sparkles className="h-5 w-5" />
                    <span>Discover</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Page intro */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">Discover</h2>
              <p className="text-neutral-600 mt-1">
                Auto-surfaced storylines from the data. Tweak the filters to slice it your way; click <em>Open standalone</em> on any card to grab a clean chart for an article.
              </p>
            </div>

            {/* Sub-nav */}
            <div className="flex flex-wrap gap-2 mb-6">
              {subNavItem('season-recap', 'Season Recap', <Sparkles className="h-4 w-4" />)}
              {subNavItem('weekly', 'Weekly', <Calendar className="h-4 w-4" />, true)}
              {subNavItem('multi-season', 'Multi-Season', <Layers className="h-4 w-4" />, true)}
            </div>

            {/* Filters */}
            {tab === 'season-recap' && (
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-5 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label htmlFor="discover-year" className="block text-sm font-medium text-neutral-700 mb-2">
                      Season
                    </label>
                    <select
                      id="discover-year"
                      value={year}
                      onChange={e => setYear(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg shadow-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 appearance-none bg-[length:1.5em_1.5em] bg-[position:calc(100%-0.75rem)_center] bg-no-repeat pr-10"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")` }}
                    >
                      {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="discover-conference" className="block text-sm font-medium text-neutral-700 mb-2">
                      Conference
                    </label>
                    <select
                      id="discover-conference"
                      value={conference}
                      onChange={e => setConference(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg shadow-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 appearance-none bg-[length:1.5em_1.5em] bg-[position:calc(100%-0.75rem)_center] bg-no-repeat pr-10"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")` }}
                    >
                      {CONFERENCES.map(c => (
                        <option key={c} value={c}>
                          {c === 'all' ? 'All conferences' : c === 'power4' ? 'Power 4 only' : c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Content per tab */}
            {tab === 'season-recap' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {detectors.map(d => (
                  <DiscoverCard key={d.id} detector={d} filters={filters} />
                ))}
              </div>
            )}

            {tab !== 'season-recap' && (
              <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500">
                <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                  {tab === 'weekly' ? <Calendar className="h-6 w-6" /> : <Layers className="h-6 w-6" />}
                </div>
                <div className="text-base font-semibold text-neutral-700">
                  {tab === 'weekly' ? 'Weekly view — coming soon' : 'Multi-season view — coming soon'}
                </div>
                <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
                  {tab === 'weekly'
                    ? 'Week-by-week storylines during the season — biggest upsets, hottest QBs, defensive surges.'
                    : 'Cross-season comparisons — year-over-year movers, multi-year leaders, and trend lines.'}
                </p>
              </div>
            )}
          </div>
        </main>

        <footer className="border-t border-neutral-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <p className="text-xs text-neutral-500">
              Data from <a href="https://collegefootballdata.com" target="_blank" rel="noopener noreferrer" className="underline">CollegeFootballData.com</a>. SP+ created by Bill Connelly.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default DiscoverPage;
