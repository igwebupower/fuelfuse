// Feature: fuelfuse-mvp, Property 20: Price history prevents duplicates
// Validates: Requirements 6.6, 11.6

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';

describe('Database Constraints - Property 20: Price history prevents duplicates', () => {
  test('inserting duplicate station price history records should result in only one record', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary station data with unique stationId
        fc.record({
          brand: fc.constantFrom('Shell', 'BP', 'Tesco', 'Sainsburys', 'Esso'),
          name: fc.string({ minLength: 5, maxLength: 50 }),
          address: fc.string({ minLength: 10, maxLength: 100 }),
          postcode: fc.string({ minLength: 6, maxLength: 8 }),
          lat: fc.double({ min: 49.0, max: 61.0 }),
          lng: fc.double({ min: -8.0, max: 2.0 }),
          petrolPpl: fc.option(fc.integer({ min: 100, max: 200 }), { nil: null }),
          dieselPpl: fc.option(fc.integer({ min: 100, max: 200 }), { nil: null }),
          updatedAtSource: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
        }),
        async (stationData: {
          brand: string;
          name: string;
          address: string;
          postcode: string;
          lat: number;
          lng: number;
          petrolPpl: number | null;
          dieselPpl: number | null;
          updatedAtSource: Date;
        }) => {
          // Generate unique stationId for this iteration
          const uniqueStationId = `station-${randomUUID()}`;
          
          // Create a station first
          const station = await prisma.station.create({
            data: {
              stationId: uniqueStationId,
              brand: stationData.brand,
              name: stationData.name,
              address: stationData.address,
              postcode: stationData.postcode,
              lat: stationData.lat,
              lng: stationData.lng,
              updatedAtSource: stationData.updatedAtSource,
            },
          });

          // Try to insert the same price history record twice
          const priceData = {
            stationId: station.id,
            petrolPpl: stationData.petrolPpl,
            dieselPpl: stationData.dieselPpl,
            updatedAtSource: stationData.updatedAtSource,
          };

          // First insertion should succeed
          await prisma.stationPriceHistory.create({
            data: priceData,
          });

          // Second insertion with same stationId and updatedAtSource should fail
          let duplicateInsertFailed = false;
          try {
            await prisma.stationPriceHistory.create({
              data: priceData,
            });
          } catch (error: any) {
            // Prisma throws P2002 for unique constraint violations
            if (error.code === 'P2002') {
              duplicateInsertFailed = true;
            }
          }

          // Verify that duplicate insertion was prevented
          expect(duplicateInsertFailed).toBe(true);

          // Verify only one record exists
          const historyRecords = await prisma.stationPriceHistory.findMany({
            where: {
              stationId: station.id,
              updatedAtSource: stationData.updatedAtSource,
            },
          });

          expect(historyRecords.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('inserting price history with different updatedAtSource should create separate records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          brand: fc.constantFrom('Shell', 'BP', 'Tesco', 'Sainsburys', 'Esso'),
          name: fc.string({ minLength: 5, maxLength: 50 }),
          address: fc.string({ minLength: 10, maxLength: 100 }),
          postcode: fc.string({ minLength: 6, maxLength: 8 }),
          lat: fc.double({ min: 49.0, max: 61.0 }),
          lng: fc.double({ min: -8.0, max: 2.0 }),
          petrolPpl: fc.option(fc.integer({ min: 100, max: 200 }), { nil: null }),
          dieselPpl: fc.option(fc.integer({ min: 100, max: 200 }), { nil: null }),
          updatedAtSource1: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
          updatedAtSource2: fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') }),
        }),
        async (stationData: {
          brand: string;
          name: string;
          address: string;
          postcode: string;
          lat: number;
          lng: number;
          petrolPpl: number | null;
          dieselPpl: number | null;
          updatedAtSource1: Date;
          updatedAtSource2: Date;
        }) => {
          // Generate unique stationId for this iteration
          const uniqueStationId = `station-${randomUUID()}`;
          
          // Create a station first
          const station = await prisma.station.create({
            data: {
              stationId: uniqueStationId,
              brand: stationData.brand,
              name: stationData.name,
              address: stationData.address,
              postcode: stationData.postcode,
              lat: stationData.lat,
              lng: stationData.lng,
              updatedAtSource: stationData.updatedAtSource1,
            },
          });

          // Insert first price history record
          await prisma.stationPriceHistory.create({
            data: {
              stationId: station.id,
              petrolPpl: stationData.petrolPpl,
              dieselPpl: stationData.dieselPpl,
              updatedAtSource: stationData.updatedAtSource1,
            },
          });

          // Insert second price history record with different updatedAtSource
          await prisma.stationPriceHistory.create({
            data: {
              stationId: station.id,
              petrolPpl: stationData.petrolPpl,
              dieselPpl: stationData.dieselPpl,
              updatedAtSource: stationData.updatedAtSource2,
            },
          });

          // Verify two records exist
          const historyRecords = await prisma.stationPriceHistory.findMany({
            where: {
              stationId: station.id,
            },
          });

          expect(historyRecords.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
