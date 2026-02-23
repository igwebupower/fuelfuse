// Feature: fuelfuse-mvp, Property 1: Search results are within radius and sorted by price
// Validates: Requirements 1.1, 1.2, 1.3, 1.7

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { searchByPostcode, searchByCoordinates } from '../lib/search';
import { prisma } from '../lib/prisma';
import { FuelType } from '@fuelfuse/shared';

// Helper to calculate distance using Haversine formula
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

describe('Search Service - Property 1: Search results are within radius and sorted by price', () => {
  // Clean up test data before and after tests
  beforeAll(async () => {
    await prisma.stationPriceLatest.deleteMany({});
    await prisma.stationPriceHistory.deleteMany({});
    await prisma.station.deleteMany({});
  });

  afterAll(async () => {
    await prisma.stationPriceLatest.deleteMany({});
    await prisma.stationPriceHistory.deleteMany({});
    await prisma.station.deleteMany({});
  });

  test('search by coordinates returns stations within radius sorted by price', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Search center coordinates (UK bounds)
          centerLat: fc.double({ min: 50.0, max: 55.0, noNaN: true, noDefaultInfinity: true }),
          centerLng: fc.double({ min: -5.0, max: 1.0, noNaN: true, noDefaultInfinity: true }),
          // Search radius
          radiusMiles: fc.integer({ min: 1, max: 10 }),
          // Fuel type
          fuelType: fc.constantFrom('petrol' as FuelType, 'diesel' as FuelType),
          // Generate 5-15 stations
          stationCount: fc.integer({ min: 5, max: 15 }),
        }),
        fc.array(
          fc.record({
            // Station coordinates (some within radius, some outside)
            lat: fc.double({ min: 49.0, max: 56.0, noNaN: true, noDefaultInfinity: true }),
            lng: fc.double({ min: -6.0, max: 2.0, noNaN: true, noDefaultInfinity: true }),
            // Prices in pence per litre (100-200 ppl is realistic)
            petrolPpl: fc.integer({ min: 100, max: 200 }),
            dieselPpl: fc.integer({ min: 100, max: 200 }),
            // Station metadata
            brand: fc.constantFrom('Shell', 'BP', 'Tesco', 'Sainsburys', 'Esso'),
            name: fc.string({ minLength: 5, maxLength: 30 }),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (searchParams, stationsData) => {
          // Clean up before this test iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
          
          // Create test stations with prices in a single transaction
          const createdStations = [];
          for (let i = 0; i < stationsData.length; i++) {
            const stationData = stationsData[i];
            const stationId = `TEST-STATION-${Date.now()}-${i}-${Math.random()}`;
            
            // Create station with nested price creation to ensure atomicity
            const station = await prisma.station.create({
              data: {
                stationId,
                brand: stationData.brand,
                name: stationData.name || `${stationData.brand} Station ${i}`,
                address: `${i} Test Street`,
                postcode: `TE${i} 1ST`,
                lat: stationData.lat,
                lng: stationData.lng,
                updatedAtSource: new Date(),
                latestPrice: {
                  create: {
                    petrolPpl: stationData.petrolPpl,
                    dieselPpl: stationData.dieselPpl,
                    updatedAtSource: new Date(),
                  },
                },
              },
              include: {
                latestPrice: true,
              },
            });
            
            createdStations.push({
              ...station,
              petrolPpl: stationData.petrolPpl,
              dieselPpl: stationData.dieselPpl,
            });
          }
          
          // Perform search
          const results = await searchByCoordinates({
            lat: searchParams.centerLat,
            lng: searchParams.centerLng,
            radiusMiles: searchParams.radiusMiles,
            fuelType: searchParams.fuelType,
          });
          
          // Property 1: All results should be within the specified radius
          for (const result of results) {
            const distance = calculateDistance(
              searchParams.centerLat,
              searchParams.centerLng,
              createdStations.find(s => s.stationId === result.stationId)!.lat,
              createdStations.find(s => s.stationId === result.stationId)!.lng
            );
            expect(distance).toBeLessThanOrEqual(searchParams.radiusMiles);
          }
          
          // Property 2: Results should be sorted by price ascending
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].pricePerLitre).toBeLessThanOrEqual(results[i + 1].pricePerLitre);
          }
          
          // Property 3: When prices are equal, results should be sorted by distance
          for (let i = 0; i < results.length - 1; i++) {
            if (results[i].pricePerLitre === results[i + 1].pricePerLitre) {
              expect(results[i].distanceMiles).toBeLessThanOrEqual(results[i + 1].distanceMiles);
            }
          }
          
          // Property 4: All results should contain required fields
          for (const result of results) {
            expect(result.stationId).toBeDefined();
            expect(result.brand).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.address).toBeDefined();
            expect(result.postcode).toBeDefined();
            expect(result.pricePerLitre).toBeGreaterThan(0);
            expect(result.distanceMiles).toBeGreaterThanOrEqual(0);
            expect(result.lastUpdated).toBeInstanceOf(Date);
          }
          
          // Property 5: Results should only include stations with valid price for the fuel type
          const priceField = searchParams.fuelType === 'petrol' ? 'petrolPpl' : 'dieselPpl';
          for (const result of results) {
            const station = createdStations.find(s => s.stationId === result.stationId);
            expect(station![priceField]).toBeDefined();
            expect(station![priceField]).toBeGreaterThan(0);
          }
          
          // Property 6: Should return at most 10 results
          expect(results.length).toBeLessThanOrEqual(10);
          
          // Clean up after this iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  }, 120000);

  test('search by postcode uses geocoding and returns correct results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate valid UK postcode components
          area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
          // Postcode will geocode to these coordinates
          centerLat: fc.double({ min: 50.0, max: 55.0, noNaN: true, noDefaultInfinity: true }),
          centerLng: fc.double({ min: -5.0, max: 1.0, noNaN: true, noDefaultInfinity: true }),
          // Search radius
          radiusMiles: fc.integer({ min: 1, max: 10 }),
          // Fuel type
          fuelType: fc.constantFrom('petrol' as FuelType, 'diesel' as FuelType),
        }),
        fc.array(
          fc.record({
            lat: fc.double({ min: 49.0, max: 56.0, noNaN: true, noDefaultInfinity: true }),
            lng: fc.double({ min: -6.0, max: 2.0, noNaN: true, noDefaultInfinity: true }),
            petrolPpl: fc.integer({ min: 100, max: 200 }),
            dieselPpl: fc.integer({ min: 100, max: 200 }),
            brand: fc.constantFrom('Shell', 'BP', 'Tesco', 'Sainsburys', 'Esso'),
            name: fc.string({ minLength: 5, maxLength: 30 }),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (searchParams, stationsData) => {
          // Clean up before this test iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
          await prisma.postcodeGeoCache.deleteMany({});
          
          // Create postcode
          const outward = `${searchParams.area}${searchParams.district}`;
          const inward = `${searchParams.sector}${searchParams.unit}`;
          const postcode = `${outward} ${inward}`;
          const normalized = `${outward} ${inward}`;
          
          // Cache the postcode coordinates
          await prisma.postcodeGeoCache.create({
            data: {
              postcodeNormalized: normalized,
              lat: searchParams.centerLat,
              lng: searchParams.centerLng,
            },
          });
          
          // Create test stations with prices in a single transaction
          for (let i = 0; i < stationsData.length; i++) {
            const stationData = stationsData[i];
            const stationId = `TEST-STATION-${Date.now()}-${i}-${Math.random()}`;
            
            await prisma.station.create({
              data: {
                stationId,
                brand: stationData.brand,
                name: stationData.name || `${stationData.brand} Station ${i}`,
                address: `${i} Test Street`,
                postcode: `TE${i} 1ST`,
                lat: stationData.lat,
                lng: stationData.lng,
                updatedAtSource: new Date(),
                latestPrice: {
                  create: {
                    petrolPpl: stationData.petrolPpl,
                    dieselPpl: stationData.dieselPpl,
                    updatedAtSource: new Date(),
                  },
                },
              },
            });
          }
          
          // Perform search by postcode
          const results = await searchByPostcode({
            postcode,
            radiusMiles: searchParams.radiusMiles,
            fuelType: searchParams.fuelType,
          });
          
          // Same properties should hold as coordinate search
          // Property 1: All results should be within the specified radius
          for (const result of results) {
            const station = await prisma.station.findUnique({
              where: { stationId: result.stationId },
            });
            const distance = calculateDistance(
              searchParams.centerLat,
              searchParams.centerLng,
              station!.lat,
              station!.lng
            );
            expect(distance).toBeLessThanOrEqual(searchParams.radiusMiles);
          }
          
          // Property 2: Results should be sorted by price ascending
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].pricePerLitre).toBeLessThanOrEqual(results[i + 1].pricePerLitre);
          }
          
          // Clean up after this iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
          await prisma.postcodeGeoCache.deleteMany({});
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  }, 120000);

  test('search with no stations in radius returns empty array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          centerLat: fc.double({ min: 50.0, max: 55.0, noNaN: true, noDefaultInfinity: true }),
          centerLng: fc.double({ min: -5.0, max: 1.0, noNaN: true, noDefaultInfinity: true }),
          radiusMiles: fc.integer({ min: 1, max: 5 }),
          fuelType: fc.constantFrom('petrol' as FuelType, 'diesel' as FuelType),
        }),
        async (searchParams) => {
          // Clean up before this test iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
          
          // Create a station far away (outside any reasonable radius) with price
          // Use coordinates that are definitely >100 miles away
          const stationId = `TEST-STATION-FAR-${Date.now()}-${Math.random()}`;
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: 'Shell',
              name: 'Far Away Station',
              address: '999 Far Street',
              postcode: 'FA9 9AR',
              // Place station in northern Scotland if search is in southern England, or vice versa
              lat: searchParams.centerLat > 52.5 ? 50.0 : 57.0,
              lng: searchParams.centerLng > -2.0 ? -5.0 : 1.0,
              updatedAtSource: new Date(),
              latestPrice: {
                create: {
                  petrolPpl: 150,
                  dieselPpl: 160,
                  updatedAtSource: new Date(),
                },
              },
            },
          });
          
          // Perform search
          const results = await searchByCoordinates({
            lat: searchParams.centerLat,
            lng: searchParams.centerLng,
            radiusMiles: searchParams.radiusMiles,
            fuelType: searchParams.fuelType,
          });
          
          // Should return empty array when no stations in radius
          expect(results).toEqual([]);
          
          // Clean up after this iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  }, 120000);
});
