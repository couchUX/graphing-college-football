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
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      storage.setItem(cacheKey, JSON.stringify(entry));
    } catch {
      // Quota exceeded or serialization failure — ignore, just don't cache.
    }
  }

  return data;
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
