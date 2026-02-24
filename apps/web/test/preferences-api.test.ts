// Tests for user preferences API endpoints
// Requirements: 3.2, 3.3
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GET as getPreferences, PUT as putPreferences } from '../app/api/preferences/route';
import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';

describe('Preferences API Endpoints', () => {
  const mockClerkUserId = 'clerk_test_user_123';
  const mockEmail = 'test@example.com';

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({ userId: mockClerkUserId } as any);
  });

  describe('GET /api/preferences', () => {
    test('should return 401 when user is not authenticated', async () => {
      // Mock unauthenticated request
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new NextRequest('http://localhost:3000/api/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('should return null preferences when user does not exist', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toBeNull();
    });

    test('should return null preferences when user exists but has no preferences', async () => {
      // Create user without preferences
      await prisma.user.create({
        data: {
          clerkUserId: mockClerkUserId,
          email: mockEmail,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toBeNull();
    });

    test('should return user preferences when they exist', async () => {
      // Create user with preferences
      const user = await prisma.user.create({
        data: {
          clerkUserId: mockClerkUserId,
          email: mockEmail,
          preferences: {
            create: {
              homePostcode: 'SW1A 1AA',
              defaultRadius: 10,
              defaultFuelType: 'diesel',
            },
          },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toEqual({
        homePostcode: 'SW1A 1AA',
        defaultRadius: 10,
        defaultFuelType: 'diesel',
      });
    });
  });

  describe('PUT /api/preferences', () => {
    test('should return 401 when user is not authenticated', async () => {
      // Mock unauthenticated request
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'SW1A 1AA',
          defaultRadius: 5,
          defaultFuelType: 'petrol',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('should return 400 for invalid preferences data', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'INVALID',
          defaultRadius: -5,
          defaultFuelType: 'kerosene',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid preferences data');
      expect(data.details).toBeDefined();
    });

    test('should create user and save preferences when user does not exist', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'SW1A 1AA',
          defaultRadius: 5,
          defaultFuelType: 'petrol',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toEqual({
        homePostcode: 'SW1A 1AA',
        defaultRadius: 5,
        defaultFuelType: 'petrol',
      });

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { clerkUserId: mockClerkUserId },
        include: { preferences: true },
      });

      expect(user).toBeDefined();
      expect(user?.preferences?.homePostcode).toBe('SW1A 1AA');
      expect(user?.preferences?.defaultRadius).toBe(5);
      expect(user?.preferences?.defaultFuelType).toBe('petrol');
    });

    test('should update preferences when user already exists', async () => {
      // Create user with initial preferences
      await prisma.user.create({
        data: {
          clerkUserId: mockClerkUserId,
          email: mockEmail,
          preferences: {
            create: {
              homePostcode: 'SW1A 1AA',
              defaultRadius: 5,
              defaultFuelType: 'petrol',
            },
          },
        },
      });

      // Update preferences
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'EC1A 1BB',
          defaultRadius: 15,
          defaultFuelType: 'diesel',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toEqual({
        homePostcode: 'EC1A 1BB',
        defaultRadius: 15,
        defaultFuelType: 'diesel',
      });

      // Verify preferences were updated
      const user = await prisma.user.findUnique({
        where: { clerkUserId: mockClerkUserId },
        include: { preferences: true },
      });

      expect(user?.preferences?.homePostcode).toBe('EC1A 1BB');
      expect(user?.preferences?.defaultRadius).toBe(15);
      expect(user?.preferences?.defaultFuelType).toBe('diesel');
    });

    test('should accept null homePostcode', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: null,
          defaultRadius: 5,
          defaultFuelType: 'petrol',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.homePostcode).toBeNull();
      expect(data.preferences.defaultRadius).toBe(5);
      expect(data.preferences.defaultFuelType).toBe('petrol');
    });

    test('should use default values when not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'SW1A 1AA',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.homePostcode).toBe('SW1A 1AA');
      expect(data.preferences.defaultRadius).toBe(5); // Default
      expect(data.preferences.defaultFuelType).toBe('petrol'); // Default
    });

    test('should validate postcode format', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: '12345',
          defaultRadius: 5,
          defaultFuelType: 'petrol',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid preferences data');
    });

    test('should validate radius range', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'SW1A 1AA',
          defaultRadius: 100,
          defaultFuelType: 'petrol',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid preferences data');
    });

    test('should validate fuel type enum', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          homePostcode: 'SW1A 1AA',
          defaultRadius: 5,
          defaultFuelType: 'electric',
        }),
      });

      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid preferences data');
    });
  });

  describe('Preferences Round-Trip', () => {
    test('should save and retrieve preferences correctly', async () => {
      const preferencesData = {
        homePostcode: 'SW1A 1AA',
        defaultRadius: 10,
        defaultFuelType: 'diesel' as const,
      };

      // Save preferences
      const putRequest = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferencesData),
      });

      const putResponse = await putPreferences(putRequest);
      expect(putResponse.status).toBe(200);

      // Retrieve preferences
      const getRequest = new NextRequest('http://localhost:3000/api/preferences');
      const getResponse = await getPreferences(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.preferences).toEqual(preferencesData);
    });
  });
});
