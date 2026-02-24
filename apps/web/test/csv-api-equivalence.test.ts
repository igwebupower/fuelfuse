// Feature: fuelfuse-mvp, Property 24: CSV and API ingestion produce equivalent results
// Validates: Requirements 7.2

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
import { parseAndValidateCSV } from '../lib/csv-parser';
import { upsertStationsAndPrices } from '../lib/ingestion';
import type { FuelFinderStation } from '@fuelfuse/shared/types';

/**
 * Convert FuelFinderStation array to CSV format
 */
function stationsToCSV(stations: FuelFinderStation[]): string {
  const header = 'station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at,amenities,opening_hours';
  
  const rows = stations.map(station => {
    const amenitiesStr = station.amenities ? `"${JSON.stringify(station.amenities)}"` : '';
    const openingHoursStr = station.openingHours ? `"${JSON.stringify(station.openingHours)}"` : '';
    
    return [
      station.stationId,
      station.name,
      station.brand,
      station.address,
      station.postcode,
      station.lat.toString(),
      station.lng.toString(),
      station.petrolPrice !== null ? station.petrolPrice.toString() : 'null',
      station.dieselPrice !== null ? station.dieselPrice.toString() : 'null',
      station.updatedAt.toISOString(),
      amenitiesStr,
      openingHoursStr,
    ].join(',');
  });
  
  return [header, ...rows].join('\n');
}

/**
 * Get database state for a list of station IDs
 */
async function getDatabaseState(stationIds: string[]) {
  return await prisma.station.findMany({
    where: {
      stationId: { in: stationIds },
    },
    include: {
      latestPrice: true,
      priceHistory: {
        orderBy: { updatedAtSource: 'asc' },
      },
    },
    orderBy: { stationId: 'asc' },
  });
}

/**
 * Clean up stations from database
 */
async function cleanupStations(stationIds: string[]) {
  for (const stationId of stationIds) {
    const existing = await prisma.station.findUnique({
      where: { stationId },
    });
    if (existing) {
      await prisma.stationPriceHistory.deleteMany({
        where: { stationId: existing.id },
      });
      await prisma.stationPriceLatest.deleteMany({
        where: { stationId: existing.id },
      });
      await prisma.station.delete({
        where: { stationId },
      });
    }
  }
}

