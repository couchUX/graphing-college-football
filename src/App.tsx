import { lazy, Suspense } from 'react';
import './index.css';

// Each section is its own chunk: visiting /ratings no longer downloads the
// Games dashboard, the Discover detectors and the season-trends charts too.
const Dashboard = lazy(() => import('./components/Dashboard'));
const RatingsPage = lazy(() => import('./components/RatingsPage'));
const TeamTrendsPage = lazy(() => import('./components/TeamTrendsPage'));
const DiscoverPage = lazy(() => import('./components/DiscoverPage'));

const ROUTES = {
  '/games': Dashboard,
  '/ratings': RatingsPage,
  '/trends': TeamTrendsPage,
  '/discover': DiscoverPage,
} as const;

type RoutePath = keyof typeof ROUTES;

const isRoutePath = (path: string): path is RoutePath => path in ROUTES;

function App() {
  const path = window.location.pathname;

  // Root and unknown paths land on /games, preserving any query string so
  // shared links keep working.
  if (!isRoutePath(path)) {
    window.location.href = `/games${window.location.search}`;
    return null;
  }

  const Page = ROUTES[path];

  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <Page />
    </Suspense>
  );
}

export default App;
