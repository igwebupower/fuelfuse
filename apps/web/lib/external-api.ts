// External API utilities with timeout and retry logic
// Requirements: 8.7
import { ExternalServiceError } from './errors';
import { logger } from './logger';

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  service?: string;
}

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Fetch with timeout and retry logic
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    service = 'External API',
  } = options;

  const log = logger.child({ service, operation: 'fetch' });

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      log.debug(`Fetching ${url} (attempt ${attempt + 1}/${retries})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for rate limiting or server errors that should trigger retry
      if (response.status === 429 || response.status >= 500) {
        const errorMessage = `${service} returned ${response.status}`;
        log.warn(errorMessage, { attempt: attempt + 1, status: response.status });

        if (attempt < retries - 1) {
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          log.debug(`Retrying after ${delay}ms`);
          await sleep(delay);
          continue;
        }

        throw new ExternalServiceError(service, errorMessage, response.status);
      }

      log.debug(`Successfully fetched ${url}`, { status: response.status });
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        log.warn(`Request timeout for ${url}`, { attempt: attempt + 1, timeout });
        
        if (attempt < retries - 1) {
          const delay = retryDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        throw new ExternalServiceError(service, 'Request timeout', 408);
      }

      // For other errors, don't retry
      log.error(`Fetch error for ${url}`, error);
      throw new ExternalServiceError(
        service,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // If we exhausted all retries
  throw new ExternalServiceError(
    service,
    lastError?.message || 'Request failed after retries'
  );
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with timeout and retry
 */
export async function fetchJSON<T = any>(
  url: string,
  init?: RequestInit,
  options?: FetchOptions
): Promise<T> {
  const response = await fetchWithTimeout(url, init, options);

  if (!response.ok) {
    throw new ExternalServiceError(
      options?.service || 'External API',
      `HTTP ${response.status}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Timeout configurations for different services
 */
export const TIMEOUTS = {
  FUEL_FINDER_API: 15000, // 15 seconds
  POSTCODES_IO: 10000, // 10 seconds
  EXPO_PUSH: 10000, // 10 seconds
  STRIPE: 15000, // 15 seconds
  DATABASE: 5000, // 5 seconds
};
