// Feature: fuelfuse-mvp, Property 13: Disabled alerts are not evaluated
// Validates: Requirements 4.7

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import { prisma } from '../lib/prisma';
import { evaluateAlertRule } from '../lib/alert-evaluation';
import { AlertRule } from '@fuelfuse/shared';

// Counter to ensure unique IDs across test runs
let testCounter = 0;

describe('Disabled Alerts - Property 13: Disabled alerts are not evaluated', () => {
  test('disabled alert rules do not trigger regardless of price drop', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data with significant drop
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 180 }),
          priceDrop: fc.integer({ min: 10, max: 50 }), // Very significant drop
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
          const clerkUserId = `user_disabled_${uniqueId}`;
          const stationId = `station_disabled_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station with very low price
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

          // Create DISABLED alert rule with very low threshold
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: 1, // Very low threshold
              enabled: false, // DISABLED
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

          // Should NOT trigger because rule is disabled
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.reason).toContain('disabled');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('enabled alert rules trigger normally', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data with significant drop
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 180 }),
          priceDrop: fc.integer({ min: 10, max: 30 }),
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
          const clerkUserId = `user_enabled_${uniqueId}`;
          const stationId = `station_enabled_${uniqueId}`;
          
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

          // Create ENABLED alert rule with low threshold
          const rule = await prisma.alertRule.create({
            data: {
              userId: user.id,
              lat,
              lng,
              radiusMiles: 5,
              fuelType: priceData.fuelType,
              triggerType: 'price_drop',
              thresholdPpl: 2, // Low threshold
              enabled: true, // ENABLED
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

          // Should trigger because rule is enabled and price drop is significant
          expect(evaluation.shouldTrigger).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('toggling enabled status changes alert behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data
        fc.record({
          email: fc.emailAddress(),
        }),
        // Generate price data
        fc.record({
          previousPrice: fc.integer({ min: 150, max: 180 }),
          priceDrop: fc.integer({ min: 10, max: 30 }),
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
          const clerkUserId = `user_toggle_${uniqueId}`;
          const stationId = `station_toggle_${uniqueId}`;
          
          // Fixed coordinates
          const lat = 51.5074;
          const lng = -0.1278;
          
          // Create user
          const user = await createUser(clerkUserId, userData.email);

          // Create station
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

          // Create enabled alert rule
          let rule = await prisma.alertRule.create({
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
              lastTriggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            },
          });

          // Test when enabled
          let alertRule: AlertRule = {
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

          let evaluation = await evaluateAlertRule(alertRule);
          expect(evaluation.shouldTrigger).toBe(true);

          // Disable the rule
          rule = await prisma.alertRule.update({
            where: { id: rule.id },
            data: { enabled: false },
          });

          // Test when disabled
          alertRule = {
            ...alertRule,
            enabled: false,
          };

          evaluation = await evaluateAlertRule(alertRule);
          expect(evaluation.shouldTrigger).toBe(false);
          expect(evaluation.reason).toContain('disabled');
        }
      ),
      { numRuns: 20 }
    );
  });
});
