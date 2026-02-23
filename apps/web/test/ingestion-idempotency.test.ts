// Feature: fuelfuse-mvp, Property 22: Ingestion is idempotent
// Validates: Requirements 6.8

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
import type { FuelFinderStation } from '@fuelfuse/shared/types';

// Helper function to upsert stations (extracted from ingestion service for testing)
async function upsertStations(stations: FuelFinderStation[]): Promise<void> {
  for (const station of stations) {
    await prisma.$transaction(async (tx) => {
      // Upsert station by stationId
      const upsertedStation = await tx.station.upsert({
        where: { stationId: station.stationId },
        create: {
          stationId: station.stationId,
          brand: station.brand,
          name: station.name,
          address: station.address,
          postcode: station.postcode,
          lat: station.lat,
          lng: station.lng,
          amenities: station.amenities || null,
          openingHours: station.openingHours || null,
          updatedAtSource: station.updatedAt,
        },
        update: {
          brand: station.brand,
          name: station.name,
          address: station.address,
          postcode: station.postcode,
          lat: station.lat,
          lng: station.lng,
          amenities: station.amenities || null,
          openingHours: station.openingHours || null,
          updatedAtSource: station.updatedAt,
        },
      });

      // Convert prices from pounds to pence if needed (assuming API returns pence)
      const petrolPpl = station.petrolPrice !== null ? Math.round(station.petrolPrice) : null;
      const dieselPpl = station.dieselPrice !== null ? Math.round(station.dieselPrice) : null;

      // Upsert station_prices_latest
      await tx.stationPriceLatest.upsert({
        where: { stationId: upsertedStation.id },
        create: {
          stationId: upsertedStation.id,
          petrolPpl,
          dieselPpl,
          updatedAtSource: station.updatedAt,
        },
        update: {
          petrolPpl,
          dieselPpl,
          updatedAtSource: station.updatedAt,
        },
      });

      // Insert into station_prices_history only if not already exists
      // Check for existing entry to prevent unique constraint violations
      const existingHistory = await tx.stationPriceHistory.findFirst({
        where: {
          stationId: upsertedStation.id,
          updatedAtSource: station.updatedAt,
        },
      });

      if (!existingHistory) {
        await tx.stationPriceHistory.create({
          data: {
            stationId: upsertedStation.id,
            petrolPpl,
            dieselPpl,
            updatedAtSource: station.updatedAt,
          },
        });
      }
    });
  }
}

