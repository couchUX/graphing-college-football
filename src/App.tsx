import React from 'react';
import Dashboard from './components/Dashboard';
import RatingsPage from './components/RatingsPage';
import './index.css';

function App() {
  // Simple routing based on pathname
  const path = window.location.pathname;

  if (path === '/ratings') {
    return <RatingsPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard />
    </div>
  );
}

export default App;