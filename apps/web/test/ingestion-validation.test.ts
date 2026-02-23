// Feature: fuelfuse-mvp, Property 7: Invalid inputs are rejected
// Validates: Requirements 3.4, 6.4, 8.1

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { fuelFinderStationSchema } from '@fuelfuse/shared/schemas';
import { z } from 'zod';

describe('Ingestion Input Validation - Property 7: Invalid inputs are rejected', () => {
  test('invalid station data should be rejected by Zod schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid station data with various missing or invalid fields
        fc.record({
          stationId: fc.option(fc.string(), { nil: undefined }), // Sometimes missing
          brand: fc.option(fc.string(), { nil: undefined }),
          name: fc.option(fc.string(), { nil: undefined }),
          address: fc.option(fc.string(), { nil: undefined }),
          postcode: fc.option(fc.string(), { nil: undefined }),
          lat: fc.option(fc.oneof(
            fc.double({ min: -200, max: 200 }), // Out of valid range
            fc.constant(NaN),
            fc.constant(Infinity)
          ), { nil: undefined }),
          lng: fc.option(fc.oneof(
            fc.double({ min: -200, max: 200 }), // Out of valid range
            fc.constant(NaN),
            fc.constant(Infinity)
          ), { nil: undefined }),
          petrolPrice: fc.option(fc.oneof(
            fc.double({ min: -100, max: -1 }), // Negative prices
            fc.constant(NaN),
            fc.constant(Infinity)
          ), { nil: null }),
          dieselPrice: fc.option(fc.oneof(
            fc.double({ min: -100, max: -1 }), // Negative prices
            fc.constant(NaN),
            fc.constant(Infinity)
          ), { nil: null }),
          updatedAt: fc.option(fc.oneof(
            fc.constant('invalid-date'),
            fc.constant(''),
            fc.constant(null)
          ), { nil: undefined }),
        }),
        async (invalidData) => {
          // At least one field should be invalid or missing
          const hasInvalidField = 
            invalidData.stationId === undefined ||
            invalidData.brand === undefined ||
            invalidData.name === undefined ||
            invalidData.address === undefined ||
            invalidData.postcode === undefined ||
            invalidData.lat === undefined ||
            invalidData.lng === undefined ||
            invalidData.updatedAt === undefined ||
            (typeof invalidData.lat === 'number' && (isNaN(invalidData.lat) || !isFinite(invalidData.lat) || invalidData.lat < -90 || invalidData.lat > 90)) ||
            (typeof invalidData.lng === 'number' && (isNaN(invalidData.lng) || !isFinite(invalidData.lng) || invalidData.lng < -180 || invalidData.lng > 180)) ||
            (typeof invalidData.petrolPrice === 'number' && (isNaN(invalidData.petrolPrice) || !isFinite(invalidData.petrolPrice) || invalidData.petrolPrice < 0)) ||
            (typeof invalidData.dieselPrice === 'number' && (isNaN(invalidData.dieselPrice) || !isFinite(invalidData.dieselPrice) || invalidData.dieselPrice < 0));

          if (hasInvalidField) {
            // Schema validation should reject invalid data
            expect(() => fuelFinderStationSchema.parse(invalidData)).toThrow(z.ZodError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('valid station data should pass Zod schema validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid station data
        fc.record({
          stationId: fc.string({ minLength: 1 }),
          brand: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          address: fc.string({ minLength: 1 }),
          postcode: fc.string({ minLength: 1 }),
          lat: fc.double({ min: -90, max: 90, noNaN: true }),
          lng: fc.double({ min: -180, max: 180, noNaN: true }),
          petrolPrice: fc.option(fc.double({ min: 0, max: 500, noNaN: true }), { nil: null }),
          dieselPrice: fc.option(fc.double({ min: 0, max: 500, noNaN: true }), { nil: null }),
          updatedAt: fc.date(),
          amenities: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
          openingHours: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
        }),
        async (validData) => {
          // Schema validation should accept valid data
          const result = fuelFinderStationSchema.safeParse(validData);
          expect(result.success).toBe(true);
          
          if (result.success) {
            // Verify all required fields are present in parsed data
            expect(result.data.stationId).toBe(validData.stationId);
            expect(result.data.brand).toBe(validData.brand);
            expect(result.data.name).toBe(validData.name);
            expect(result.data.address).toBe(validData.address);
            expect(result.data.postcode).toBe(validData.postcode);
            expect(result.data.lat).toBe(validData.lat);
            expect(result.data.lng).toBe(validData.lng);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('missing required fields should be rejected', () => {
    // Test specific cases of missing required fields
    const testCases = [
      { brand: 'Shell', name: 'Station', address: '123 St', postcode: 'SW1A 1AA', lat: 51.5, lng: -0.1, updatedAt: new Date() }, // Missing stationId
      { stationId: '123', name: 'Station', address: '123 St', postcode: 'SW1A 1AA', lat: 51.5, lng: -0.1, updatedAt: new Date() }, // Missing brand
      { stationId: '123', brand: 'Shell', address: '123 St', postcode: 'SW1A 1AA', lat: 51.5, lng: -0.1, updatedAt: new Date() }, // Missing name
      { stationId: '123', brand: 'Shell', name: 'Station', postcode: 'SW1A 1AA', lat: 51.5, lng: -0.1, updatedAt: new Date() }, // Missing address
      { stationId: '123', brand: 'Shell', name: 'Station', address: '123 St', lat: 51.5, lng: -0.1, updatedAt: new Date() }, // Missing postcode
      { stationId: '123', brand: 'Shell', name: 'Station', address: '123 St', postcode: 'SW1A 1AA', lng: -0.1, updatedAt: new Date() }, // Missing lat
      { stationId: '123', brand: 'Shell', name: 'Station', address: '123 St', postcode: 'SW1A 1AA', lat: 51.5, updatedAt: new Date() }, // Missing lng
      { stationId: '123', brand: 'Shell', name: 'Station', address: '123 St', postcode: 'SW1A 1AA', lat: 51.5, lng: -0.1 }, // Missing updatedAt
    ];

    for (const testCase of testCases) {
      expect(() => fuelFinderStationSchema.parse(testCase)).toThrow(z.ZodError);
    }
  });

  test('invalid coordinate ranges should be rejected', () => {
    const baseStation = {
      stationId: '123',
      brand: 'Shell',
      name: 'Station',
      address: '123 St',
      postcode: 'SW1A 1AA',
      petrolPrice: null,
      dieselPrice: null,
      updatedAt: new Date(),
    };

    // Invalid latitude values
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: -91, lng: 0 })).toThrow(z.ZodError);
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: 91, lng: 0 })).toThrow(z.ZodError);
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: NaN, lng: 0 })).toThrow(z.ZodError);
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: Infinity, lng: 0 })).toThrow(z.ZodError);

    // Invalid longitude values
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: 0, lng: -181 })).toThrow(z.ZodError);
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: 0, lng: 181 })).toThrow(z.ZodError);
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: 0, lng: NaN })).toThrow(z.ZodError);
    expect(() => fuelFinderStationSchema.parse({ ...baseStation, lat: 0, lng: Infinity })).toThrow(z.ZodError);
  });

  test('valid coordinates should be accepted', () => {
    const baseStation = {
      stationId: '123',
      brand: 'Shell',
      name: 'Station',
      address: '123 St',
      postcode: 'SW1A 1AA',
      petrolPrice: null,
      dieselPrice: null,
      updatedAt: new Date(),
    };

    // Valid latitude/longitude combinations
    const validCoords = [
      { lat: 0, lng: 0 },
      { lat: 51.5074, lng: -0.1278 }, // London
      { lat: -90, lng: -180 }, // Boundaries
      { lat: 90, lng: 180 }, // Boundaries
      { lat: 55.9533, lng: -3.1883 }, // Edinburgh
    ];

    for (const coords of validCoords) {
      const result = fuelFinderStationSchema.safeParse({ ...baseStation, ...coords });
      expect(result.success).toBe(true);
    }
  });
});
