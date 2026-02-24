// Tests for search API endpoints
// Requirements: 1.1, 1.2, 2.1, 8.2
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GET as searchCheapest } from '../app/api/search/cheapest/route';
import { GET as getStationDetail } from '../app/api/stations/[stationId]/route';
import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

describe('Search API Endpoints', () => {
  beforeEach(async () => {
    // Create test stations with prices
    await prisma.station.create({
      data: {
        stationId: 'TEST001',
        brand: 'Shell',
        name: 'Shell Station',
        address: '123 Test St',
        postcode: 'SW1A 1AA',
        lat: 51.5074,
        lng: -0.1278,
        updatedAtSource: new Date(),
        latestPrice: {
          create: {
            petrolPpl: 145,
            dieselPpl: 155,
            updatedAtSource: new Date(),
          },
        },
      },
    });

    await prisma.station.create({
      data: {
        stationId: 'TEST002',
        brand: 'BP',
        name: 'BP Station',
        address: '456 Test Ave',
        postcode: 'SW1A 2AA',
        lat: 51.5084,
        lng: -0.1288,
        updatedAtSource: new Date(),
        latestPrice: {
          create: {
            petrolPpl: 140,
            dieselPpl: 150,
            updatedAtSource: new Date(),
          },
        },
      },
    });
  });

  describe('GET /api/search/cheapest', () => {
    test('should return stations sorted by price when searching by coordinates', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?lat=51.5074&lng=-0.1278&radiusMiles=5&fuelType=petrol'
      );

      const response = await searchCheapest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results.length).toBeGreaterThan(0);

      // Verify results are sorted by price
      for (let i = 1; i < data.results.length; i++) {
        expect(data.results[i].pricePerLitre).toBeGreaterThanOrEqual(
          data.results[i - 1].pricePerLitre
        );
      }

      // Verify all results have required fields
      data.results.forEach((station: any) => {
        expect(station.stationId).toBeDefined();
        expect(station.brand).toBeDefined();
        expect(station.name).toBeDefined();
        expect(station.address).toBeDefined();
        expect(station.postcode).toBeDefined();
        expect(station.pricePerLitre).toBeDefined();
        expect(station.distanceMiles).toBeDefined();
        expect(station.lastUpdated).toBeDefined();
      });
    });

    test('should return 400 for invalid coordinates', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?lat=invalid&lng=-0.1278&radiusMiles=5&fuelType=petrol'
      );

      const response = await searchCheapest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('should return 400 for missing fuel type', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?lat=51.5074&lng=-0.1278&radiusMiles=5'
      );

      const response = await searchCheapest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('should return 400 for invalid radius', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?lat=51.5074&lng=-0.1278&radiusMiles=100&fuelType=petrol'
      );

      const response = await searchCheapest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('should return 400 when neither postcode nor coordinates provided', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?radiusMiles=5&fuelType=petrol'
      );

      const response = await searchCheapest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('should include rate limit headers in response', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?lat=51.5074&lng=-0.1278&radiusMiles=5&fuelType=petrol'
      );

      const response = await searchCheapest(request);

      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    test('should filter results by fuel type', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/search/cheapest?lat=51.5074&lng=-0.1278&radiusMiles=5&fuelType=diesel'
      );

      const response = await searchCheapest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toBeDefined();
      
      // Verify diesel prices are returned
      data.results.forEach((station: any) => {
        expect(station.pricePerLitre).toBeGreaterThan(0);
      });
    });
  });

  describe('GET /api/stations/:stationId', () => {
    test('should return station detail for valid station ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/stations/TEST001'
      );

      const response = await getStationDetail(request, { params: { stationId: 'TEST001' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stationId).toBe('TEST001');
      expect(data.brand).toBe('Shell');
      expect(data.name).toBe('Shell Station');
      expect(data.address).toBe('123 Test St');
      expect(data.postcode).toBe('SW1A 1AA');
      expect(data.lat).toBe(51.5074);
      expect(data.lng).toBe(-0.1278);
      expect(data.petrolPrice).toBe(145);
      expect(data.dieselPrice).toBe(155);
      expect(data.lastUpdated).toBeDefined();
      
      // Amenities and opening hours can be null
      expect(data).toHaveProperty('amenities');
      expect(data).toHaveProperty('openingHours');
    });

    test('should return 404 for non-existent station', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/stations/NONEXISTENT'
      );

      const response = await getStationDetail(request, { params: { stationId: 'NONEXISTENT' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeDefined();
    });

    test('should return 400 for empty station ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/stations/'
      );

      const response = await getStationDetail(request, { params: { stationId: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('should include rate limit headers in response', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/stations/TEST001'
      );

      const response = await getStationDetail(request, { params: { stationId: 'TEST001' } });

      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    test('should handle station with null amenities and opening hours', async () => {
      // Create station without amenities/opening hours
      await prisma.station.create({
        data: {
          stationId: 'TEST003',
          brand: 'Tesco',
          name: 'Tesco Station',
          address: '789 Test Rd',
          postcode: 'SW1A 3AA',
          lat: 51.5094,
          lng: -0.1298,
          updatedAtSource: new Date(),
          amenities: null,
          openingHours: null,
          latestPrice: {
            create: {
              petrolPpl: 142,
              dieselPpl: 152,
              updatedAtSource: new Date(),
            },
          },
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/stations/TEST003'
      );

      const response = await getStationDetail(request, { params: { stationId: 'TEST003' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.amenities).toBeNull();
      expect(data.openingHours).toBeNull();
    });
  });
});
