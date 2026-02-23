// Integration test for fuel sync cron endpoint
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { POST } from '../app/api/cron/fuel-sync/route';
import { NextRequest } from 'next/server';
import * as ingestionModule from '../lib/ingestion';

describe('Fuel Sync Endpoint Integration Tests', () => {
  const VALID_SECRET = 'test-cron-secret-12345';
  
  beforeEach(() => {
    process.env.CRON_SECRET = VALID_SECRET;
    vi.clearAllMocks();
  });

  test('should return 401 when x-cron-secret header is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  test('should return 401 when x-cron-secret header is incorrect', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'wrong-secret',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  test('should call runFuelSync and return 200 on success', async () => {
    const mockResult = {
      status: 'success' as const,
      stationsProcessed: 5,
      pricesUpdated: 5,
      errors: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    };

    const runFuelSyncSpy = vi.spyOn(ingestionModule, 'runFuelSync').mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(runFuelSyncSpy).toHaveBeenCalledTimes(1);
    expect(data.status).toBe('success');
    expect(data.stationsProcessed).toBe(5);
    expect(data.pricesUpdated).toBe(5);
  });

  test('should return 207 on partial success', async () => {
    const mockResult = {
      status: 'partial' as const,
      stationsProcessed: 3,
      pricesUpdated: 3,
      errors: ['Some error occurred'],
      startedAt: new Date(),
      finishedAt: new Date(),
    };

    vi.spyOn(ingestionModule, 'runFuelSync').mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(207);
    expect(data.status).toBe('partial');
    expect(data.errors).toHaveLength(1);
  });

  test('should return 500 on failure', async () => {
    const mockResult = {
      status: 'failed' as const,
      stationsProcessed: 0,
      pricesUpdated: 0,
      errors: ['Critical error'],
      startedAt: new Date(),
      finishedAt: new Date(),
    };

    vi.spyOn(ingestionModule, 'runFuelSync').mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe('failed');
  });

  test('should handle exceptions and return 500', async () => {
    vi.spyOn(ingestionModule, 'runFuelSync').mockRejectedValue(new Error('Unexpected error'));

    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
    expect(data.message).toBe('Unexpected error');
  });

  test('should return 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET;

    const request = new NextRequest('http://localhost:3000/api/cron/fuel-sync', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'any-secret',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
});
