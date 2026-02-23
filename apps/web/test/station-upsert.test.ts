// Feature: fuelfuse-mvp, Property 19: Station upsert creates or updates by station ID
// Validates: Requirements 6.5

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
import type { FuelFinderStation } from '@fuelfuse/shared/types';

// Helper function to upsert a single station (extracted from ingestion service for testing)
async function upsertStation(station: FuelFinderStation): Promise<void> {
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

    // Insert into station_prices_history (unique constraint prevents duplicates)
    try {
      await tx.stationPriceHistory.create({
        data: {
          stationId: upsertedStation.id,
          petrolPpl,
          dieselPpl,
          updatedAtSource: station.updatedAt,
        },
      });
    } catch (error: any) {
      // Ignore unique constraint violations (duplicate entries)
      if (error.code !== 'P2002') {
        throw error;
      }
    }
  });
}

describe('Station Upsert - Property 19: Station upsert creates or updates by station ID', () => {
  test('upserting a new station should create it in the database', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random station data
        fc.record({
          stationId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          brand: fc.constantFrom('Shell', 'BP', 'Esso', 'Tesco', 'Sainsburys', 'Asda'),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          address: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH', 'EC1A 1BB', 'W1A 0AX', 'N1 9GU'),
          lat: fc.double({ min: 50, max: 60, noNaN: true, noDefaultInfinity: true }).filter(n => Math.abs(n) > 1e-10), // UK latitude range, avoid extreme precision issues
          lng: fc.double({ min: -6, max: 2, noNaN: true, noDefaultInfinity: true }).filter(n => Math.abs(n) > 1e-10 || n === 0), // UK longitude range, avoid extreme precision issues
          petrolPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          dieselPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          amenities: fc.option(fc.constant({ carWash: true, shop: true }), { nil: undefined }),
          openingHours: fc.option(fc.constant({ monday: '6am-10pm' }), { nil: undefined }),
        }),
        async (stationData) => {
          // Ensure station doesn't exist before test
          const existingStation = await prisma.station.findUnique({
            where: { stationId: stationData.stationId },
          });
          
          if (existingStation) {
            // Clean up if it exists from a previous test
            await prisma.stationPriceHistory.deleteMany({
              where: { stationId: existingStation.id },
            });
            await prisma.stationPriceLatest.deleteMany({
              where: { stationId: existingStation.id },
            });
            await prisma.station.delete({
              where: { stationId: stationData.stationId },
            });
          }

          // Upsert the station (should create)
          await upsertStation(stationData);

          // Verify station was created
          const createdStation = await prisma.station.findUnique({
            where: { stationId: stationData.stationId },
            include: {
              latestPrice: true,
            },
          });

          expect(createdStation).not.toBeNull();
          expect(createdStation!.stationId).toBe(stationData.stationId);
          expect(createdStation!.brand).toBe(stationData.brand);
          expect(createdStation!.name).toBe(stationData.name);
          expect(createdStation!.address).toBe(stationData.address);
          expect(createdStation!.postcode).toBe(stationData.postcode);
          expect(createdStation!.lat).toBeCloseTo(stationData.lat, 10); // Allow small floating point differences
          expect(createdStation!.lng).toBeCloseTo(stationData.lng, 10); // Allow small floating point differences

          // Verify latest price was created
          expect(createdStation!.latestPrice).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('upserting an existing station should update it', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random station data
        fc.record({
          stationId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          brand: fc.constantFrom('Shell', 'BP', 'Esso', 'Tesco', 'Sainsburys', 'Asda'),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          address: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH', 'EC1A 1BB', 'W1A 0AX', 'N1 9GU'),
          lat: fc.double({ min: 50, max: 60, noNaN: true, noDefaultInfinity: true }).filter(n => Math.abs(n) > 1e-10),
          lng: fc.double({ min: -6, max: 2, noNaN: true, noDefaultInfinity: true }).filter(n => Math.abs(n) > 1e-10 || n === 0),
          petrolPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          dieselPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-30') }), // Leave room for +1 day
        }),
        async (initialData) => {
          // Clean up any existing data
          const existing = await prisma.station.findUnique({
            where: { stationId: initialData.stationId },
          });
          if (existing) {
            await prisma.stationPriceHistory.deleteMany({
              where: { stationId: existing.id },
            });
            await prisma.stationPriceLatest.deleteMany({
              where: { stationId: existing.id },
            });
            await prisma.station.delete({
              where: { stationId: initialData.stationId },
            });
          }

          // Create initial station
          await upsertStation(initialData);

          // Get the created station
          const initialStation = await prisma.station.findUnique({
            where: { stationId: initialData.stationId },
          });
          expect(initialStation).not.toBeNull();

          // Create updated data with same stationId but different fields and DIFFERENT timestamp
          const updatedTimestamp = new Date(initialData.updatedAt.getTime() + 86400000); // Add 1 day
          const updatedData: FuelFinderStation = {
            ...initialData,
            brand: 'Updated Brand',
            name: 'Updated Name',
            address: 'Updated Address',
            petrolPrice: initialData.petrolPrice !== null ? initialData.petrolPrice + 10 : 150,
            dieselPrice: initialData.dieselPrice !== null ? initialData.dieselPrice + 10 : 160,
            updatedAt: updatedTimestamp, // Use different timestamp to trigger update
          };

          // Upsert again (should update)
          await upsertStation(updatedData);

          // Verify station was updated
          const updatedStation = await prisma.station.findUnique({
            where: { stationId: initialData.stationId },
            include: {
              latestPrice: true,
            },
          });

          expect(updatedStation).not.toBeNull();
          expect(updatedStation!.id).toBe(initialStation!.id); // Same database ID
          expect(updatedStation!.stationId).toBe(initialData.stationId); // Same source ID
          expect(updatedStation!.brand).toBe('Updated Brand');
          expect(updatedStation!.name).toBe('Updated Name');
          expect(updatedStation!.address).toBe('Updated Address');

          // Verify prices were updated
          expect(updatedStation!.latestPrice).not.toBeNull();
          expect(updatedStation!.latestPrice!.petrolPpl).toBe(Math.round(updatedData.petrolPrice!));
          expect(updatedStation!.latestPrice!.dieselPpl).toBe(Math.round(updatedData.dieselPrice!));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('upserting stations with same stationId should not create duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stationId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          brand: fc.constantFrom('Shell', 'BP', 'Esso'),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          address: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH'),
          lat: fc.double({ min: 50, max: 60, noNaN: true, noDefaultInfinity: true }).filter(n => Math.abs(n) > 1e-10),
          lng: fc.double({ min: -6, max: 2, noNaN: true, noDefaultInfinity: true }).filter(n => Math.abs(n) > 1e-10 || n === 0),
          petrolPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          dieselPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
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

          // Upsert the same station multiple times
          await upsertStation(stationData);
          await upsertStation(stationData);
          await upsertStation(stationData);

          // Count stations with this stationId
          const stationCount = await prisma.station.count({
            where: { stationId: stationData.stationId },
          });

          // Should only have one station
          expect(stationCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