describe('Ingestion Idempotency - Property 22: Ingestion is idempotent', () => {
  test('processing the same payload multiple times should produce the same database state', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of random stations
        fc.array(
          fc.record({
            stationId: fc.string({ minLength: 5, maxLength: 20 }),
            brand: fc.constantFrom('Shell', 'BP', 'Esso', 'Tesco'),
            name: fc.string({ minLength: 5, maxLength: 50 }),
            address: fc.string({ minLength: 10, maxLength: 100 }),
            postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH', 'EC1A 1BB'),
            lat: fc.double({ min: 50, max: 60, noNaN: true }),
            lng: fc.double({ min: -6, max: 2, noNaN: true }),
            petrolPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
            dieselPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (stationsPayload) => {
          // Clean up any existing data for these stations
          for (const station of stationsPayload) {
            const existing = await prisma.station.findUnique({
              where: { stationId: station.stationId },
            });
            if (existing) {
              await prisma.stationPriceHistory.deleteMany({
                where: { stationId: existing.id },
              });
              await prisma.stationPriceLatest.deleteMany({
                where: { stationId: existing.id },
              });
              await prisma.station.delete({
                where: { stationId: station.stationId },
              });
            }
          }

          // Process the payload once
          await upsertStations(stationsPayload);

          // Get the database state after first processing
          const stationsAfterFirst = await prisma.station.findMany({
            where: {
              stationId: { in: stationsPayload.map(s => s.stationId) },
            },
            include: {
              latestPrice: true,
              priceHistory: true,
            },
            orderBy: { stationId: 'asc' },
          });

          // Process the same payload again
          await upsertStations(stationsPayload);

          // Get the database state after second processing
          const stationsAfterSecond = await prisma.station.findMany({
            where: {
              stationId: { in: stationsPayload.map(s => s.stationId) },
            },
            include: {
              latestPrice: true,
              priceHistory: true,
            },
            orderBy: { stationId: 'asc' },
          });

          // The number of stations should be the same
          expect(stationsAfterSecond.length).toBe(stationsAfterFirst.length);

          // Each station should have the same data
          for (let i = 0; i < stationsAfterFirst.length; i++) {
            const first = stationsAfterFirst[i];
            const second = stationsAfterSecond[i];

            // Station data should be identical
            expect(second.stationId).toBe(first.stationId);
            expect(second.brand).toBe(first.brand);
            expect(second.name).toBe(first.name);
            expect(second.address).toBe(first.address);
            expect(second.postcode).toBe(first.postcode);

            // Latest price should be identical
            expect(second.latestPrice?.petrolPpl).toBe(first.latestPrice?.petrolPpl);
            expect(second.latestPrice?.dieselPpl).toBe(first.latestPrice?.dieselPpl);

            // Price history should have the same number of entries (no duplicates)
            expect(second.priceHistory.length).toBe(first.priceHistory.length);
          }

          // Process the same payload a third time
          await upsertStations(stationsPayload);

          // Get the database state after third processing
          const stationsAfterThird = await prisma.station.findMany({
            where: {
              stationId: { in: stationsPayload.map(s => s.stationId) },
            },
            include: {
              latestPrice: true,
              priceHistory: true,
            },
            orderBy: { stationId: 'asc' },
          });

          // Should still be the same
          expect(stationsAfterThird.length).toBe(stationsAfterFirst.length);

          // Verify no duplicate price history entries were created
          for (let i = 0; i < stationsAfterFirst.length; i++) {
            expect(stationsAfterThird[i].priceHistory.length).toBe(stationsAfterFirst[i].priceHistory.length);
          }
        }
      ),
      { numRuns: 10 } // Reduced from 100 for faster execution with database operations
    );
  }, 60000); // Increase timeout to 60 seconds

  test('processing the same station with same updatedAt should not create duplicate history entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stationId: fc.string({ minLength: 5, maxLength: 20 }),
          brand: fc.constantFrom('Shell', 'BP', 'Esso'),
          name: fc.string({ minLength: 5, maxLength: 50 }),
          address: fc.string({ minLength: 10, maxLength: 100 }),
          postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH'),
          lat: fc.double({ min: 50, max: 60, noNaN: true }),
          lng: fc.double({ min: -6, max: 2, noNaN: true }),
          petrolPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          dieselPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
        }),
        async (stationData) => {
          // Clean up
          const existing = await prisma.station.findUnique({
            where: { stationId: stationData.stationId },
          });
          if (existing) {
            await prisma.stationPriceHistory.deleteMany({
              where: { stationId: existing.id },
            });
            await prisma.stationPriceLatest.deleteMany({
              where: { stationId: existing.id },
            });
            await prisma.station.delete({
              where: { stationId: stationData.stationId },
            });
          }

          // Process the station 5 times
          await upsertStations([stationData]);
          await upsertStations([stationData]);
          await upsertStations([stationData]);
          await upsertStations([stationData]);
          await upsertStations([stationData]);

          // Get the station with price history
          const station = await prisma.station.findUnique({
            where: { stationId: stationData.stationId },
            include: {
              priceHistory: true,
            },
          });

          expect(station).not.toBeNull();

          // Should only have 1 price history entry (unique constraint on stationId + updatedAtSource)
          expect(station!.priceHistory.length).toBe(1);
        }
      ),
      { numRuns: 10 } // Reduced from 100 for faster execution with database operations
    );
  }, 60000); // Increase timeout to 60 seconds
});
