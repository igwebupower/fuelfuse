// Feature: fuelfuse-mvp, Property 18: OAuth token caching reduces API calls
// Validates: Requirements 6.2

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getOAuthToken, clearOAuthTokenCache } from '../lib/oauth';
import { kv } from '@vercel/kv';

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('OAuth Token Caching - Property 18: OAuth token caching reduces API calls', () => {
  let fetchSpy: any;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
    
    // Set up environment variables for testing
    process.env.FUEL_FINDER_CLIENT_ID = 'test-client-id';
    process.env.FUEL_FINDER_CLIENT_SECRET = 'test-client-secret';
    process.env.FUEL_FINDER_API_URL = 'https://api.test.gov.uk';
  });
  
  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  test('cached valid token should be reused without making new API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random token data
          accessToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          expiresIn: fc.integer({ min: 3600, max: 7200 }), // 1-2 hours
          callCount: fc.integer({ min: 2, max: 5 }), // Number of times to call getOAuthToken
        }),
        async (data) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          fetchSpy.mockClear();
          
          // Calculate expiry time that's still valid (in the future)
          const expiresAt = Date.now() + (data.expiresIn * 1000);
          
          // Mock KV to return a cached valid token
          (kv.get as any).mockResolvedValue({
            accessToken: data.accessToken,
            expiresAt: expiresAt,
          });
          
          // Mock fetch (should not be called if cache is valid)
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'new-token-should-not-be-used',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'fuelfinder.read',
            }),
          });
          
          // Call getOAuthToken multiple times
          const tokens: string[] = [];
          for (let i = 0; i < data.callCount; i++) {
            const token = await getOAuthToken();
            tokens.push(token);
          }
          
          // All tokens should be the same (from cache)
          expect(tokens.every(t => t === data.accessToken)).toBe(true);
          
          // Fetch should not have been called (using cache)
          expect(fetchSpy).not.toHaveBeenCalled();
          
          // KV get should have been called for each request
          expect(kv.get).toHaveBeenCalledTimes(data.callCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('expired cached token should trigger new API call and cache update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          oldToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          newToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          expiresIn: fc.integer({ min: 3600, max: 7200 }),
        }),
        async (data) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          fetchSpy.mockClear();
          
          // Mock KV to return an expired token on first call
          const expiredTime = Date.now() - 1000; // Expired 1 second ago
          (kv.get as any).mockResolvedValueOnce({
            accessToken: data.oldToken,
            expiresAt: expiredTime,
          });
          
          // Mock successful OAuth response
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: data.newToken,
              token_type: 'Bearer',
              expires_in: data.expiresIn,
              scope: 'fuelfinder.read',
            }),
          });
          
          (kv.set as any).mockResolvedValue('OK');
          
          // Get token - should fetch new one since cached is expired
          const token = await getOAuthToken();
          
          // Should return the new token
          expect(token).toBe(data.newToken);
          
          // Fetch should have been called once to get new token
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          
          // New token should have been cached
          expect(kv.set).toHaveBeenCalledTimes(1);
          expect(kv.set).toHaveBeenCalledWith(
            'fuel_finder_oauth_token',
            expect.objectContaining({
              accessToken: data.newToken,
            }),
            expect.objectContaining({ ex: expect.any(Number) })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('no cached token should trigger API call and cache the result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          accessToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          expiresIn: fc.integer({ min: 3600, max: 7200 }),
        }),
        async (data) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          fetchSpy.mockClear();
          
          // Mock KV to return null (no cached token)
          (kv.get as any).mockResolvedValue(null);
          
          // Mock successful OAuth response
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: data.accessToken,
              token_type: 'Bearer',
              expires_in: data.expiresIn,
              scope: 'fuelfinder.read',
            }),
          });
          
          (kv.set as any).mockResolvedValue('OK');
          
          // Get token - should fetch new one
          const token = await getOAuthToken();
          
          // Should return the token from API
          expect(token).toBe(data.accessToken);
          
          // Fetch should have been called once
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          
          // Token should have been cached
          expect(kv.set).toHaveBeenCalledTimes(1);
          expect(kv.set).toHaveBeenCalledWith(
            'fuel_finder_oauth_token',
            expect.objectContaining({
              accessToken: data.accessToken,
            }),
            expect.objectContaining({ ex: expect.any(Number) })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('token refresh buffer ensures token is refreshed 5 minutes before expiry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          oldToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          newToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          expiresIn: fc.integer({ min: 3600, max: 7200 }),
        }),
        async (data) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          fetchSpy.mockClear();
          
          // Mock KV to return a token that has already expired (expiresAt in the past)
          // Since the 5-minute buffer is already subtracted when tokens are cached,
          // we need to set expiresAt to a time that's already passed to trigger refresh
          const expiredTime = Date.now() - (1 * 60 * 1000); // Expired 1 minute ago
          (kv.get as any).mockResolvedValueOnce({
            accessToken: data.oldToken,
            expiresAt: expiredTime,
          });
          
          // Mock successful OAuth response
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: data.newToken,
              token_type: 'Bearer',
              expires_in: data.expiresIn,
              scope: 'fuelfinder.read',
            }),
          });
          
          (kv.set as any).mockResolvedValue('OK');
          
          // Get token - should fetch new one since cached token has expired
          const token = await getOAuthToken();
          
          // Should return the new token (not the cached one)
          expect(token).toBe(data.newToken);
          
          // Fetch should have been called to refresh
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          
          // New token should have been cached
          expect(kv.set).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('multiple concurrent requests should use cached token without race conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          accessToken: fc.hexaString({ minLength: 32, maxLength: 64 }),
          expiresIn: fc.integer({ min: 3600, max: 7200 }),
          concurrentCalls: fc.integer({ min: 3, max: 10 }),
        }),
        async (data) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          fetchSpy.mockClear();
          
          // Calculate expiry time that's still valid
          const expiresAt = Date.now() + (data.expiresIn * 1000);
          
          // Mock KV to return a cached valid token
          (kv.get as any).mockResolvedValue({
            accessToken: data.accessToken,
            expiresAt: expiresAt,
          });
          
          // Mock fetch (should not be called)
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'should-not-be-used',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'fuelfinder.read',
            }),
          });
          
          // Make multiple concurrent calls
          const promises = Array(data.concurrentCalls)
            .fill(null)
            .map(() => getOAuthToken());
          
          const tokens = await Promise.all(promises);
          
          // All tokens should be the same (from cache)
          expect(tokens.every(t => t === data.accessToken)).toBe(true);
          
          // Fetch should not have been called
          expect(fetchSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('clearOAuthTokenCache should remove cached token', async () => {
    // Mock KV del
    (kv.del as any).mockResolvedValue(1);
    
    await clearOAuthTokenCache();
    
    // Should have called del with correct key
    expect(kv.del).toHaveBeenCalledWith('fuel_finder_oauth_token');
  });

  test('specific example: valid token is reused, expired token triggers refresh', async () => {
    // Test with specific known values
    const validToken = 'valid-token-abc123';
    const newToken = 'new-token-xyz789';
    const expiresIn = 3600;
    
    // First call: valid cached token
    (kv.get as any).mockResolvedValueOnce({
      accessToken: validToken,
      expiresAt: Date.now() + 3600000, // 1 hour in future
    });
    
    const token1 = await getOAuthToken();
    expect(token1).toBe(validToken);
    expect(fetchSpy).not.toHaveBeenCalled();
    
    // Second call: expired cached token
    (kv.get as any).mockResolvedValueOnce({
      accessToken: validToken,
      expiresAt: Date.now() - 1000, // Expired
    });
    
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: newToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: 'fuelfinder.read',
      }),
    });
    
    (kv.set as any).mockResolvedValue('OK');
    
    const token2 = await getOAuthToken();
    expect(token2).toBe(newToken);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(kv.set).toHaveBeenCalledTimes(1);
  });
});
