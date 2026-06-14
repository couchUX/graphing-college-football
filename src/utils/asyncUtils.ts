// Run an async mapper over items with a bounded number of concurrent workers.
// Results preserve input order.
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  };

  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, run));
  return results;
};

// Only transient failures are worth retrying: rate limiting (429) and server
// errors (5xx), plus network/timeout errors that carry no HTTP status. A
// definitive 4xx (e.g. 401 bad key, 404 not found) will never succeed on retry,
// so re-throw it immediately. Errors are thrown as `HTTP error! status: NNN`.
const isRetriable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const match = error.message.match(/status:\s*(\d+)/);
    if (match) {
      const status = Number(match[1]);
      return status === 429 || status >= 500;
    }
  }
  return true; // network errors, timeouts, etc.
};

// Retry an async operation a few times with backoff + jitter. Useful for
// transient API failures (429/5xx) when fetching many resources.
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 700,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRetriable(error)) {
        const delay = baseDelayMs * (attempt + 1) + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
};
