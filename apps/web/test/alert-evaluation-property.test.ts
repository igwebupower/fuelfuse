// Feature: fuelfuse-mvp, Property 10: Alert evaluation identifies price drops meeting threshold
// Validates: Requirements 4.3

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import { prisma } from '../lib/prisma';
import { evaluateAlertRule } from '../lib/alert-evaluation';
import { AlertRule } from '@fuelfuse/shared';

// Counter to ensure unique IDs across test runs
let testCounter = 0;

describe('Alert Evaluation - Property 10: Alert evaluation identifies price drops meeting threshold', () => {
  test('alert triggers when price drop meets or exceeds threshold and cooldown elapsed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data with significant drop
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 200 }),
          priceDrop: fc.integer({ min: 5, max: 30 }), // Significant drop
          threshold: fc.integer({ min: 2, max: 10 }), // Threshold in ppl
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, priceData) => {
          // Only test cases where price drop meets or exceeds threshold
          fc.pre(priceData.priceDrop >= priceData.threshold);

          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_eval_${uniqueId}`;
          const stationId = `station_eval_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station with current (lower) price
          const currentPrice = priceData.previousPrice - priceData.priceDrop;
          
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: 'Shell',
              name: 'Test Station',
              address: 'Test Address',
              postcode: 'SW1A 1AA',
              lat,
              lng,
              updatedAtSource: new Date(),
            },
          });

          await prisma.stationPriceLatest.create({
            data: {
              stationId: station.id,
              petrolPpl: priceData.fuelType === 'petrol' ? currentPrice : null,
              dieselPpl: priceData.fuelType === 'diesel' ? currentPrice : null,
              updatedAtSource: new Date(),
            },
          });

          // Create alert rule with last triggered more than 24 hours ago
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: priceData.threshold,
              enabled: true,
              lastNotifiedPrice: priceData.previousPrice,
              lastTriggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
            },
          });

          const alertRule: AlertRule = {
            id: rule.id,
            userId: rule.userId,
            lat: rule.lat || undefined,
            lng: rule.lng || undefined,
            radiusMiles: rule.radiusMiles,
            fuelType: rule.fuelType as 'petrol' | 'diesel',
            triggerType: rule.triggerType as 'price_drop',
            thresholdPpl: rule.thresholdPpl,
            enabled: rule.enabled,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
          };

          // Evaluate alert rule
          const evaluation = await evaluateAlertRule(alertRule);

          // Should trigger since price drop meets threshold and cooldown elapsed
          expect(evaluation.shouldTrigger).toBe(true);
          expect(evaluation.currentPrice).toBe(currentPrice);
          expect(evaluation.priceDrop).toBeGreaterThanOrEqual(priceData.threshold);
          expect(evaluation.station).toBeDefined();
          expect(evaluation.station?.stationId).toBe(stationId);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('alert does not trigger when cooldown has not elapsed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate hours since last trigger (within 24 hours)
        fc.integer({ min: 1, max: 23 }),
        // Generate price data with significant drop
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 200 }),
          priceDrop: fc.integer({ min: 10, max: 30 }),
          threshold: fc.integer({ min: 2, max: 5 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, hoursSinceLastTrigger, priceData) => {
          // Only test cases where price drop would meet threshold
          fc.pre(priceData.priceDrop >= priceData.threshold);

          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_cooldown_${uniqueId}`;
          const stationId = `station_cooldown_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station with current (lower) price
          const currentPrice = priceData.previousPrice - priceData.priceDrop;
          
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: 'Shell',
              name: 'Test Station',
              address: 'Test Address',
              postcode: 'SW1A 1AA',
              lat,
              lng,
              updatedAtSource: new Date(),
            },
          });

          await prisma.stationPriceLatest.create({
            data: {
              stationId: station.id,
              petrolPpl: priceData.fuelType === 'petrol' ? currentPrice : null,
              dieselPpl: priceData.fuelType === 'diesel' ? currentPrice : null,
              updatedAtSource: new Date(),
            },
          });

          // Create alert rule with last triggered within 24 hours
          const lastTriggeredAt = new Date(Date.now() - hoursSinceLastTrigger * 60 * 60 * 1000);
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: priceData.threshold,
              enabled: true,
              lastNotifiedPrice: priceData.previousPrice,
              lastTriggeredAt,
            },
          });

          const alertRule: AlertRule = {
            id: rule.id,
            userId: rule.userId,
            lat: rule.lat || undefined,
            lng: rule.lng || undefined,
            radiusMiles: rule.radiusMiles,
            fuelType: rule.fuelType as 'petrol' | 'diesel',
            triggerType: rule.triggerType as 'price_drop',
            thresholdPpl: rule.thresholdPpl,
            enabled: rule.enabled,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
          };

          // Evaluate alert rule
          const evaluation = await evaluateAlertRule(alertRule);

          // Should NOT trigger due to 24-hour cooldown
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.reason).toContain('cooldown');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('alert does not trigger when no previous price exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data
        fc.record({
          currentPrice: fc.integer({ min: 120, max: 180 }),
          threshold: fc.integer({ min: 2, max: 10 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, priceData) => {
          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_noprev_${uniqueId}`;
          const stationId = `station_noprev_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station with current price
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: 'Shell',
              name: 'Test Station',
              address: 'Test Address',
              postcode: 'SW1A 1AA',
              lat,
              lng,
              updatedAtSource: new Date(),
            },
          });

          await prisma.stationPriceLatest.create({
            data: {
              stationId: station.id,
              petrolPpl: priceData.fuelType === 'petrol' ? priceData.currentPrice : null,
              dieselPpl: priceData.fuelType === 'diesel' ? priceData.currentPrice : null,
              updatedAtSource: new Date(),
            },
          });

          // Create alert rule WITHOUT previous price
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: priceData.threshold,
              enabled: true,
              lastNotifiedPrice: null, // No previous price
              lastTriggeredAt: null,
            },
          });

          const alertRule: AlertRule = {
            id: rule.id,
            userId: rule.userId,
            lat: rule.lat || undefined,
            lng: rule.lng || undefined,
            radiusMiles: rule.radiusMiles,
            fuelType: rule.fuelType as 'petrol' | 'diesel',
            triggerType: rule.triggerType as 'price_drop',
            thresholdPpl: rule.thresholdPpl,
            enabled: rule.enabled,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
          };

          // Evaluate alert rule
          const evaluation = await evaluateAlertRule(alertRule);

          // Should NOT trigger because there's no previous price to compare
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.reason).toContain('No previous price');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('alert does not trigger when price drop is below threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data with small drop below threshold
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 200 }),
          priceDrop: fc.integer({ min: 1, max: 5 }), // Small drop
          threshold: fc.integer({ min: 10, max: 20 }), // Higher threshold
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, priceData) => {
          // Only test cases where price drop is below threshold
          fc.pre(priceData.priceDrop < priceData.threshold);

          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_below_${uniqueId}`;
          const stationId = `station_below_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station with current (slightly lower) price
          const currentPrice = priceData.previousPrice - priceData.priceDrop;
          
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: 'Shell',
              name: 'Test Station',
              address: 'Test Address',
              postcode: 'SW1A 1AA',
              lat,
              lng,
              updatedAtSource: new Date(),
            },
          });

          await prisma.stationPriceLatest.create({
            data: {
              stationId: station.id,
              petrolPpl: priceData.fuelType === 'petrol' ? currentPrice : null,
              dieselPpl: priceData.fuelType === 'diesel' ? currentPrice : null,
              updatedAtSource: new Date(),
            },
          });

          // Create alert rule with threshold higher than price drop
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: priceData.threshold,
              enabled: true,
              lastNotifiedPrice: priceData.previousPrice,
              lastTriggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
            },
          });

          const alertRule: AlertRule = {
            id: rule.id,
            userId: rule.userId,
            lat: rule.lat || undefined,
            lng: rule.lng || undefined,
            radiusMiles: rule.radiusMiles,
            fuelType: rule.fuelType as 'petrol' | 'diesel',
            triggerType: rule.triggerType as 'price_drop',
            thresholdPpl: rule.thresholdPpl,
            enabled: rule.enabled,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
          };

          // Evaluate alert rule
          const evaluation = await evaluateAlertRule(alertRule);

          // Should NOT trigger because price drop is below threshold
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.priceDrop).toBeLessThan(priceData.threshold);
          expect(evaluation.reason).toContain('threshold');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('alert works with postcode-based search', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data with significant drop
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 200 }),
          priceDrop: fc.integer({ min: 10, max: 30 }),
          threshold: fc.integer({ min: 2, max: 5 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, priceData) => {
          // Only test cases where price drop meets threshold
          fc.pre(priceData.priceDrop >= priceData.threshold);

          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          await prisma.postcodeGeoCache.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_postcode_${uniqueId}`;
          const stationId = `station_postcode_${uniqueId}`;
          
          // Fixed coordinates and postcode
          const lat = 51.5074;
          const lng = -0.1278;
          const postcode = 'SW1A 1AA';
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Cache the postcode
          await prisma.postcodeGeoCache.create({
            data: {
              postcodeNormalized: postcode,
              lat,
              lng,
            },
          });

          // Create station with current (lower) price
          const currentPrice = priceData.previousPrice - priceData.priceDrop;
          
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: 'Shell',
              name: 'Test Station',
              address: 'Test Address',
              postcode,
              lat,
              lng,
              updatedAtSource: new Date(),
            },
          });

          await prisma.stationPriceLatest.create({
            data: {
              stationId: station.id,
              petrolPpl: priceData.fuelType === 'petrol' ? currentPrice : null,
              dieselPpl: priceData.fuelType === 'diesel' ? currentPrice : null,
              updatedAtSource: new Date(),
            },
          });

          // Create alert rule with POSTCODE (not coordinates)
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              centerPostcode: postcode,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: priceData.threshold,
              enabled: true,
              lastNotifiedPrice: priceData.previousPrice,
              lastTriggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
            },
          });

          const alertRule: AlertRule = {
            id: rule.id,
            userId: rule.userId,
            centerPostcode: rule.centerPostcode || undefined,
            radiusMiles: rule.radiusMiles,
            fuelType: rule.fuelType as 'petrol' | 'diesel',
            triggerType: rule.triggerType as 'price_drop',
            thresholdPpl: rule.thresholdPpl,
            enabled: rule.enabled,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
          };

          // Evaluate alert rule
          const evaluation = await evaluateAlertRule(alertRule);

          // Should trigger since price drop meets threshold and cooldown elapsed
          expect(evaluation.shouldTrigger).toBe(true);
          expect(evaluation.currentPrice).toBe(currentPrice);
          expect(evaluation.priceDrop).toBeGreaterThanOrEqual(priceData.threshold);
          expect(evaluation.station).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  test('alert does not trigger when no stations found within radius', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 200 }),
          threshold: fc.integer({ min: 2, max: 10 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, priceData) => {
          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_nostation_${uniqueId}`;
          
          // Coordinates with no nearby stations
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create alert rule but NO stations in database
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: priceData.threshold,
              enabled: true,
              lastNotifiedPrice: priceData.previousPrice,
              lastTriggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
            },
          });

          const alertRule: AlertRule = {
            id: rule.id,
            userId: rule.userId,
            lat: rule.lat || undefined,
            lng: rule.lng || undefined,
            radiusMiles: rule.radiusMiles,
            fuelType: rule.fuelType as 'petrol' | 'diesel',
            triggerType: rule.triggerType as 'price_drop',
            thresholdPpl: rule.thresholdPpl,
            enabled: rule.enabled,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
          };

          // Evaluate alert rule
          const evaluation = await evaluateAlertRule(alertRule);

          // Should NOT trigger because no stations found
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.reason).toContain('No stations found');
        }
      ),
      { numRuns: 50 }
    );
  });
});
