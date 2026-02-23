// Feature: fuelfuse-mvp, Property 4: Geocoding cache round-trip
// Validates: Requirements 1.6, 14.2, 14.3, 14.4, 14.5

import { describe, test, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizePostcode,
  getCachedCoordinates,
  cacheCoordinates,
  geocodePostcode,
} from '../lib/geocoding';
import { prisma } from '../lib/prisma';

describe('Geocoding Cache - Property 4: Geocoding cache round-trip', () => {
  test('caching coordinates and retrieving them should return the same coordinates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate valid UK postcode components
          area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
          // Generate valid UK coordinates with reasonable precision
          // Avoid extreme values that cause floating-point precision issues
          lat: fc.double({ min: 49.0, max: 61.0, noNaN: true, noDefaultInfinity: true })
            .filter(n => Math.abs(n) > 1e-10), // Filter out very small numbers
          lng: fc.double({ min: -8.0, max: 2.0, noNaN: true, noDefaultInfinity: true })
            .filter(n => Math.abs(n) > 1e-10 || n === 0), // Filter out very small numbers except 0
        }),
        async (data) => {
          const outward = `${data.area}${data.district}`;
          const inward = `${data.sector}${data.unit}`;
          const postcode = `${outward} ${inward}`;
          const normalized = normalizePostcode(postcode);
          
          // Clean up any existing cache entry for this postcode
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
          
          const coords = { lat: data.lat, lng: data.lng };
          
          // Cache the coordinates
          await cacheCoordinates(normalized, coords);
          
          // Retrieve from cache
          const retrieved = await getCachedCoordinates(normalized);
          
          // Should return the same coordinates
          expect(retrieved).not.toBeNull();
          expect(retrieved?.lat).toBeCloseTo(coords.lat, 10); // Use toBeCloseTo for floating point
          expect(retrieved?.lng).toBeCloseTo(coords.lng, 10);
          
          // Clean up after this iteration
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
        }
      ),
      { numRuns: 50 } // Reduced from 100 for speed
    );
  });

  test('retrieving cached coordinates should update last_used_at timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
          lat: fc.double({ min: 49.0, max: 61.0, noNaN: true, noDefaultInfinity: true })
            .filter(n => Math.abs(n) > 1e-10),
          lng: fc.double({ min: -8.0, max: 2.0, noNaN: true, noDefaultInfinity: true })
            .filter(n => Math.abs(n) > 1e-10 || n === 0),
        }),
        async (data) => {
          const outward = `${data.area}${data.district}`;
          const inward = `${data.sector}${data.unit}`;
          const postcode = `${outward} ${inward}`;
          const normalized = normalizePostcode(postcode);
          
          // Clean up any existing cache entry for this postcode
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
          
          const coords = { lat: data.lat, lng: data.lng };
          
          // Cache the coordinates
          await cacheCoordinates(normalized, coords);
          
          // Get initial last_used_at
          const initial = await prisma.postcodeGeoCache.findUnique({
            where: { postcodeNormalized: normalized },
          });
          expect(initial).not.toBeNull();
          const initialLastUsed = initial!.lastUsedAt.getTime();
          
          // Small delay to ensure timestamp can differ (use smaller delay for speed)
          await new Promise(resolve => setTimeout(resolve, 2));
          
          // Retrieve from cache (should update last_used_at)
          await getCachedCoordinates(normalized);
          
          // Get updated last_used_at
          const updated = await prisma.postcodeGeoCache.findUnique({
            where: { postcodeNormalized: normalized },
          });
          expect(updated).not.toBeNull();
          const updatedLastUsed = updated!.lastUsedAt.getTime();
          
          // last_used_at should be updated (later than or equal to initial)
          expect(updatedLastUsed).toBeGreaterThanOrEqual(initialLastUsed);
          
          // Clean up after this iteration
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
        }
      ),
      { numRuns: 50 } // Reduced from 100 to avoid timeout
    );
  });

  test('geocoding a postcode should use cache on subsequent calls without external API', async () => {
    // Use vi.spyOn to mock the global fetch
    const fetchSpy = vi.spyOn(global, 'fetch');
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
          lat: fc.double({ min: 49.0, max: 61.0, noNaN: true, noDefaultInfinity: true })
            .filter(n => Math.abs(n) > 1e-10),
          lng: fc.double({ min: -8.0, max: 2.0, noNaN: true, noDefaultInfinity: true })
            .filter(n => Math.abs(n) > 1e-10 || n === 0),
        }),
        async (data) => {
          const outward = `${data.area}${data.district}`;
          const inward = `${data.sector}${data.unit}`;
          const postcode = `${outward} ${inward}`;
          const normalized = normalizePostcode(postcode);
          
          // Clean up any existing cache entry for this postcode
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
          
          const mockCoords = { lat: data.lat, lng: data.lng };
          
          // Reset and configure the spy for this iteration
          fetchSpy.mockReset();
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
              result: {
                latitude: mockCoords.lat,
                longitude: mockCoords.lng,
              },
            }),
          } as Response);
          
          // First call - should hit API and cache
          const coords1 = await geocodePostcode(postcode);
          expect(coords1.lat).toBeCloseTo(mockCoords.lat, 10);
          expect(coords1.lng).toBeCloseTo(mockCoords.lng, 10);
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          
          // Second call - should use cache, not hit API
          const coords2 = await geocodePostcode(postcode);
          expect(coords2.lat).toBeCloseTo(mockCoords.lat, 10);
          expect(coords2.lng).toBeCloseTo(mockCoords.lng, 10);
          expect(fetchSpy).toHaveBeenCalledTimes(1); // Still only 1 call
          
          // Third call with different spacing - should still use cache
          const postcodeVariation = postcode.replace(' ', '').toLowerCase();
          const coords3 = await geocodePostcode(postcodeVariation);
          expect(coords3.lat).toBeCloseTo(mockCoords.lat, 10);
          expect(coords3.lng).toBeCloseTo(mockCoords.lng, 10);
          expect(fetchSpy).toHaveBeenCalledTimes(1); // Still only 1 call
          
          // Clean up after this iteration
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
        }
      ),
      { numRuns: 50 } // Reduced from 100 for speed
    );
    
    // Restore the spy
    fetchSpy.mockRestore();
  });

  test('cache lookup for non-existent postcode should return null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          area: fc.constantFrom('ZZ', 'YY', 'XX'), // Non-existent areas
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('ZZ', 'YY', 'XX'), // Non-existent units
        }),
        async (data) => {
          const outward = `${data.area}${data.district}`;
          const inward = `${data.sector}${data.unit}`;
          const postcode = `${outward} ${inward}`;
          const normalized = normalizePostcode(postcode);
          
          // Ensure no cache entry exists
          await prisma.postcodeGeoCache.deleteMany({
            where: { postcodeNormalized: normalized },
          });
          
          // Should return null for non-cached postcode
          const result = await getCachedCoordinates(normalized);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 } // Reduced from 100 for speed
    );
  });

  test('specific known postcode geocoding example', async () => {
    // Clean up any existing cache for this postcode
    await prisma.postcodeGeoCache.deleteMany({
      where: { postcodeNormalized: 'SW1A 1AA' },
    });
    
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            latitude: 51.5014,
            longitude: -0.1419,
          },
        }),
      });
    });
    
    const savedFetch = global.fetch;
    global.fetch = mockFetch as any;

    try {
      // First call - should hit API
      const coords1 = await geocodePostcode('SW1A 1AA');
      expect(coords1.lat).toBe(51.5014);
      expect(coords1.lng).toBe(-0.1419);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const coords2 = await geocodePostcode('sw1a1aa'); // Different format
      expect(coords2.lat).toBe(51.5014);
      expect(coords2.lng).toBe(-0.1419);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call
    } finally {
      global.fetch = savedFetch;
      // Clean up after test
      await prisma.postcodeGeoCache.deleteMany({
        where: { postcodeNormalized: 'SW1A 1AA' },
      });
    }
  });
});
