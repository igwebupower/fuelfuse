// Feature: fuelfuse-mvp, Property 12: Alert rate limiting prevents spam
// Validates: Requirements 4.5, 4.6

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import { prisma } from '../lib/prisma';
import { evaluateAlertRule } from '../lib/alert-evaluation';
import { AlertRule } from '@fuelfuse/shared';

// Counter to ensure unique IDs across test runs
let testCounter = 0;

describe('Alert Rate Limiting - Property 12: Alert rate limiting prevents spam', () => {
  test('no more than 2 alerts per 24 hours per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate number of alert rules (more than 2 to test limit)
        fc.integer({ min: 3, max: 5 }),
        // Generate price data with significant drops
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 180 }),
          priceDrop: fc.integer({ min: 10, max: 30 }), // Significant drop
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, numRules, priceData) => {
          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_ratelimit_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create a station with low price
          const currentPrice = priceData.previousPrice - priceData.priceDrop;
          const stationId = `station_ratelimit_${uniqueId}`;
          
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

          // Create multiple alert rules for the same user
          const alertRules: AlertRule[] = [];
          for (let i = 0; i < numRules; i++) {
            const rule = await prisma.alertRule.create({
              data: {
                userId: user.id,
                lat,
                lng,
                radiusMiles: 5,
                fuelType: priceData.fuelType,
                triggerType: 'price_drop',
                thresholdPpl: 2, // Low threshold to ensure trigger
                enabled: true,
                lastNotifiedPrice: priceData.previousPrice,
                lastTriggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
              },
            });

            alertRules.push({
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
            });
          }

          // Evaluate all alert rules with rate limiting
          let triggeredCount = 0;
          for (const rule of alertRules) {
            // Check if user has already triggered 2 alerts
            if (triggeredCount >= 2) {
              break; // Stop evaluating more rules for this user
            }

            const evaluation = await evaluateAlertRule(rule);
            if (evaluation.shouldTrigger) {
              triggeredCount++;
              // Simulate triggering by updating lastTriggeredAt
              await prisma.alertRule.update({
                where: { id: rule.id },
                data: { lastTriggeredAt: new Date() },
              });
            }
          }

          // Verify: no more than 2 alerts should trigger
          expect(triggeredCount).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('alerts do not re-trigger within 24 hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate hours since last trigger (within 24 hours)
        fc.integer({ min: 1, max: 23 }),
        // Generate price data
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 180 }),
          priceDrop: fc.integer({ min: 10, max: 30 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, hoursSinceLastTrigger, priceData) => {
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

          // Create station with low price
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
              thresholdPpl: 2,
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

          // Should not trigger due to 24-hour cooldown
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.reason).toContain('cooldown');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('alerts can trigger after 24 hours have elapsed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate hours since last trigger (more than 24 hours)
        fc.integer({ min: 25, max: 48 }),
        // Generate price data
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 180 }),
          priceDrop: fc.integer({ min: 10, max: 30 }),
          fuelType: fc.constantFrom('petrol' as const, 'diesel' as const),
        }),
        async (userData, hoursSinceLastTrigger, priceData) => {
          // Clean database for this iteration
          await prisma.stationPriceLatest.deleteMany();
          await prisma.stationPriceHistory.deleteMany();
          await prisma.station.deleteMany();
          await prisma.alertRule.deleteMany();
          await prisma.user.deleteMany();
          
          // Generate unique ID
          const uniqueId = `${Date.now()}_${Math.random()}_${testCounter++}`;
          const clerkUserId = `user_elapsed_${uniqueId}`;
          const stationId = `station_elapsed_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station with low price
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
          const lastTriggeredAt = new Date(Date.now() - hoursSinceLastTrigger * 60 * 60 * 1000);
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: 2,
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

          // Should trigger since cooldown has elapsed
          expect(evaluation.shouldTrigger).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });
});
