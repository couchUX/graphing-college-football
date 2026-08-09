const CACHE_PREFIX = 'cfb-cache:';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const safeStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const cachedFetch = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> => {
  const storage = safeStorage();
  const cacheKey = `${CACHE_PREFIX}${key}`;

  if (storage) {
    try {
      const raw = storage.getItem(cacheKey);
      if (raw) {
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - entry.timestamp < ttlMs) {
          return entry.data;
        }
      }
    } catch {
      // Corrupt cache entry — fall through and re-fetch.
    }
  }

  const data = await fetcher();

  if (storage) {
    const write = () => storage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    try {
      write();
    } catch {
      // Most likely the quota. Per-team schedule keys accumulate one entry per
      // (team, season) browsed, so without this a heavy session fills the quota
      // and every later write fails silently — including the detectors' large
      // season payloads. Drop the expired entries and try once more.
      pruneExpired(storage, ttlMs);
      try {
        write();
      } catch {
        // Still no room; serving uncached is fine, so give up quietly.
      }
    }
  }

  return data;
};

/** Remove cache entries past their TTL (and any that no longer parse). */
const pruneExpired = (storage: Storage, ttlMs: number): void => {
  const stale: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(CACHE_PREFIX)) continue;
    try {
      const raw = storage.getItem(key);
      const entry = raw ? (JSON.parse(raw) as CacheEntry<unknown>) : null;
      if (!entry || Date.now() - entry.timestamp >= ttlMs) stale.push(key);
    } catch {
      stale.push(key);
    }
  }
  stale.forEach(key => storage.removeItem(key));
};

export const clearCache = (prefix?: string): void => {
  const storage = safeStorage();
  if (!storage) return;
  const fullPrefix = prefix ? `${CACHE_PREFIX}${prefix}` : CACHE_PREFIX;
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(fullPrefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => storage.removeItem(k));
};
