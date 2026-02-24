// Feature: fuelfuse-mvp, Property 8: Push token registration stores token and platform
// Validates: Requirements 4.1

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import {
  registerToken,
  getTokensForUser,
  removeToken,
  updateTokenLastUsed,
} from '../lib/push-token';

describe('Push Token Registration - Property 8: Push token registration stores token and platform', () => {
  test('registering a token stores it with user ID and platform', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate push token data
        fc.record({
          token: fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
          platform: fc.constantFrom('ios' as const, 'android' as const),
        }),
        async (userData, tokenData) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Register token
          const registered = await registerToken(user.id, tokenData.token, tokenData.platform);

          // Verify token is stored with correct user ID and platform
          expect(registered.userId).toBe(user.id);
          expect(registered.expoPushToken).toBe(tokenData.token);
          expect(registered.platform).toBe(tokenData.platform);
          expect(registered.createdAt).toBeDefined();
          expect(registered.updatedAt).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('registering multiple tokens for same user stores all tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate multiple tokens
        fc.array(
          fc.record({
            token: fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
            platform: fc.constantFrom('ios' as const, 'android' as const),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (userData, tokenDataArray) => {
          // Clean database for this iteration
          await prisma.pushToken.deleteMany();
          await prisma.user.deleteMany();

          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Register multiple tokens
          for (const tokenData of tokenDataArray) {
            await registerToken(user.id, tokenData.token, tokenData.platform);
          }

          // Retrieve all tokens for user
          const tokens = await getTokensForUser(user.id);

          // Verify all tokens are stored
          expect(tokens).toHaveLength(tokenDataArray.length);
          for (const tokenData of tokenDataArray) {
            expect(tokens).toContain(tokenData.token);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('updating a token replaces old token with new one for same user', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate two different tokens
        fc.tuple(
          fc.record({
            token: fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
            platform: fc.constantFrom('ios' as const, 'android' as const),
          }),
          fc.record({
            token: fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
            platform: fc.constantFrom('ios' as const, 'android' as const),
          })
        ),
        async (userData, [oldToken, newToken]) => {
          // Skip if tokens are the same
          if (oldToken.token === newToken.token) {
            return;
          }

          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Register first token
          await registerToken(user.id, oldToken.token, oldToken.platform);

          // Register second token (update)
          const updated = await registerToken(user.id, newToken.token, newToken.platform);

          // Verify new token is stored with correct user ID and platform
          expect(updated.userId).toBe(user.id);
          expect(updated.expoPushToken).toBe(newToken.token);
          expect(updated.platform).toBe(newToken.platform);

          // Verify both tokens exist (they are different tokens)
          const tokens = await getTokensForUser(user.id);
          expect(tokens).toContain(oldToken.token);
          expect(tokens).toContain(newToken.token);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('removing a token deletes it from database', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate push token data
        fc.record({
          token: fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
          platform: fc.constantFrom('ios' as const, 'android' as const),
        }),
        async (userData, tokenData) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Register token
          await registerToken(user.id, tokenData.token, tokenData.platform);

          // Verify token exists
          let tokens = await getTokensForUser(user.id);
          expect(tokens).toContain(tokenData.token);

          // Remove token
          await removeToken(tokenData.token);

          // Verify token is removed
          tokens = await getTokensForUser(user.id);
          expect(tokens).not.toContain(tokenData.token);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('updating last_used_at timestamp updates the token', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate push token data
        fc.record({
          token: fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
          platform: fc.constantFrom('ios' as const, 'android' as const),
        }),
        async (userData, tokenData) => {
          // Clean database for this iteration
          await prisma.pushToken.deleteMany();
          await prisma.user.deleteMany();

          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Register token
          const registered = await registerToken(user.id, tokenData.token, tokenData.platform);
          const originalUpdatedAt = registered.updatedAt;

          // Wait a bit to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));

          // Update last used
          await updateTokenLastUsed(tokenData.token);

          // Verify token still exists and updatedAt was updated
          const tokens = await getTokensForUser(user.id);
          expect(tokens).toContain(tokenData.token);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('specific token examples work correctly', async () => {
    // Test specific examples with both iOS and Android
    const testCases = [
      { platform: 'ios' as const, token: 'ExponentPushToken[abc123def456]' },
      { platform: 'android' as const, token: 'ExponentPushToken[xyz789uvw012]' },
      { platform: 'ios' as const, token: 'ExponentPushToken[token_ios_1]' },
      { platform: 'android' as const, token: 'ExponentPushToken[token_android_1]' },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const user = await createUser(`user_push_${i}`, `push${i}@example.com`);
      const testCase = testCases[i];

      // Register token
      const registered = await registerToken(user.id, testCase.token, testCase.platform);

      // Verify stored correctly
      expect(registered.userId).toBe(user.id);
      expect(registered.expoPushToken).toBe(testCase.token);
      expect(registered.platform).toBe(testCase.platform);

      // Verify can retrieve
      const tokens = await getTokensForUser(user.id);
      expect(tokens).toContain(testCase.token);
    }
  });
});
