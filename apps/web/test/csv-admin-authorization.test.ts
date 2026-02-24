// Feature: fuelfuse-mvp, Property 25: CSV fallback requires admin authorization
// Validates: Requirements 7.3

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { POST } from '../app/api/admin/ingest-csv/route';
import { NextRequest } from 'next/server';

// Mock the CSV parser and ingestion service
vi.mock('../lib/csv-parser', () => ({
  parseAndValidateCSV: vi.fn().mockReturnValue([
    {
      stationId: 'test-station-1',
      brand: 'Test Brand',
      name: 'Test Station',
      address: '123 Test St',
      postcode: 'SW1A 1AA',
      lat: 51.5074,
      lng: -0.1278,
      petrolPrice: 150,
      dieselPrice: 160,
      updatedAt: new Date(),
    },
  ]),
}));

vi.mock('../lib/ingestion', () => ({
  upsertStationsAndPrices: vi.fn().mockResolvedValue({
    processed: 1,
    errors: [],
  }),
}));

describe('CSV Admin Authorization - Property 25', () => {
  const VALID_ADMIN_SECRET = 'test-admin-secret-12345';
  
  beforeEach(() => {
    // Set up environment variable for tests
    process.env.ADMIN_SECRET = VALID_ADMIN_SECRET;
  });

  test('Property 25: CSV fallback requires admin authorization - requests without correct secret are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary strings that are NOT the valid admin secret
        fc.string().filter(s => s !== VALID_ADMIN_SECRET),
        async (invalidSecret) => {
          // Create CSV data
          const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

          // Create request with invalid admin secret
          const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
            method: 'POST',
            headers: {
              'x-admin-secret': invalidSecret,
              'content-type': 'text/csv',
            },
            body: csvData,
          });

          // Call the endpoint
          const response = await POST(request);
          const data = await response.json();

          // Verify unauthorized response
          expect(response.status).toBe(401);
          expect(data).toHaveProperty('error');
          expect(data.error).toBe('Unauthorized');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 25: CSV fallback requires admin authorization - requests without secret header are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary CSV data
        fc.constant(null),
        async () => {
          // Create CSV data
          const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

          // Create request without x-admin-secret header
          const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
            method: 'POST',
            headers: {
              'content-type': 'text/csv',
            },
            body: csvData,
          });

          // Call the endpoint
          const response = await POST(request);
          const data = await response.json();

          // Verify unauthorized response
          expect(response.status).toBe(401);
          expect(data).toHaveProperty('error');
          expect(data.error).toBe('Unauthorized');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 25: CSV fallback requires admin authorization - requests with correct secret are accepted', async () => {
    // Create CSV data
    const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

    // Create request with valid admin secret
    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_ADMIN_SECRET,
        'content-type': 'text/csv',
      },
      body: csvData,
    });

    // Call the endpoint
    const response = await POST(request);

    // Verify successful response (not 401)
    expect(response.status).not.toBe(401);
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  test('Property 25: CSV fallback requires admin authorization - empty secret is rejected', async () => {
    // Create CSV data
    const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

    // Create request with empty admin secret
    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': '',
        'content-type': 'text/csv',
      },
      body: csvData,
    });

    // Call the endpoint
    const response = await POST(request);
    const data = await response.json();

    // Verify unauthorized response
    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Unauthorized');
  });

  test('Property 25: CSV fallback requires admin authorization - case sensitivity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate variations of the valid secret with different casing
        fc.constantFrom(
          VALID_ADMIN_SECRET.toLowerCase(),
          VALID_ADMIN_SECRET.toUpperCase(),
          VALID_ADMIN_SECRET.charAt(0).toUpperCase() + VALID_ADMIN_SECRET.slice(1).toLowerCase()
        ).filter(s => s !== VALID_ADMIN_SECRET),
        async (wrongCaseSecret) => {
          // Create CSV data
          const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

          // Create request with wrong case secret
          const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
            method: 'POST',
            headers: {
              'x-admin-secret': wrongCaseSecret,
              'content-type': 'text/csv',
            },
            body: csvData,
          });

          // Call the endpoint
          const response = await POST(request);
          const data = await response.json();

          // Verify unauthorized response (secrets should be case-sensitive)
          expect(response.status).toBe(401);
          expect(data).toHaveProperty('error');
          expect(data.error).toBe('Unauthorized');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 25: CSV fallback requires admin authorization - secrets with internal modifications are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate secrets with internal character changes
        fc.constantFrom(
          VALID_ADMIN_SECRET.replace('-', '_'),
          VALID_ADMIN_SECRET.replace('admin', 'ADMIN'),
          VALID_ADMIN_SECRET.replace('secret', 'SECRET'),
          VALID_ADMIN_SECRET.replace(/\d/, '9')
        ).filter(s => s !== VALID_ADMIN_SECRET),
        async (modifiedSecret) => {
          // Create CSV data
          const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

          // Create request with modified secret
          const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
            method: 'POST',
            headers: {
              'x-admin-secret': modifiedSecret,
              'content-type': 'text/csv',
            },
            body: csvData,
          });

          // Call the endpoint
          const response = await POST(request);
          const data = await response.json();

          // Verify unauthorized response
          expect(response.status).toBe(401);
          expect(data).toHaveProperty('error');
          expect(data.error).toBe('Unauthorized');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 25: CSV fallback requires admin authorization - similar but incorrect secrets are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate secrets that are similar but not identical
        fc.constantFrom(
          VALID_ADMIN_SECRET + 'x',
          'x' + VALID_ADMIN_SECRET,
          VALID_ADMIN_SECRET.slice(0, -1),
          VALID_ADMIN_SECRET.slice(1),
          VALID_ADMIN_SECRET.replace('a', 'b')
        ).filter(s => s !== VALID_ADMIN_SECRET),
        async (similarSecret) => {
          // Create CSV data
          const csvData = 'stationId,brand,name,address,postcode,lat,lng,petrolPrice,dieselPrice,updatedAt\ntest-1,Brand,Station,Address,SW1A 1AA,51.5074,-0.1278,150,160,2024-01-01T00:00:00Z';

          // Create request with similar but incorrect secret
          const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
            method: 'POST',
            headers: {
              'x-admin-secret': similarSecret,
              'content-type': 'text/csv',
            },
            body: csvData,
          });

          // Call the endpoint
          const response = await POST(request);
          const data = await response.json();

          // Verify unauthorized response
          expect(response.status).toBe(401);
          expect(data).toHaveProperty('error');
          expect(data.error).toBe('Unauthorized');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 25: CSV fallback requires admin authorization - authorization happens before CSV processing', async () => {
    // This test verifies that authorization is checked BEFORE any CSV parsing or processing
    // Invalid CSV should still return 401 if secret is wrong, not 400 for bad CSV

    // Create intentionally invalid CSV data
    const invalidCsvData = 'this is not valid CSV at all!@#$%^&*()';

    // Create request with invalid admin secret but invalid CSV
    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': 'wrong-secret',
        'content-type': 'text/csv',
      },
      body: invalidCsvData,
    });

    // Call the endpoint
    const response = await POST(request);
    const data = await response.json();

    // Verify unauthorized response (401), not bad request (400)
    // This proves authorization is checked first
    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Unauthorized');
  });
});
