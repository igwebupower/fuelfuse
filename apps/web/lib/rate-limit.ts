// Rate limiting utility using Vercel KV
import { kv } from '@vercel/kv';

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  limit: number;
  /**
   * Time window in seconds
   */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Rate limits requests using Vercel KV
 * Uses a sliding window counter approach
 * 
 * @param identifier - Unique identifier for the rate limit (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status, remaining requests, and reset time
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rate-limit:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  try {
    // Get current count and timestamp
    const data = await kv.get<{ count: number; resetAt: number }>(key);
    
    if (!data) {
      // First request in window
      const resetAt = now + windowMs;
      await kv.set(key, { count: 1, resetAt }, { ex: config.windowSeconds });
      
      return {
        success: true,
        remaining: config.limit - 1,
        reset: resetAt,
      };
    }
    
    // Check if window has expired
    if (now >= data.resetAt) {
      // Window expired, reset counter
      const resetAt = now + windowMs;
      await kv.set(key, { count: 1, resetAt }, { ex: config.windowSeconds });
      
      return {
        success: true,
        remaining: config.limit - 1,
        reset: resetAt,
      };
    }
    
    // Window still active
    if (data.count >= config.limit) {
      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        reset: data.resetAt,
      };
    }
    
    // Increment counter
    const newCount = data.count + 1;
    await kv.set(key, { count: newCount, resetAt: data.resetAt }, { ex: config.windowSeconds });
    
    return {
      success: true,
      remaining: config.limit - newCount,
      reset: data.resetAt,
    };
  } catch (error) {
    // If KV is unavailable, allow the request (fail open)
    console.error('Rate limit error:', error);
    return {
      success: true,
      remaining: config.limit,
      reset: now + windowMs,
    };
  }
}

/**
 * Default rate limit configuration for search endpoints
 * 60 requests per minute per IP
 */
export const SEARCH_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowSeconds: 60,
};
