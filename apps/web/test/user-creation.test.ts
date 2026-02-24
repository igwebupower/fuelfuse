// Feature: fuelfuse-mvp, Property 5: User creation stores Clerk ID and email
// Validates: Requirements 3.1

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser, getUserByClerkId } from '../lib/user';

describe('User Creation - Property 5: User creation stores Clerk ID and email', () => {
  test('creating a user should store Clerk user ID and email correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random Clerk user IDs (format: user_<random string>)
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        async ({ clerkUserId, email }) => {
          // Create user
          const user = await createUser(clerkUserId, email);
          
          // Verify user was created with correct values
          expect(user.clerkUserId).toBe(clerkUserId);
          expect(user.email).toBe(email);
          expect(user.id).toBeDefined();
          expect(user.createdAt).toBeInstanceOf(Date);
          expect(user.updatedAt).toBeInstanceOf(Date);
          
          // Verify user can be retrieved by Clerk ID
          const retrievedUser = await getUserByClerkId(clerkUserId);
          expect(retrievedUser).not.toBeNull();
          expect(retrievedUser?.clerkUserId).toBe(clerkUserId);
          expect(retrievedUser?.email).toBe(email);
          expect(retrievedUser?.id).toBe(user.id);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('creating users with unique Clerk IDs should succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate array of unique user data
        fc.uniqueArray(
          fc.record({
            clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
            email: fc.emailAddress(),
          }),
          {
            minLength: 2,
            maxLength: 5,
            selector: (item) => item.clerkUserId,
          }
        ),
        async (users) => {
          // Create all users
          const createdUsers = [];
          for (const userData of users) {
            const user = await createUser(userData.clerkUserId, userData.email);
            createdUsers.push(user);
          }
          
          // Verify all users were created
          expect(createdUsers).toHaveLength(users.length);
          
          // Verify each user can be retrieved
          for (let i = 0; i < users.length; i++) {
            const retrieved = await getUserByClerkId(users[i].clerkUserId);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.clerkUserId).toBe(users[i].clerkUserId);
            expect(retrieved?.email).toBe(users[i].email);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('specific user creation examples work correctly', async () => {
    // Test specific examples
    const testCases = [
      { clerkUserId: 'user_abc123', email: 'test@example.com' },
      { clerkUserId: 'user_xyz789', email: 'user@test.co.uk' },
      { clerkUserId: 'user_test_long_id_12345', email: 'long.email.address@domain.com' },
    ];
    
    for (const testCase of testCases) {
      const user = await createUser(testCase.clerkUserId, testCase.email);
      expect(user.clerkUserId).toBe(testCase.clerkUserId);
      expect(user.email).toBe(testCase.email);
      
      const retrieved = await getUserByClerkId(testCase.clerkUserId);
      expect(retrieved?.clerkUserId).toBe(testCase.clerkUserId);
      expect(retrieved?.email).toBe(testCase.email);
    }
  });
});
