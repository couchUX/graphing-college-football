import React from 'react';
import Dashboard from './components/Dashboard';
import RatingsPage from './components/RatingsPage';
import TeamTrendsPage from './components/TeamTrendsPage';
import DiscoverPage from './components/DiscoverPage';
import './index.css';

function App() {
  // Simple routing based on pathname
  const path = window.location.pathname;

  // Redirect root to /games, preserving query parameters
  if (path === '/') {
    const searchParams = window.location.search;
    // If there are query parameters, redirect to /games with them
    if (searchParams) {
      window.location.href = '/games' + searchParams;
    } else {
      window.location.href = '/games';
    }
    return null;
  }

  if (path === '/ratings') {
    return (
      <div className="min-h-screen bg-gray-50">
        <RatingsPage />
      </div>
    );
  }

  if (path === '/trends') {
    return (
      <div className="min-h-screen bg-gray-50">
        <TeamTrendsPage />
      </div>
    );
  }

  if (path === '/discover') {
    return (
      <div className="min-h-screen bg-gray-50">
        <DiscoverPage />
      </div>
    );
  }

  if (path === '/games') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Dashboard />
      </div>
    );
  }

  // 404 fallback - redirect to games
  window.location.href = '/games';
  return null;
}

export default App;