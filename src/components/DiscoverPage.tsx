import React, { useCallback, useMemo, useState } from 'react';
import { Calendar, Layers } from 'lucide-react';
import { MetaTags } from './MetaTags';
import DiscoverCard from './DiscoverCard';
import AppShell from './AppShell';
import SubTabs, { SubTabItem } from './SubTabs';
import Toast from './Toast';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false,
  });

  const handleCopySuccess = useCallback((message: string) => {
    setToast({ message, type: 'success', isVisible: true });
  }, []);
  const handleCopyError = useCallback((message: string) => {
    setToast({ message, type: 'error', isVisible: true });
  }, []);
  const closeToast = useCallback(() => {
    setToast(t => ({ ...t, isVisible: false }));
  }, []);

  const yearOptions = useMemo(
    () => Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - i),
    []
  );

  const filters: DetectorFilters = useMemo(
    () => ({ year, conference }),
    [year, conference]
  );

  const SUB_TABS: SubTabItem<SubTab>[] = [
    { id: 'season-recap', label: 'Season recap' },
    { id: 'weekly', label: 'Weekly', disabled: true, note: 'Soon' },
    { id: 'multi-season', label: 'Multi-season', disabled: true, note: 'Soon' },
  ];

  return (
    <>
      <MetaTags
        title="Discover - Graphing College Football"
        description="Auto-surfaced college football insights — close games, upsets, efficiency leaders, and more."
        image="https://cfb-adv-metrics-dashboard.vercel.app/gcf_open-graph.jpg"
        url="https://cfb-adv-metrics-dashboard.vercel.app/discover"
      />
      <AppShell current="discover">
          <div>
            {/* Page intro */}
            <div className="mb-5">
              <h2 className="font-display text-[26px] font-extrabold tracking-tight text-ink">Discover</h2>
              <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-byline">
                Auto-surfaced storylines from the data. Tweak the filters to slice it your way; use the copy button on any card to grab embeddable chart HTML for an article.
              </p>
            </div>

            {/* Sub-nav */}
            <SubTabs items={SUB_TABS} value={tab} onChange={setTab} label="Discover views" className="mb-6" />

            {/* Filters */}
            {tab === 'season-recap' && (
              <div className="plate p-4 sm:p-5 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label htmlFor="discover-year" className="block text-sm font-medium text-neutral-700 mb-2">
                      Season
                    </label>
                    <select
                      id="discover-year"
                      value={year}
                      onChange={e => setYear(Number(e.target.value))}
                      className="select-field"
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
                      className="select-field"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {detectors.map(d => (
                  <DiscoverCard
                    key={d.id}
                    detector={d}
                    filters={filters}
                    onCopySuccess={handleCopySuccess}
                    onCopyError={handleCopyError}
                  />
                ))}
              </div>
            )}

            {tab !== 'season-recap' && (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-14 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-neutral-400">
                  {tab === 'weekly' ? <Calendar className="h-6 w-6" /> : <Layers className="h-6 w-6" />}
                </div>
                <p className="font-display text-lg font-bold text-ink">
                  {tab === 'weekly' ? 'Weekly view — coming soon' : 'Multi-season view — coming soon'}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-byline">
                  {tab === 'weekly'
                    ? 'Week-by-week storylines during the season — biggest upsets, hottest QBs, defensive surges.'
                    : 'Cross-season comparisons — year-over-year movers, multi-year leaders, and trend lines.'}
                </p>
              </div>
            )}

            <p className="mt-10 border-t border-hairline pt-5 text-xs text-byline">
              Data from{' '}
              <a href="https://collegefootballdata.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                CollegeFootballData.com
              </a>
              . SP+ created by Bill Connelly.
            </p>
          </div>

        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={closeToast}
        />
      </AppShell>
    </>
  );
};

export default DiscoverPage;