describe('CSV/API Equivalence - Property 24: CSV and API ingestion produce equivalent results', () => {
  test('CSV ingestion and API ingestion should produce identical database state for the same data', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of random stations
        fc.array(
          fc.record({
            stationId: fc.hexaString({ minLength: 5, maxLength: 20 }),
            brand: fc.constantFrom('Shell', 'BP', 'Esso', 'Tesco', 'Sainsburys'),
            name: fc.hexaString({ minLength: 5, maxLength: 50 }).map(s => `Station ${s}`),
            address: fc.hexaString({ minLength: 10, maxLength: 100 }).map(s => `${s} Street`),
            postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH', 'EC1A 1BB', 'W1A 0AX', 'N1 9GU'),
            lat: fc.double({ min: 50, max: 60, noNaN: true }),
            lng: fc.double({ min: -6, max: 2, noNaN: true }),
            petrolPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
            dieselPrice: fc.option(fc.double({ min: 100, max: 200, noNaN: true }), { nil: null }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (stationsPayload) => {
          const stationIds = stationsPayload.map(s => s.stationId);
          
          // Clean up any existing data
          await cleanupStations(stationIds);

          // Scenario 1: Ingest via API (direct call to upsertStationsAndPrices)
          await upsertStationsAndPrices(stationsPayload);
          const apiState = await getDatabaseState(stationIds);

          // Clean up for second scenario
          await cleanupStations(stationIds);

          // Scenario 2: Ingest via CSV
          const csvData = stationsToCSV(stationsPayload);
          const parsedStations = parseAndValidateCSV(csvData);
          await upsertStationsAndPrices(parsedStations);
          const csvState = await getDatabaseState(stationIds);

          // Both methods should produce the same number of stations
          expect(csvState.length).toBe(apiState.length);
          expect(csvState.length).toBe(stationsPayload.length);

          // Compare each station's data
          for (let i = 0; i < apiState.length; i++) {
            const apiStation = apiState[i];
            const csvStation = csvState[i];

            // Station metadata should be identical
            expect(csvStation.stationId).toBe(apiStation.stationId);
            expect(csvStation.brand).toBe(apiStation.brand);
            expect(csvStation.name).toBe(apiStation.name);
            expect(csvStation.address).toBe(apiStation.address);
            expect(csvStation.postcode).toBe(apiStation.postcode);
            expect(csvStation.lat).toBe(apiStation.lat);
            expect(csvStation.lng).toBe(apiStation.lng);

            // Latest prices should be identical
            expect(csvStation.latestPrice?.petrolPpl).toBe(apiStation.latestPrice?.petrolPpl);
            expect(csvStation.latestPrice?.dieselPpl).toBe(apiStation.latestPrice?.dieselPpl);
            
            // Updated timestamps should match
            expect(csvStation.latestPrice?.updatedAtSource.getTime()).toBe(
              apiStation.latestPrice?.updatedAtSource.getTime()
            );

            // Price history should have the same number of entries
            expect(csvStation.priceHistory.length).toBe(apiStation.priceHistory.length);

            // Each price history entry should match
            for (let j = 0; j < apiStation.priceHistory.length; j++) {
              expect(csvStation.priceHistory[j].petrolPpl).toBe(apiStation.priceHistory[j].petrolPpl);
              expect(csvStation.priceHistory[j].dieselPpl).toBe(apiStation.priceHistory[j].dieselPpl);
              expect(csvStation.priceHistory[j].updatedAtSource.getTime()).toBe(
                apiStation.priceHistory[j].updatedAtSource.getTime()
              );
            }
          }

          // Clean up after test
          await cleanupStations(stationIds);
        }
      ),
      { numRuns: 10 } // Reduced from 100 for faster execution with database operations
    );
  }, 60000); // 60 second timeout

  test('CSV and API ingestion should handle null prices identically', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stationId: fc.hexaString({ minLength: 5, maxLength: 20 }),
          brand: fc.constantFrom('Shell', 'BP', 'Esso'),
          name: fc.hexaString({ minLength: 5, maxLength: 50 }).map(s => `Station ${s}`),
          address: fc.hexaString({ minLength: 10, maxLength: 100 }).map(s => `${s} Street`),
          postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH'),
          lat: fc.double({ min: 50, max: 60, noNaN: true }),
          lng: fc.double({ min: -6, max: 2, noNaN: true }),
          // One price is always null
          petrolPrice: fc.constant(null),
          dieselPrice: fc.double({ min: 100, max: 200, noNaN: true }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
        }),
        async (stationData) => {
          await cleanupStations([stationData.stationId]);

          // Ingest via API
          await upsertStationsAndPrices([stationData]);
          const apiStation = await prisma.station.findUnique({
            where: { stationId: stationData.stationId },
            include: { latestPrice: true },
          });

          await cleanupStations([stationData.stationId]);

          // Ingest via CSV
          const csvData = stationsToCSV([stationData]);
          const parsedStations = parseAndValidateCSV(csvData);
          await upsertStationsAndPrices(parsedStations);
          const csvStation = await prisma.station.findUnique({
            where: { stationId: stationData.stationId },
            include: { latestPrice: true },
          });

          // Both should handle null prices the same way
          expect(csvStation?.latestPrice?.petrolPpl).toBe(apiStation?.latestPrice?.petrolPpl);
          expect(csvStation?.latestPrice?.petrolPpl).toBeNull();
          expect(csvStation?.latestPrice?.dieselPpl).toBe(apiStation?.latestPrice?.dieselPpl);

          await cleanupStations([stationData.stationId]);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  test('CSV and API ingestion should handle updates identically', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stationId: fc.hexaString({ minLength: 5, maxLength: 20 }),
          brand: fc.constantFrom('Shell', 'BP', 'Esso'),
          name: fc.hexaString({ minLength: 5, maxLength: 50 }).map(s => `Station ${s}`),
          address: fc.hexaString({ minLength: 10, maxLength: 100 }).map(s => `${s} Street`),
          postcode: fc.constantFrom('SW1A 1AA', 'E1 7BH'),
          lat: fc.double({ min: 50, max: 60, noNaN: true }),
          lng: fc.double({ min: -6, max: 2, noNaN: true }),
          initialPetrolPrice: fc.double({ min: 100, max: 200, noNaN: true }),
          initialDieselPrice: fc.double({ min: 100, max: 200, noNaN: true }),
          updatedPetrolPrice: fc.double({ min: 100, max: 200, noNaN: true }),
          updatedDieselPrice: fc.double({ min: 100, max: 200, noNaN: true }),
          initialDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
          updatedDate: fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') }),
        }),
        async (data) => {
          await cleanupStations([data.stationId]);

          const initialStation: FuelFinderStation = {
            stationId: data.stationId,
            brand: data.brand,
            name: data.name,
            address: data.address,
            postcode: data.postcode,
            lat: data.lat,
            lng: data.lng,
            petrolPrice: data.initialPetrolPrice,
            dieselPrice: data.initialDieselPrice,
            updatedAt: data.initialDate,
          };

          const updatedStation: FuelFinderStation = {
            ...initialStation,
            petrolPrice: data.updatedPetrolPrice,
            dieselPrice: data.updatedDieselPrice,
            updatedAt: data.updatedDate,
          };

          // Scenario 1: API ingestion with initial then update
          await upsertStationsAndPrices([initialStation]);
          await upsertStationsAndPrices([updatedStation]);
          const apiState = await prisma.station.findUnique({
            where: { stationId: data.stationId },
            include: {
              latestPrice: true,
              priceHistory: { orderBy: { updatedAtSource: 'asc' } },
            },
          });

          await cleanupStations([data.stationId]);

          // Scenario 2: CSV ingestion with initial then update
          const initialCSV = stationsToCSV([initialStation]);
          const updatedCSV = stationsToCSV([updatedStation]);
          
          const parsedInitial = parseAndValidateCSV(initialCSV);
          await upsertStationsAndPrices(parsedInitial);
          
          const parsedUpdated = parseAndValidateCSV(updatedCSV);
          await upsertStationsAndPrices(parsedUpdated);
          
          const csvState = await prisma.station.findUnique({
            where: { stationId: data.stationId },
            include: {
              latestPrice: true,
              priceHistory: { orderBy: { updatedAtSource: 'asc' } },
            },
          });

          // Latest prices should match
          expect(csvState?.latestPrice?.petrolPpl).toBe(apiState?.latestPrice?.petrolPpl);
          expect(csvState?.latestPrice?.dieselPpl).toBe(apiState?.latestPrice?.dieselPpl);

          // Price history should have same number of entries
          expect(csvState?.priceHistory.length).toBe(apiState?.priceHistory.length);
          expect(csvState?.priceHistory.length).toBe(2); // Initial + updated

          await cleanupStations([data.stationId]);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});
