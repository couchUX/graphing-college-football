// Serverless proxy for the CollegeFootballData API.
// Keeps CFB_API_KEY server-side so it never ships in the client bundle.
// The browser calls /api/cfbd/<cfbd-path>?<query> and this function forwards
// the request to CFBD with the Authorization header attached.
const CFBD_BASE = 'https://api.collegefootballdata.com';
const PREFIX = '/api/cfbd/';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

// Per-instance cache: survives warm invocations, resets on cold start. Combined
// with the Cache-Control header below (Vercel edge caching), this cuts billable
// CFBD calls for repeated requests.
const cache = new Map();

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CFB_API_KEY;
  if (!apiKey) {
    console.error('Missing CFB_API_KEY environment variable');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const prefixIndex = req.url.indexOf(PREFIX);
  if (prefixIndex === -1) {
    return res.status(400).json({ error: 'Invalid proxy path' });
  }

  // Everything after /api/cfbd/ — path segments plus query string. The CFBD host
  // is fixed, so a malicious suffix can only ever resolve to a path under CFBD.
  const upstreamSuffix = req.url.slice(prefixIndex + PREFIX.length);
  const upstreamUrl = `${CFBD_BASE}/${upstreamSuffix}`;

  const now = Date.now();
  const cached = cache.get(upstreamSuffix);
  if (cached && now - cached.time < CACHE_TTL_MS) {
    res.setHeader('X-Proxy-Cache', 'HIT');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(cached.body);
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: 'application/json',
      },
    });

    const text = await upstream.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON upstream response (e.g. an error page) — pass through verbatim.
      res.setHeader('X-Proxy-Cache', 'MISS');
      return res.status(upstream.status).send(text);
    }

    if (upstream.ok) {
      cache.set(upstreamSuffix, { time: now, body });
      if (cache.size > CACHE_MAX_ENTRIES) {
        cache.delete(cache.keys().next().value);
      }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    }

    res.setHeader('X-Proxy-Cache', 'MISS');
    return res.status(upstream.status).json(body);
  } catch (error) {
    console.error('CFBD proxy error:', error);
    return res.status(502).json({ error: 'Failed to reach data provider' });
  }
};
