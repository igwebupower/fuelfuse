// Feature: fuelfuse-mvp, Property 9: Alert rule creation stores all parameters
// Validates: Requirements 4.2

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import { prisma } from '../lib/prisma';
import {
  createAlertRule,
  getAlertRule,
  getAlertRulesForUser,
  updateAlertRule,
  deleteAlertRule,
  getEnabledAlertRules,
} from '../lib/alert-rule';

describe('Alert Rule Creation - Property 9: Alert rule creation stores all parameters', () => {
  test('creating alert rule with postcode stores all parameters correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate alert rule parameters with postcode
        fc.record({
          centerPostcode: fc.record({
            area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
            district: fc.integer({ min: 1, max: 99 }),
            sector: fc.integer({ min: 0, max: 9 }),
            unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
          }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
          radiusMiles: fc.integer({ min: 1, max: 25 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          thresholdPpl: fc.integer({ min: 1, max: 100 }),
        }),
        async (userData, params) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Create Pro subscription (required for alert creation)
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
              stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
              status: 'active',
              plan: 'pro_monthly',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // Create alert rule
          const created = await createAlertRule(user.id, {
            centerPostcode: params.centerPostcode,
            radiusMiles: params.radiusMiles,
            fuelType: params.fuelType,
            thresholdPpl: params.thresholdPpl,
          });

          // Verify all parameters are stored
          expect(created.userId).toBe(user.id);
          expect(created.centerPostcode).toBe(params.centerPostcode);
          expect(created.radiusMiles).toBe(params.radiusMiles);
          expect(created.fuelType).toBe(params.fuelType);
          expect(created.thresholdPpl).toBe(params.thresholdPpl);
          expect(created.triggerType).toBe('price_drop');
          expect(created.enabled).toBe(true);

          // Verify retrieval returns same values
          const retrieved = await getAlertRule(created.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.userId).toBe(user.id);
          expect(retrieved?.centerPostcode).toBe(params.centerPostcode);
          expect(retrieved?.radiusMiles).toBe(params.radiusMiles);
          expect(retrieved?.fuelType).toBe(params.fuelType);
          expect(retrieved?.thresholdPpl).toBe(params.thresholdPpl);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('creating alert rule with lat/lng stores all parameters correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate alert rule parameters with lat/lng
        fc.record({
          lat: fc.float({ min: 50.0, max: 58.0 }), // UK latitude range
          lng: fc.float({ min: -8.0, max: 2.0 }), // UK longitude range
          radiusMiles: fc.integer({ min: 1, max: 25 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          thresholdPpl: fc.integer({ min: 1, max: 100 }),
        }),
        async (userData, params) => {
          // Clean database for this iteration
          await prisma.alertRule.deleteMany();
          await prisma.subscription.deleteMany();
          await prisma.user.deleteMany();

          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Create Pro subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
              stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
              status: 'active',
              plan: 'pro_monthly',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // Create alert rule
          const created = await createAlertRule(user.id, {
            lat: params.lat,
            lng: params.lng,
            radiusMiles: params.radiusMiles,
            fuelType: params.fuelType,
            thresholdPpl: params.thresholdPpl,
          });

          // Verify all parameters are stored
          expect(created.userId).toBe(user.id);
          expect(created.lat).toBeCloseTo(params.lat, 10); // Use toBeCloseTo for floating point comparison
          expect(created.lng).toBeCloseTo(params.lng, 10); // Use toBeCloseTo for floating point comparison
          expect(created.radiusMiles).toBe(params.radiusMiles);
          expect(created.fuelType).toBe(params.fuelType);
          expect(created.thresholdPpl).toBe(params.thresholdPpl);
          expect(created.triggerType).toBe('price_drop');
          expect(created.enabled).toBe(true);

          // Verify retrieval returns same values
          const retrieved = await getAlertRule(created.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.lat).toBeCloseTo(params.lat, 10);
          expect(retrieved?.lng).toBeCloseTo(params.lng, 10);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('alert rule CRUD operations work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate alert rule parameters
        fc.record({
          centerPostcode: fc.record({
            area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N'),
            district: fc.integer({ min: 1, max: 99 }),
            sector: fc.integer({ min: 0, max: 9 }),
            unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF'),
          }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
          radiusMiles: fc.integer({ min: 1, max: 25 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          thresholdPpl: fc.integer({ min: 1, max: 100 }),
        }),
        // Generate update parameters
        fc.record({
          newRadiusMiles: fc.integer({ min: 1, max: 25 }),
          newThresholdPpl: fc.integer({ min: 1, max: 100 }),
        }),
        async (userData, params, updateParams) => {
          // Clean database for this iteration
          await prisma.alertRule.deleteMany();
          await prisma.subscription.deleteMany();
          await prisma.user.deleteMany();

          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Create Pro subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
              stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
              status: 'active',
              plan: 'pro_monthly',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // Create alert rule
          const created = await createAlertRule(user.id, {
            centerPostcode: params.centerPostcode,
            radiusMiles: params.radiusMiles,
            fuelType: params.fuelType,
            thresholdPpl: params.thresholdPpl,
          });

          // Verify it appears in user's alert rules
          const userRules = await getAlertRulesForUser(user.id);
          expect(userRules).toHaveLength(1);
          expect(userRules[0].id).toBe(created.id);

          // Update alert rule
          const updated = await updateAlertRule(created.id, {
            radiusMiles: updateParams.newRadiusMiles,
            thresholdPpl: updateParams.newThresholdPpl,
          });

          expect(updated.radiusMiles).toBe(updateParams.newRadiusMiles);
          expect(updated.thresholdPpl).toBe(updateParams.newThresholdPpl);
          expect(updated.centerPostcode).toBe(params.centerPostcode); // Unchanged

          // Verify update persisted
          const retrieved = await getAlertRule(created.id);
          expect(retrieved?.radiusMiles).toBe(updateParams.newRadiusMiles);
          expect(retrieved?.thresholdPpl).toBe(updateParams.newThresholdPpl);

          // Delete alert rule
          await deleteAlertRule(created.id);

          // Verify deletion
          const deleted = await getAlertRule(created.id);
          expect(deleted).toBeNull();

          // Verify it's removed from user's rules
          const userRulesAfterDelete = await getAlertRulesForUser(user.id);
          expect(userRulesAfterDelete).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('enabled alert rules are retrieved correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate alert rule parameters
        fc.record({
          centerPostcode: fc.record({
            area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N'),
            district: fc.integer({ min: 1, max: 99 }),
            sector: fc.integer({ min: 0, max: 9 }),
            unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF'),
          }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
          radiusMiles: fc.integer({ min: 1, max: 25 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          thresholdPpl: fc.integer({ min: 1, max: 100 }),
        }),
        async (userData, params) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Create Pro subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
              stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
              status: 'active',
              plan: 'pro_monthly',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // Create enabled alert rule
          const enabledRule = await createAlertRule(user.id, {
            centerPostcode: params.centerPostcode,
            radiusMiles: params.radiusMiles,
            fuelType: params.fuelType,
            thresholdPpl: params.thresholdPpl,
            enabled: true,
          });

          // Create disabled alert rule
          const disabledRule = await createAlertRule(user.id, {
            centerPostcode: params.centerPostcode,
            radiusMiles: params.radiusMiles,
            fuelType: params.fuelType,
            thresholdPpl: params.thresholdPpl,
            enabled: false,
          });

          // Get all enabled rules
          const enabledRules = await getEnabledAlertRules();

          // Verify enabled rule is in the list
          const foundEnabled = enabledRules.find(r => r.id === enabledRule.id);
          expect(foundEnabled).not.toBeUndefined();
          expect(foundEnabled?.enabled).toBe(true);

          // Verify disabled rule is not in the list
          const foundDisabled = enabledRules.find(r => r.id === disabledRule.id);
          expect(foundDisabled).toBeUndefined();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('free tier users cannot create alert rules', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.string({ minLength: 10, maxLength: 50 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
        }),
        // Generate alert rule parameters
        fc.record({
          centerPostcode: fc.record({
            area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N'),
            district: fc.integer({ min: 1, max: 99 }),
            sector: fc.integer({ min: 0, max: 9 }),
            unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF'),
          }).map(c => `${c.area}${c.district} ${c.sector}${c.unit}`),
          radiusMiles: fc.integer({ min: 1, max: 25 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
          thresholdPpl: fc.integer({ min: 1, max: 100 }),
        }),
        async (userData, params) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Create Free tier subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
              stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
              status: 'active',
              plan: 'free',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // Attempt to create alert rule should fail
          try {
            await createAlertRule(user.id, {
              centerPostcode: params.centerPostcode,
              radiusMiles: params.radiusMiles,
              fuelType: params.fuelType,
              thresholdPpl: params.thresholdPpl,
            });
            // Should not reach here
            expect.fail('Expected error for Free tier user');
          } catch (error: any) {
            expect(error.message).toContain('Pro feature');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('specific alert rule examples work correctly', async () => {
    // Test specific examples
    const testCases = [
      {
        centerPostcode: 'SW1A 1AA',
        radiusMiles: 5,
        fuelType: 'petrol' as const,
        thresholdPpl: 5,
      },
      {
        centerPostcode: 'E1 7BH',
        radiusMiles: 10,
        fuelType: 'diesel' as const,
        thresholdPpl: 10,
      },
      {
        lat: 51.5074,
        lng: -0.1278,
        radiusMiles: 15,
        fuelType: 'petrol' as const,
        thresholdPpl: 8,
      },
      {
        lat: 53.4808,
        lng: -2.2426,
        radiusMiles: 25,
        fuelType: 'diesel' as const,
        thresholdPpl: 15,
      },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const user = await createUser(`user_alert_test_${i}`, `alert${i}@example.com`);

      // Create Pro subscription
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
          stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Create alert rule
      const created = await createAlertRule(user.id, testCases[i] as any);

      // Verify all parameters
      expect(created.userId).toBe(user.id);
      expect(created.radiusMiles).toBe(testCases[i].radiusMiles);
      expect(created.fuelType).toBe(testCases[i].fuelType);
      expect(created.thresholdPpl).toBe(testCases[i].thresholdPpl);

      if ('centerPostcode' in testCases[i]) {
        expect(created.centerPostcode).toBe(testCases[i].centerPostcode);
      } else {
        expect(created.lat).toBe(testCases[i].lat);
        expect(created.lng).toBe(testCases[i].lng);
      }
    }
  });
});
