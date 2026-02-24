// Tests for rate limiting functionality
// Requirements: 8.2
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { rateLimit, SEARCH_RATE_LIMIT } from '../lib/rate-limit';
import { kv } from '@vercel/kv';

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should allow first request and set counter', async () => {
    vi.mocked(kv.get).mockResolvedValue(null);
    vi.mocked(kv.set).mockResolvedValue('OK');

    const result = await rateLimit('test-ip', SEARCH_RATE_LIMIT);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(SEARCH_RATE_LIMIT.limit - 1);
    expect(kv.set).toHaveBeenCalledWith(
      'rate-limit:test-ip',
      expect.objectContaining({ count: 1 }),
      expect.any(Object)
    );
  });

  test('should increment counter for subsequent requests', async () => {
    const now = Date.now();
    const resetAt = now + 60000;

    vi.mocked(kv.get).mockResolvedValue({ count: 5, resetAt });
    vi.mocked(kv.set).mockResolvedValue('OK');

    const result = await rateLimit('test-ip', SEARCH_RATE_LIMIT);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(SEARCH_RATE_LIMIT.limit - 6);
    expect(kv.set).toHaveBeenCalledWith(
      'rate-limit:test-ip',
      expect.objectContaining({ count: 6, resetAt }),
      expect.any(Object)
    );
  });

  test('should reject request when limit exceeded', async () => {
    const now = Date.now();
    const resetAt = now + 60000;

    vi.mocked(kv.get).mockResolvedValue({ count: SEARCH_RATE_LIMIT.limit, resetAt });

    const result = await rateLimit('test-ip', SEARCH_RATE_LIMIT);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBe(resetAt);
    expect(kv.set).not.toHaveBeenCalled();
  });

  test('should reset counter when window expires', async () => {
    const now = Date.now();
    const expiredResetAt = now - 1000; // Expired 1 second ago

    vi.mocked(kv.get).mockResolvedValue({ count: SEARCH_RATE_LIMIT.limit, resetAt: expiredResetAt });
    vi.mocked(kv.set).mockResolvedValue('OK');

    const result = await rateLimit('test-ip', SEARCH_RATE_LIMIT);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(SEARCH_RATE_LIMIT.limit - 1);
    expect(kv.set).toHaveBeenCalledWith(
      'rate-limit:test-ip',
      expect.objectContaining({ count: 1 }),
      expect.any(Object)
    );
  });

  test('should fail open when KV is unavailable', async () => {
    vi.mocked(kv.get).mockRejectedValue(new Error('KV unavailable'));

    const result = await rateLimit('test-ip', SEARCH_RATE_LIMIT);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(SEARCH_RATE_LIMIT.limit);
  });

  test('should use different keys for different identifiers', async () => {
    vi.mocked(kv.get).mockResolvedValue(null);
    vi.mocked(kv.set).mockResolvedValue('OK');

    await rateLimit('ip-1', SEARCH_RATE_LIMIT);
    await rateLimit('ip-2', SEARCH_RATE_LIMIT);

    expect(kv.get).toHaveBeenCalledWith('rate-limit:ip-1');
    expect(kv.get).toHaveBeenCalledWith('rate-limit:ip-2');
  });

  test('should respect custom rate limit config', async () => {
    vi.mocked(kv.get).mockResolvedValue(null);
    vi.mocked(kv.set).mockResolvedValue('OK');

    const customConfig = { limit: 10, windowSeconds: 30 };
    const result = await rateLimit('test-ip', customConfig);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
    expect(kv.set).toHaveBeenCalledWith(
      'rate-limit:test-ip',
      expect.any(Object),
      { ex: 30 }
    );
  });
});
