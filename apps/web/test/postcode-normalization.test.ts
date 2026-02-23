// Feature: fuelfuse-mvp, Property 3: Postcode normalization is consistent
// Validates: Requirements 1.5, 14.1

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizePostcode } from '../lib/geocoding';

describe('Postcode Normalization - Property 3: Postcode normalization is consistent', () => {
  test('normalizing the same postcode with different case and spacing should produce the same result', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid UK postcode components
        fc.record({
          // Outward code: 1-2 letters, 1-2 digits, optional letter
          area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
        }),
        async (components) => {
          // Build a valid postcode
          const outward = `${components.area}${components.district}`;
          const inward = `${components.sector}${components.unit}`;
          const basePostcode = `${outward}${inward}`;
          
          // Generate variations with different case and spacing
          const variations = [
            basePostcode.toLowerCase(), // all lowercase
            basePostcode.toUpperCase(), // all uppercase
            `${outward} ${inward}`.toLowerCase(), // lowercase with space
            `${outward} ${inward}`.toUpperCase(), // uppercase with space
            `${outward}  ${inward}`, // multiple spaces
            ` ${outward} ${inward} `, // leading/trailing spaces
            `${outward}   ${inward}`, // many spaces
          ];
          
          // Normalize all variations
          const normalized = variations.map(v => normalizePostcode(v));
          
          // All normalized versions should be identical
          const firstNormalized = normalized[0];
          for (const norm of normalized) {
            expect(norm).toBe(firstNormalized);
          }
          
          // The normalized version should be uppercase
          expect(firstNormalized).toBe(firstNormalized.toUpperCase());
          
          // The normalized version should have exactly one space
          const spaceCount = (firstNormalized.match(/ /g) || []).length;
          expect(spaceCount).toBe(1);
          
          // The space should be before the last 3 characters (inward code)
          expect(firstNormalized).toMatch(/^[A-Z0-9]+ [0-9][A-Z]{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('normalizing already normalized postcodes should be idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          area: fc.constantFrom('SW', 'E', 'EC', 'W', 'N', 'SE', 'NW', 'CR', 'BR', 'RM'),
          district: fc.integer({ min: 1, max: 99 }),
          sector: fc.integer({ min: 0, max: 9 }),
          unit: fc.constantFrom('AA', 'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AL', 'AM'),
        }),
        async (components) => {
          const outward = `${components.area}${components.district}`;
          const inward = `${components.sector}${components.unit}`;
          const postcode = `${outward}${inward}`;
          
          // Normalize once
          const normalized1 = normalizePostcode(postcode);
          
          // Normalize again
          const normalized2 = normalizePostcode(normalized1);
          
          // Should be identical (idempotent)
          expect(normalized1).toBe(normalized2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('specific known postcode examples normalize correctly', () => {
    // Test specific examples to ensure correctness
    expect(normalizePostcode('sw1a1aa')).toBe('SW1A 1AA');
    expect(normalizePostcode('SW1A1AA')).toBe('SW1A 1AA');
    expect(normalizePostcode('sw1a 1aa')).toBe('SW1A 1AA');
    expect(normalizePostcode('SW1A 1AA')).toBe('SW1A 1AA');
    expect(normalizePostcode('  sw1a  1aa  ')).toBe('SW1A 1AA');
    expect(normalizePostcode('e17bh')).toBe('E1 7BH');
    expect(normalizePostcode('E1 7BH')).toBe('E1 7BH');
    expect(normalizePostcode('ec1a1bb')).toBe('EC1A 1BB');
    expect(normalizePostcode('EC1A 1BB')).toBe('EC1A 1BB');
    expect(normalizePostcode('w1a0ax')).toBe('W1A 0AX');
    expect(normalizePostcode('W1A 0AX')).toBe('W1A 0AX');
  });
});
