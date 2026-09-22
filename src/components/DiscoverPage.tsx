import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Layers } from 'lucide-react';
import { MetaTags } from './MetaTags';
import DiscoverCard from './DiscoverCard';
import AppShell from './AppShell';
import SubTabs, { SubTabItem } from './SubTabs';
import { detectors } from '../detectors/registry';
import type { DetectorFilters } from '../detectors/types';
import { useToast } from '../hooks/useToast';
import { CURRENT_SEASON, RATINGS_YEARS } from '../constants/seasons';
import { SITE_URL } from '../constants/site';
import { readParams, writeParams } from '../utils/urlState';

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
  'Pac-12',
];

// The filters open on whatever the link says, so a Discover URL someone
// shares in October still lands on that season and conference. A year only
// counts if it's one we actually offer; anything else falls back to the
// season underway.
const readYearParam = (): number => {
  const fromUrl = Number(readParams().get('year'));
  return RATINGS_YEARS.includes(fromUrl) ? fromUrl : CURRENT_SEASON;
};

const readConferenceParam = (): string => {
  const fromUrl = readParams().get('conference');
  if (!fromUrl) return 'all';
  return CONFERENCES.find(c => c.toLowerCase() === fromUrl.toLowerCase()) ?? 'all';
};

const DiscoverPage: React.FC = () => {
  const [tab, setTab] = useState<SubTab>('season-recap');
  const [year, setYear] = useState<number>(readYearParam);
  const [conference, setConference] = useState<string>(readConferenceParam);
  const { showToast } = useToast();

  // Mirror the filters back into the address bar (replaceState, so this never
  // stacks up history entries). The year is written even at its default: a link
  // shared this season should still open on this season next August, rather
  // than rolling forward with the site. 'All conferences' is the default and
  // stays out of the URL to keep shared links short.
  useEffect(() => {
    writeParams({
      year: String(year),
      conference: conference === 'all' ? null : conference,
    });
  }, [year, conference]);

  const handleCopySuccess = useCallback((message: string) => showToast(message), [showToast]);
  const handleCopyError = useCallback((message: string) => showToast(message), [showToast]);

  const yearOptions = RATINGS_YEARS;

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
        image={`${SITE_URL}/gcf_open-graph.jpg`}
        url={`${SITE_URL}/discover`}
      />
      <AppShell current="discover">
          <div>
            {/* Page intro */}
            <div className="mb-5">
              <h2 className="headline text-[28px] text-ink">Discover</h2>
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
                <p className="headline text-[20px] font-bold text-ink">
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

      </AppShell>
    </>
  );
};

export default DiscoverPage;
