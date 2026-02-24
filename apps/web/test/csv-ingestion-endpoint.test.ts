// Test CSV ingestion endpoint
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/ingest-csv/route';
import { prisma } from '@/lib/prisma';

const VALID_SECRET = 'test-admin-secret-123';

describe('CSV Ingestion Endpoint', () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = VALID_SECRET;
    vi.clearAllMocks();
  });

  test('Requirement 7.3: CSV endpoint requires admin authentication', async () => {
    // Create request without admin secret
    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      body: 'station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at\n',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('Requirement 7.3: CSV endpoint accepts valid admin secret', async () => {
    const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
TEST001,Test Station,TestBrand,123 Test St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z`;

    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: csvData,
    });

    const response = await POST(request);
    expect(response.status).toBeLessThanOrEqual(207); // 200 or 207 (partial success)
  });

  test('Requirement 7.2: CSV endpoint rejects empty CSV data', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: '',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('CSV data is required in request body');
  });

  test('Requirement 7.2: CSV endpoint rejects invalid CSV format', async () => {
    const invalidCsv = 'invalid,csv,data\n1,2'; // Wrong number of fields

    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: invalidCsv,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('CSV validation failed');
  });

  test('Requirement 7.2: CSV endpoint ingests valid station data', async () => {
    const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
CSV001,CSV Test Station,CSVBrand,456 CSV Ave,W1A 0AX,51.5074,-0.1278,148.5,155.2,2024-01-15T12:00:00Z`;

    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: csvData,
    });

    const response = await POST(request);
    expect(response.status).toBeLessThanOrEqual(207);

    const data = await response.json();
    expect(data.stationsProcessed).toBeGreaterThan(0);
    expect(data.status).toMatch(/success|partial/);

    // Verify station was created in database
    const station = await prisma.station.findUnique({
      where: { stationId: 'CSV001' },
      include: { latestPrice: true },
    });

    expect(station).toBeTruthy();
    expect(station?.name).toBe('CSV Test Station');
    expect(station?.brand).toBe('CSVBrand');
    expect(station?.latestPrice?.petrolPpl).toBe(149); // Rounded from 148.5
    expect(station?.latestPrice?.dieselPpl).toBe(155); // Rounded from 155.2
  });

  test('Requirement 7.2: CSV endpoint uses same upsert logic as API ingestion', async () => {
    // First ingestion
    const csvData1 = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
UPSERT001,Original Name,OriginalBrand,789 Original St,EC1A 1BB,51.5074,-0.1278,150.0,157.0,2024-01-15T10:00:00Z`;

    const request1 = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: csvData1,
    });

    await POST(request1);

    // Second ingestion with updated data
    const csvData2 = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
UPSERT001,Updated Name,UpdatedBrand,789 Updated St,EC1A 1BB,51.5074,-0.1278,145.0,152.0,2024-01-15T14:00:00Z`;

    const request2 = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: csvData2,
    });

    const response2 = await POST(request2);
    expect(response2.status).toBeLessThanOrEqual(207);

    // Verify station was updated, not duplicated
    const stations = await prisma.station.findMany({
      where: { stationId: 'UPSERT001' },
      include: { latestPrice: true },
    });

    expect(stations.length).toBe(1);
    expect(stations[0].name).toBe('Updated Name');
    expect(stations[0].brand).toBe('UpdatedBrand');
    expect(stations[0].latestPrice?.petrolPpl).toBe(145);
  });

  test('Requirement 7.2: CSV endpoint records ingestion run metadata', async () => {
    const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
META001,Metadata Test,MetaBrand,123 Meta St,N1 9GU,51.5074,-0.1278,149.0,156.0,2024-01-15T15:00:00Z`;

    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: csvData,
    });

    const beforeCount = await prisma.ingestionRun.count();
    await POST(request);
    const afterCount = await prisma.ingestionRun.count();

    expect(afterCount).toBe(beforeCount + 1);

    // Verify the ingestion run has correct metadata
    const latestRun = await prisma.ingestionRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    expect(latestRun).toBeTruthy();
    expect(latestRun?.status).toMatch(/success|partial|failed/);
    expect(latestRun?.counts).toHaveProperty('stationsProcessed');
    expect(latestRun?.counts).toHaveProperty('pricesUpdated');
  });

  test('CSV endpoint handles multiple stations in one request', async () => {
    const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
MULTI001,Station One,Brand1,111 First St,E1 6AN,51.5074,-0.1278,148.0,155.0,2024-01-15T10:00:00Z
MULTI002,Station Two,Brand2,222 Second St,E2 7BB,51.5074,-0.1278,149.0,156.0,2024-01-15T10:00:00Z
MULTI003,Station Three,Brand3,333 Third St,E3 8CC,51.5074,-0.1278,150.0,157.0,2024-01-15T10:00:00Z`;

    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': VALID_SECRET,
      },
      body: csvData,
    });

    const response = await POST(request);
    expect(response.status).toBeLessThanOrEqual(207);

    const data = await response.json();
    expect(data.stationsProcessed).toBe(3);

    // Verify all stations were created
    const station1 = await prisma.station.findUnique({ where: { stationId: 'MULTI001' } });
    const station2 = await prisma.station.findUnique({ where: { stationId: 'MULTI002' } });
    const station3 = await prisma.station.findUnique({ where: { stationId: 'MULTI003' } });

    expect(station1).toBeTruthy();
    expect(station2).toBeTruthy();
    expect(station3).toBeTruthy();
  });

  test('CSV endpoint returns 401 when ADMIN_SECRET env var is not set', async () => {
    delete process.env.ADMIN_SECRET;

    const csvData = `station_id,name,brand,address,postcode,lat,lng,petrol_price,diesel_price,updated_at
TEST001,Test Station,TestBrand,123 Test St,SW1A 1AA,51.5074,-0.1278,145.9,152.3,2024-01-15T10:00:00Z`;

    const request = new NextRequest('http://localhost:3000/api/admin/ingest-csv', {
      method: 'POST',
      headers: {
        'x-admin-secret': 'any-secret',
      },
      body: csvData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
