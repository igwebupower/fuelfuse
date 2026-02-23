// Feature: fuelfuse-mvp, Property 23: Cron endpoints require authentication
// Validates: Requirements 6.11, 8.5

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { POST } from '../app/api/cron/fuel-sync/route';
import { NextRequest } from 'next/server';

// Mock the ingestion service
vi.mock('../lib/ingestion', () => ({
  runFuelSync: vi.fn().mockResolvedValue({
    status: 'success',
    stationsProcessed: 10,
    pricesUpdated: 10,
    errors: [],
    startedAt: new Date(),
    finishedAt: new Date(),
  }),
}));

describe('Cron Authentication Property Tests', () => {
  const VALID_SECRET = 'test-cron-secret-12345';
  
  beforeEach(() => {
    // Set up environment variable for tests
    process.env.CRON_SECRET = VALID_SECRET;
  });

  test('Property 23: Cron endpoints require authentication - requests without correct secret are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary strings that are NOT the valid secret
        fc.string().filter(s => s !== VALID_SECRET),
        async (invalidSecret) => {
          // Create request with invalid secret
          const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
            method: 'POST',
            headers: {
              'x-cron-secret': invalidSecret,
            },
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

  test('Property 23: Cron endpoints require authentication - requests without secret header are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary request bodies
        fc.constant(null),
        async () => {
          // Create request without x-cron-secret header
          const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
            method: 'POST',
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

  test('Property 23: Cron endpoints require authentication - requests with correct secret are accepted', async () => {
    // Create request with valid secret
    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    // Call the endpoint
    const response = await POST(request);

    // Verify successful response (not 401)
    expect(response.status).not.toBe(401);
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  test('Property 23: Cron endpoints require authentication - empty secret is rejected', async () => {
    // Create request with empty secret
    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': '',
      },
    });

    // Call the endpoint
    const response = await POST(request);
    const data = await response.json();

    // Verify unauthorized response
    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Unauthorized');
  });

  test('Property 23: Cron endpoints require authentication - case sensitivity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate variations of the valid secret with different casing
        fc.constantFrom(
          VALID_SECRET.toLowerCase(),
          VALID_SECRET.toUpperCase(),
          VALID_SECRET.charAt(0).toUpperCase() + VALID_SECRET.slice(1).toLowerCase()
        ).filter(s => s !== VALID_SECRET),
        async (wrongCaseSecret) => {
          // Create request with wrong case secret
          const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
            method: 'POST',
            headers: {
              'x-cron-secret': wrongCaseSecret,
            },
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
});
