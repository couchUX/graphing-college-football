// API requests are proxied through /api/cfbd so the CFBD API key stays
// server-side and never ships in the client bundle. The proxy attaches the
// Authorization header: in production via api/cfbd/[...path].js, and in local
// dev via the Vite dev-server proxy in vite.config.ts.
export const API_BASE_URL = '/api/cfbd';

// Shared headers for all API requests. Auth is added by the proxy, not here.
export const getApiHeaders = () => ({
  Accept: 'application/json',
});
