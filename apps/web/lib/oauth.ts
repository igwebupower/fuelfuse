// OAuth2 service for Fuel Finder API
import { kv } from '@vercel/kv';

interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

const FUEL_FINDER_TOKEN_URL = process.env.FUEL_FINDER_API_URL 
  ? `${process.env.FUEL_FINDER_API_URL}/oauth/token`
  : 'https://api.fuelprices.gov.uk/oauth/token';

const FUEL_FINDER_CLIENT_ID = process.env.FUEL_FINDER_CLIENT_ID;
const FUEL_FINDER_CLIENT_SECRET = process.env.FUEL_FINDER_CLIENT_SECRET;
const TOKEN_CACHE_KEY = 'fuel_finder_oauth_token';

// Refresh token 5 minutes (300000ms) before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (429 or 5xx)
 */
function isRetryableError(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Request a new OAuth2 token from Fuel Finder API using client credentials flow
 * Implements exponential backoff retry for 429 and 5xx errors
 */
async function requestNewToken(): Promise<CachedToken> {
  if (!FUEL_FINDER_CLIENT_ID || !FUEL_FINDER_CLIENT_SECRET) {
    throw new Error('Fuel Finder API credentials not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: FUEL_FINDER_CLIENT_ID,
    client_secret: FUEL_FINDER_CLIENT_SECRET,
    scope: 'fuelfinder.read',
  });

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(FUEL_FINDER_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if error is retryable
        if (isRetryableError(response.status) && attempt < maxRetries) {
          // Calculate exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `OAuth token request failed with ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delayMs);
          continue;
        }
        
        throw new Error(
          `OAuth token request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const tokenData: OAuth2Token = await response.json();

      // Calculate expiry time with buffer
      const expiresAt = Date.now() + (tokenData.expires_in * 1000) - REFRESH_BUFFER_MS;

      return {
        accessToken: tokenData.access_token,
        expiresAt,
      };
    } catch (error) {
      lastError = error as Error;
      
      // If it's a network error and we have retries left, retry with backoff
      if (attempt < maxRetries && !(error instanceof Error && error.message.includes('OAuth token request failed'))) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `OAuth token request error: ${error}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(delayMs);
        continue;
      }
      
      throw error;
    }
  }

  throw lastError || new Error('OAuth token request failed after retries');
}

/**
 * Get cached token from Vercel KV
 */
async function getCachedToken(): Promise<CachedToken | null> {
  try {
    const cached = await kv.get<CachedToken>(TOKEN_CACHE_KEY);
    return cached;
  } catch (error) {
    console.error('Error retrieving cached token:', error);
    return null;
  }
}

/**
 * Cache token in Vercel KV
 */
async function cacheToken(token: CachedToken): Promise<void> {
  try {
    // Calculate TTL in seconds for KV
    const ttlSeconds = Math.floor((token.expiresAt - Date.now()) / 1000);
    
    if (ttlSeconds > 0) {
      await kv.set(TOKEN_CACHE_KEY, token, { ex: ttlSeconds });
    }
  } catch (error) {
    console.error('Error caching token:', error);
    // Don't throw - caching failure shouldn't break the flow
  }
}

/**
 * Check if cached token is still valid (not expired)
 */
function isTokenValid(token: CachedToken): boolean {
  return Date.now() < token.expiresAt;
}

/**
 * Get a valid OAuth2 access token for Fuel Finder API
 * Returns cached token if valid, otherwise requests and caches a new one
 */
export async function getOAuthToken(): Promise<string> {
  // Try to get cached token
  const cached = await getCachedToken();
  
  if (cached && isTokenValid(cached)) {
    return cached.accessToken;
  }

  // Request new token
  const newToken = await requestNewToken();
  
  // Cache the new token
  await cacheToken(newToken);
  
  return newToken.accessToken;
}

/**
 * Clear cached OAuth token (useful for testing or manual refresh)
 */
export async function clearOAuthTokenCache(): Promise<void> {
  try {
    await kv.del(TOKEN_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing token cache:', error);
  }
}
