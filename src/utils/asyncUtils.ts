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

// Pull an HTTP status code off a thrown error. Callers throw
// `Error("HTTP error! status: NNN")`, so fall back to parsing the message when
// no numeric `status` property is present.
const httpStatusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null) {
    const maybeStatus = (error as { status?: unknown }).status;
    if (typeof maybeStatus === 'number') return maybeStatus;
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      const match = message.match(/status:\s*(\d{3})/i);
      if (match) return Number(match[1]);
    }
  }
  return undefined;
};

// Retry transient failures only: network/unknown errors (no HTTP status) plus
// 408 (timeout), 429 (rate limit), and 5xx. Non-retriable 4xx (400/401/404…)
// fail fast instead of burning backoff on an error that won't resolve itself.
const isRetriableError = (error: unknown): boolean => {
  const status = httpStatusOf(error);
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
};

// Retry an async operation a few times with backoff + jitter. Useful for
// transient API failures (429/5xx) when fetching many resources. Pass a custom
// `shouldRetry` predicate to override which errors are considered retriable.
export const withRetry = async <T>(
  fn: () => Promise<T>,
  attempts = 2,
  baseDelayMs = 700,
  shouldRetry: (error: unknown) => boolean = isRetriableError,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) break;
      const delay = baseDelayMs * (attempt + 1) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};
