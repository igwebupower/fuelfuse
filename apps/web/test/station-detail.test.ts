// Feature: fuelfuse-mvp, Property 2: Station detail contains all required fields
// Validates: Requirements 2.1, 2.2

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { getStationDetail } from '../lib/search';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

describe('Station Detail - Property 2: Station detail contains all required fields', () => {
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

  test('station detail contains all required fields for any station', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Station metadata
          brand: fc.constantFrom('Shell', 'BP', 'Tesco', 'Sainsburys', 'Esso', 'Asda'),
          name: fc.string({ minLength: 5, maxLength: 50 }),
          address: fc.string({ minLength: 10, maxLength: 100 }),
          postcode: fc.string({ minLength: 6, maxLength: 8 }),
          // UK coordinates
          lat: fc.double({ min: 49.0, max: 61.0, noNaN: true, noDefaultInfinity: true }),
          lng: fc.double({ min: -8.0, max: 2.0, noNaN: true, noDefaultInfinity: true }),
          // Prices (can be null)
          petrolPpl: fc.option(fc.integer({ min: 100, max: 200 }), { nil: null }),
          dieselPpl: fc.option(fc.integer({ min: 100, max: 200 }), { nil: null }),
          // Optional fields
          hasAmenities: fc.boolean(),
          hasOpeningHours: fc.boolean(),
        }),
        async (stationData) => {
          // Clean up before this test iteration
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
          
          const stationId = `TEST-STATION-${Date.now()}-${Math.random()}`;
          
          const amenities = stationData.hasAmenities
            ? {
                carWash: fc.sample(fc.boolean(), 1)[0],
                shop: fc.sample(fc.boolean(), 1)[0],
                atm: fc.sample(fc.boolean(), 1)[0],
              }
            : null;
          
          const openingHours = stationData.hasOpeningHours
            ? {
                monday: '06:00-22:00',
                tuesday: '06:00-22:00',
                wednesday: '06:00-22:00',
                thursday: '06:00-22:00',
                friday: '06:00-22:00',
                saturday: '07:00-21:00',
                sunday: '08:00-20:00',
              }
            : null;
          
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: stationData.brand,
              name: stationData.name || `${stationData.brand} Station`,
              address: stationData.address || '123 Test Street',
              postcode: stationData.postcode || 'TE1 1ST',
              lat: stationData.lat,
              lng: stationData.lng,
              amenities: amenities ? (amenities as any) : Prisma.JsonNull,
              openingHours: openingHours ? (openingHours as any) : Prisma.JsonNull,
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
          
          const detail = await getStationDetail(stationId);
          
          expect(detail.stationId).toBe(stationId);
          expect(detail.brand).toBe(stationData.brand);
          expect(detail.name).toBeDefined();
          expect(detail.address).toBeDefined();
          expect(detail.postcode).toBeDefined();
          expect(detail.lat).toBeCloseTo(stationData.lat, 5);
          expect(detail.lng).toBeCloseTo(stationData.lng, 5);



          expect(detail.petrolPrice).toBe(stationData.petrolPpl);
          expect(detail.dieselPrice).toBe(stationData.dieselPpl);
          
          expect(detail.lastUpdated).toBeInstanceOf(Date);
          
          if (stationData.hasAmenities) {
            expect(detail.amenities).not.toBeNull();
            expect(typeof detail.amenities).toBe('object');
          } else {
            expect(detail.amenities).toBeNull();
          }
          
          if (stationData.hasOpeningHours) {
            expect(detail.openingHours).not.toBeNull();
            expect(typeof detail.openingHours).toBe('object');
          } else {
            expect(detail.openingHours).toBeNull();
          }
          
          if (stationData.petrolPpl !== null) {
            expect(detail.pricePerLitre).toBe(stationData.petrolPpl);
          } else if (stationData.dieselPpl !== null) {
            expect(detail.pricePerLitre).toBe(stationData.dieselPpl);
          } else {
            expect(detail.pricePerLitre).toBe(0);
          }
          
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  }, 120000);

  test('station detail throws error for non-existent station', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 30 }),
        async (nonExistentId) => {
          await prisma.station.deleteMany({
            where: { stationId: nonExistentId },
          });
          await expect(getStationDetail(nonExistentId)).rejects.toThrow(
            `Station not found: ${nonExistentId}`
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test('station detail handles null amenities and opening hours gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          brand: fc.constantFrom('Shell', 'BP', 'Tesco'),
          lat: fc.double({ min: 50.0, max: 55.0, noNaN: true, noDefaultInfinity: true }),
          lng: fc.double({ min: -5.0, max: 1.0, noNaN: true, noDefaultInfinity: true }),
          petrolPpl: fc.integer({ min: 100, max: 200 }),
        }),
        async (stationData) => {
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
          
          const stationId = `TEST-STATION-NULL-${Date.now()}-${Math.random()}`;
          
          const station = await prisma.station.create({
            data: {
              stationId,
              brand: stationData.brand,
              name: `${stationData.brand} Station`,
              address: '123 Test Street',
              postcode: 'TE1 1ST',
              lat: stationData.lat,
              lng: stationData.lng,
              amenities: Prisma.JsonNull,
              openingHours: Prisma.JsonNull,
              updatedAtSource: new Date(),
              latestPrice: {
                create: {
                  petrolPpl: stationData.petrolPpl,
                  dieselPpl: null,
                  updatedAtSource: new Date(),
                },
              },
            },
            include: {
              latestPrice: true,
            },
          });
          
          const detail = await getStationDetail(stationId);
          
          expect(detail.amenities).toBeNull();
          expect(detail.openingHours).toBeNull();
          expect(detail.stationId).toBe(stationId);
          expect(detail.brand).toBe(stationData.brand);
          expect(detail.petrolPrice).toBe(stationData.petrolPpl);
          expect(detail.dieselPrice).toBeNull();
          
          await prisma.stationPriceLatest.deleteMany({});
          await prisma.stationPriceHistory.deleteMany({});
          await prisma.station.deleteMany({});
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  }, 120000);

  test('specific example: station with all fields populated', async () => {
    await prisma.stationPriceLatest.deleteMany({});
    await prisma.stationPriceHistory.deleteMany({});
    await prisma.station.deleteMany({});
    
    const stationId = 'TEST-FULL-STATION';
    
    const station = await prisma.station.create({
      data: {
        stationId,
        brand: 'Shell',
        name: 'Shell Test Station',
        address: '123 Main Street, London',
        postcode: 'SW1A 1AA',
        lat: 51.5014,
        lng: -0.1419,
        amenities: {
          carWash: true,
          shop: true,
          atm: true,
          payAtPump: true,
        },
        openingHours: {
          monday: '06:00-22:00',
          tuesday: '06:00-22:00',
          wednesday: '06:00-22:00',
          thursday: '06:00-22:00',
          friday: '06:00-22:00',
          saturday: '07:00-21:00',
          sunday: '08:00-20:00',
        },
        updatedAtSource: new Date('2024-01-01T12:00:00Z'),
        latestPrice: {
          create: {
            petrolPpl: 145,
            dieselPpl: 155,
            updatedAtSource: new Date('2024-01-01T12:00:00Z'),
          },
        },
      },
      include: {
        latestPrice: true,
      },
    });
    
    const detail = await getStationDetail(stationId);
    
    expect(detail.stationId).toBe(stationId);
    expect(detail.brand).toBe('Shell');
    expect(detail.name).toBe('Shell Test Station');
    expect(detail.address).toBe('123 Main Street, London');
    expect(detail.postcode).toBe('SW1A 1AA');
    expect(detail.lat).toBe(51.5014);
    expect(detail.lng).toBe(-0.1419);
    expect(detail.petrolPrice).toBe(145);
    expect(detail.dieselPrice).toBe(155);
    expect(detail.pricePerLitre).toBe(145);
    expect(detail.amenities).toEqual({
      carWash: true,
      shop: true,
      atm: true,
      payAtPump: true,
    });
    expect(detail.openingHours).toEqual({
      monday: '06:00-22:00',
      tuesday: '06:00-22:00',
      wednesday: '06:00-22:00',
      thursday: '06:00-22:00',
      friday: '06:00-22:00',
      saturday: '07:00-21:00',
      sunday: '08:00-20:00',
    });
    expect(detail.lastUpdated).toBeInstanceOf(Date);
    
    await prisma.stationPriceLatest.deleteMany({});
    await prisma.stationPriceHistory.deleteMany({});
    await prisma.station.deleteMany({});
  });
});