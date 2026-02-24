// Feature: fuelfuse-mvp, Property 6: User preferences round-trip
// Validates: Requirements 3.2, 3.3

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser, saveUserPreferences, getUserPreferences } from '../lib/user';
import { UserPreferences } from '@fuelfuse/shared';

describe('User Preferences - Property 6: User preferences round-trip', () => {
  test('saving and retrieving preferences should return equivalent values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate preferences data
        fc.record({
          homePostcode: fc.option(
            fc.record({
              area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
              district: fc.integer({ min: 1, max: 99 }),
              sector: fc.integer({ min: 0, max: 9 }),
              unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
            }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
            { nil: null }
          ),
          defaultRadius: fc.integer({ min: 1, max: 25 }),
          defaultFuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, preferences) => {
          // Create user first
          const user = await createUser(userData.clerkUserId, userData.email);
          
          // Save preferences
          const saved = await saveUserPreferences(user.id, preferences);
          
          // Verify saved preferences match input
          expect(saved.homePostcode).toBe(preferences.homePostcode);
          expect(saved.defaultRadius).toBe(preferences.defaultRadius);
          expect(saved.defaultFuelType).toBe(preferences.defaultFuelType);
          
          // Retrieve preferences
          const retrieved = await getUserPreferences(user.id);
          
          // Verify retrieved preferences match saved preferences
          expect(retrieved).not.toBeNull();
          expect(retrieved?.homePostcode).toBe(preferences.homePostcode);
          expect(retrieved?.defaultRadius).toBe(preferences.defaultRadius);
          expect(retrieved?.defaultFuelType).toBe(preferences.defaultFuelType);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('updating preferences should overwrite previous values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate two different sets of preferences
        fc.tuple(
          fc.record({
            homePostcode: fc.option(
              fc.record({
                area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N'),
                district: fc.integer({ min: 1, max: 99 }),
                sector: fc.integer({ min: 0, max: 9 }),
                unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF'),
              }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
              { nil: null }
            ),
            defaultRadius: fc.integer({ min: 1, max: 25 }),
            defaultFuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          }),
          fc.record({
            homePostcode: fc.option(
              fc.record({
                area: fc.constantFrom('SE', 'NW', 'CR', 'BR', 'RM'),
                district: fc.integer({ min: 1, max: 99 }),
                sector: fc.integer({ min: 0, max: 9 }),
                unit: fc.constantFrom('AG', 'AH', 'AJ', 'AL', 'AM'),
              }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
              { nil: null }
            ),
            defaultRadius: fc.integer({ min: 1, max: 25 }),
            defaultFuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          })
        ),
        async (userData, [firstPrefs, secondPrefs]) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);
          
          // Save first preferences
          await saveUserPreferences(user.id, firstPrefs);
          
          // Save second preferences (should overwrite)
          await saveUserPreferences(user.id, secondPrefs);
          
          // Retrieve preferences
          const retrieved = await getUserPreferences(user.id);
          
          // Should match second preferences, not first
          expect(retrieved).not.toBeNull();
          expect(retrieved?.homePostcode).toBe(secondPrefs.homePostcode);
          expect(retrieved?.defaultRadius).toBe(secondPrefs.defaultRadius);
          expect(retrieved?.defaultFuelType).toBe(secondPrefs.defaultFuelType);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('retrieving preferences for user without preferences returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        async (userData) => {
          // Create user without preferences
          const user = await createUser(userData.clerkUserId, userData.email);
          
          // Try to retrieve preferences
          const retrieved = await getUserPreferences(user.id);
          
          // Should return null
          expect(retrieved).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('specific preferences examples work correctly', async () => {
    // Test specific examples
    const testCases: UserPreferences[] = [
      { homePostcode: 'SW1A 1AA', defaultRadius: 5, defaultFuelType: 'petrol' },
      { homePostcode: 'E1 7BH', defaultRadius: 10, defaultFuelType: 'diesel' },
      { homePostcode: null, defaultRadius: 25, defaultFuelType: 'petrol' },
      { homePostcode: 'EC1A 1BB', defaultRadius: 15, defaultFuelType: 'diesel' },
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      const user = await createUser(`user_test_${i}`, `test${i}@example.com`);
      
      // Save preferences
      await saveUserPreferences(user.id, testCases[i]);
      
      // Retrieve and verify
      const retrieved = await getUserPreferences(user.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.homePostcode).toBe(testCases[i].homePostcode);
      expect(retrieved?.defaultRadius).toBe(testCases[i].defaultRadius);
      expect(retrieved?.defaultFuelType).toBe(testCases[i].defaultFuelType);
    }
  });
});
