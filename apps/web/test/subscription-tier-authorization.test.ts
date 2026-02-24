// Feature: fuelfuse-mvp, Property 17: Subscription tier authorization
// Validates: Requirements 5.4, 5.5, 5.6, 5.7

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import {
  getSubscriptionStatus,
  isProUser,
  enforceTierLimits,
  canCreateAlerts,
  enforceAlertPermission,
} from '../lib/subscription';
import { prisma } from '../lib/prisma';

describe('Subscription Tier Authorization - Property 17', () => {
  test('Pro users can access Pro features and have extended radius limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.uuid().map(id => `user_${id}`),
          email: fc.emailAddress(),
        }),
        // Generate radius within Pro limits (1-25 miles)
        fc.integer({ min: 1, max: 25 }),
        async (userData, radiusMiles) => {
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
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
          });

          // Verify subscription status
          const status = await getSubscriptionStatus(user.id);
          expect(status.tier).toBe('pro');
          expect(status.status).toBe('active');

          // Verify Pro user check
          const isPro = await isProUser(user.id);
          expect(isPro).toBe(true);

          // Verify radius limits (Pro can use up to 25 miles)
          await expect(enforceTierLimits(user.id, radiusMiles)).resolves.not.toThrow();

          // Verify alert creation permission
          const canCreate = await canCreateAlerts(user.id);
          expect(canCreate).toBe(true);

          await expect(enforceAlertPermission(user.id)).resolves.not.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Free users are blocked from Pro features and limited to 5 mile radius', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.uuid().map(id => `user_${id}`),
          email: fc.emailAddress(),
        }),
        // Generate radius within Free limits (1-5 miles)
        fc.integer({ min: 1, max: 5 }),
        async (userData, radiusMiles) => {
          // Create user without subscription (Free tier)
          const user = await createUser(userData.clerkUserId, userData.email);

          // Verify subscription status
          const status = await getSubscriptionStatus(user.id);
          expect(status.tier).toBe('free');

          // Verify Pro user check
          const isPro = await isProUser(user.id);
          expect(isPro).toBe(false);

          // Verify radius limits (Free can use up to 5 miles)
          await expect(enforceTierLimits(user.id, radiusMiles)).resolves.not.toThrow();

          // Verify alert creation permission (should be denied)
          const canCreate = await canCreateAlerts(user.id);
          expect(canCreate).toBe(false);

          await expect(enforceAlertPermission(user.id)).rejects.toThrow(
            'Alert creation is a Pro feature'
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Free users cannot exceed 5 mile radius limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.uuid().map(id => `user_${id}`),
          email: fc.emailAddress(),
        }),
        // Generate radius exceeding Free limits (6-25 miles)
        fc.integer({ min: 6, max: 25 }),
        async (userData, radiusMiles) => {
          // Create user without subscription (Free tier)
          const user = await createUser(userData.clerkUserId, userData.email);

          // Verify radius limit enforcement fails
          await expect(enforceTierLimits(user.id, radiusMiles)).rejects.toThrow(
            'Upgrade to Pro for extended radius'
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Pro users cannot exceed 25 mile radius limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.uuid().map(id => `user_${id}`),
          email: fc.emailAddress(),
        }),
        // Generate radius exceeding Pro limits (26-100 miles)
        fc.integer({ min: 26, max: 100 }),
        async (userData, radiusMiles) => {
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

          // Verify radius limit enforcement fails
          await expect(enforceTierLimits(user.id, radiusMiles)).rejects.toThrow(
            'exceeds Pro tier limit of 25 miles'
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test('inactive Pro subscriptions are treated as Free tier', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          clerkUserId: fc.uuid().map(id => `user_${id}`),
          email: fc.emailAddress(),
        }),
        // Generate inactive status
        fc.constantFrom('canceled', 'past_due', 'incomplete'),
        async (userData, inactiveStatus) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Create inactive Pro subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
              stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
              status: inactiveStatus,
              plan: 'pro_monthly',
              periodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            },
          });

          // Verify subscription status (should be Free tier)
          const status = await getSubscriptionStatus(user.id);
          expect(status.tier).toBe('free');

          // Verify Pro user check
          const isPro = await isProUser(user.id);
          expect(isPro).toBe(false);

          // Verify alert creation permission (should be denied)
          const canCreate = await canCreateAlerts(user.id);
          expect(canCreate).toBe(false);

          // Verify radius limit (should be 5 miles for Free tier)
          await expect(enforceTierLimits(user.id, 10)).rejects.toThrow(
            'Upgrade to Pro for extended radius'
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test('specific subscription tier examples work correctly', async () => {
    // Test Free tier user
    const freeUser = await createUser('user_free_test', 'free@example.com');
    
    const freeStatus = await getSubscriptionStatus(freeUser.id);
    expect(freeStatus.tier).toBe('free');
    
    const isFreeUserPro = await isProUser(freeUser.id);
    expect(isFreeUserPro).toBe(false);
    
    // Free user can use 5 miles
    await expect(enforceTierLimits(freeUser.id, 5)).resolves.not.toThrow();
    
    // Free user cannot use 6 miles
    await expect(enforceTierLimits(freeUser.id, 6)).rejects.toThrow();
    
    // Free user cannot create alerts
    await expect(enforceAlertPermission(freeUser.id)).rejects.toThrow();

    // Test Pro tier user
    const proUser = await createUser('user_pro_test', 'pro@example.com');
    
    await prisma.subscription.create({
      data: {
        userId: proUser.id,
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
        plan: 'pro_monthly',
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    
    const proStatus = await getSubscriptionStatus(proUser.id);
    expect(proStatus.tier).toBe('pro');
    expect(proStatus.status).toBe('active');
    
    const isProUserPro = await isProUser(proUser.id);
    expect(isProUserPro).toBe(true);
    
    // Pro user can use 25 miles
    await expect(enforceTierLimits(proUser.id, 25)).resolves.not.toThrow();
    
    // Pro user cannot use 26 miles
    await expect(enforceTierLimits(proUser.id, 26)).rejects.toThrow();
    
    // Pro user can create alerts
    await expect(enforceAlertPermission(proUser.id)).resolves.not.toThrow();

    // Test trialing Pro user (should have Pro access)
    const trialingUser = await createUser('user_trialing_test', 'trialing@example.com');
    
    await prisma.subscription.create({
      data: {
        userId: trialingUser.id,
        stripeCustomerId: 'cus_trial123',
        stripeSubscriptionId: 'sub_trial123',
        status: 'trialing',
        plan: 'pro_monthly',
        periodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days trial
      },
    });
    
    const trialingStatus = await getSubscriptionStatus(trialingUser.id);
    expect(trialingStatus.tier).toBe('pro');
    
    const isTrialingUserPro = await isProUser(trialingUser.id);
    expect(isTrialingUserPro).toBe(true);
    
    // Trialing user has Pro access
    await expect(enforceTierLimits(trialingUser.id, 25)).resolves.not.toThrow();
    await expect(enforceAlertPermission(trialingUser.id)).resolves.not.toThrow();
  });
});
