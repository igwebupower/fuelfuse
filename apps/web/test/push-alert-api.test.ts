// Tests for push and alert API endpoints
// Requirements: 4.1, 4.2

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST as pushRegisterPOST } from '../app/api/push/register/route';
import { POST as alertsPOST, GET as alertsGET } from '../app/api/alerts/route';
import { PUT as alertPUT, DELETE as alertDELETE } from '../app/api/alerts/[id]/route';
import { createUser } from '../lib/user';
import { prisma } from '../lib/prisma';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Import auth after mocking
import { auth } from '@clerk/nextjs/server';

describe('Push and Alert API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/push/register', () => {
    test('registers push token for authenticated user', async () => {
      // Create test user
      const clerkUserId = 'user_test_push_1';
      const email = 'push1@example.com';
      const user = await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: 'ExponentPushToken[test123]',
          platform: 'ios',
        }),
      });

      // Call endpoint
      const response = await pushRegisterPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify token was stored in database
      const pushToken = await prisma.pushToken.findUnique({
        where: { expoPushToken: 'ExponentPushToken[test123]' },
      });
      expect(pushToken).toBeDefined();
      expect(pushToken?.userId).toBe(user.id);
      expect(pushToken?.platform).toBe('ios');
    });

    test('returns 401 for unauthenticated request', async () => {
      // Mock Clerk auth to return no user
      (auth as any).mockResolvedValue({ userId: null });

      // Create request
      const request = new Request('http://localhost:3000/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: 'ExponentPushToken[test456]',
          platform: 'android',
        }),
      });

      // Call endpoint
      const response = await pushRegisterPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 for invalid request body', async () => {
      // Create test user
      const clerkUserId = 'user_test_push_invalid';
      const email = 'pushinvalid@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request with invalid platform
      const request = new Request('http://localhost:3000/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: 'ExponentPushToken[test789]',
          platform: 'windows', // Invalid platform
        }),
      });

      // Call endpoint
      const response = await pushRegisterPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    test('creates user if not exists', async () => {
      // Use a new Clerk user ID that doesn't exist in database
      const clerkUserId = 'user_test_new_push';

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expoPushToken: 'ExponentPushToken[newuser]',
          platform: 'ios',
        }),
      });

      // Call endpoint
      const response = await pushRegisterPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
      });
      expect(user).toBeDefined();
    });
  });


  describe('POST /api/alerts', () => {
    test('creates alert rule for authenticated Pro user', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_alert_create_1';
      const email = 'alertcreate1@example.com';
      const user = await createUser(clerkUserId, email);

      // Create Pro subscription
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_alert_1',
          stripeSubscriptionId: 'sub_test_alert_1',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        }),
      });

      // Call endpoint
      const response = await alertsPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(201);
      expect(data.alertRule).toBeDefined();
      expect(data.alertRule.userId).toBe(user.id);
      expect(data.alertRule.centerPostcode).toBe('SW1A 1AA');
      expect(data.alertRule.radiusMiles).toBe(10);
      expect(data.alertRule.fuelType).toBe('petrol');
      expect(data.alertRule.thresholdPpl).toBe(5);
      expect(data.alertRule.enabled).toBe(true);
    });

    test('returns 403 for Free tier user', async () => {
      // Create test user without Pro subscription
      const clerkUserId = 'user_test_alert_free';
      const email = 'alertfree@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
        }),
      });

      // Call endpoint
      const response = await alertsPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(403);
      expect(data.error).toContain('Pro feature');
    });

    test('returns 401 for unauthenticated request', async () => {
      // Mock Clerk auth to return no user
      (auth as any).mockResolvedValue({ userId: null });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
        }),
      });

      // Call endpoint
      const response = await alertsPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });


    test('returns 400 for invalid request body', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_alert_invalid';
      const email = 'alertinvalid@example.com';
      const user = await createUser(clerkUserId, email);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_alert_invalid',
          stripeSubscriptionId: 'sub_test_alert_invalid',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request with invalid fuel type
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'electric', // Invalid fuel type
        }),
      });

      // Call endpoint
      const response = await alertsPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    test('creates alert rule with lat/lng coordinates', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_alert_coords';
      const email = 'alertcoords@example.com';
      const user = await createUser(clerkUserId, email);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_alert_coords',
          stripeSubscriptionId: 'sub_test_alert_coords',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request with coordinates
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: 51.5074,
          lng: -0.1278,
          radiusMiles: 15,
          fuelType: 'diesel',
          thresholdPpl: 3,
        }),
      });

      // Call endpoint
      const response = await alertsPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(201);
      expect(data.alertRule.lat).toBe(51.5074);
      expect(data.alertRule.lng).toBe(-0.1278);
      expect(data.alertRule.radiusMiles).toBe(15);
      expect(data.alertRule.fuelType).toBe('diesel');
    });
  });


  describe('GET /api/alerts', () => {
    test('returns alert rules for authenticated user', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_alert_get';
      const email = 'alertget@example.com';
      const user = await createUser(clerkUserId, email);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_alert_get',
          stripeSubscriptionId: 'sub_test_alert_get',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Create alert rules
      await prisma.alertRule.create({
        data: {
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        },
      });

      await prisma.alertRule.create({
        data: {
          userId: user.id,
          lat: 51.5074,
          lng: -0.1278,
          radiusMiles: 15,
          fuelType: 'diesel',
          thresholdPpl: 3,
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'GET',
      });

      // Call endpoint
      const response = await alertsGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.alertRules).toBeDefined();
      expect(data.alertRules.length).toBe(2);
      expect(data.alertRules[0].userId).toBe(user.id);
      expect(data.alertRules[1].userId).toBe(user.id);
    });

    test('returns empty array for user with no alert rules', async () => {
      // Create test user
      const clerkUserId = 'user_test_alert_empty';
      const email = 'alertempty@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'GET',
      });

      // Call endpoint
      const response = await alertsGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.alertRules).toBeDefined();
      expect(data.alertRules.length).toBe(0);
    });

    test('returns 401 for unauthenticated request', async () => {
      // Mock Clerk auth to return no user
      (auth as any).mockResolvedValue({ userId: null });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts', {
        method: 'GET',
      });

      // Call endpoint
      const response = await alertsGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });


  describe('PUT /api/alerts/[id]', () => {
    test('updates alert rule for authenticated Pro user', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_alert_update';
      const email = 'alertupdate@example.com';
      const user = await createUser(clerkUserId, email);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_alert_update',
          stripeSubscriptionId: 'sub_test_alert_update',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Create alert rule
      const alertRule = await prisma.alertRule.create({
        data: {
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request(`http://localhost:3000/api/alerts/${alertRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          radiusMiles: 20,
          thresholdPpl: 10,
          enabled: false,
        }),
      });

      // Call endpoint
      const response = await alertPUT(request as any, { params: { id: alertRule.id } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.alertRule).toBeDefined();
      expect(data.alertRule.radiusMiles).toBe(20);
      expect(data.alertRule.thresholdPpl).toBe(10);
      expect(data.alertRule.enabled).toBe(false);
      expect(data.alertRule.centerPostcode).toBe('SW1A 1AA'); // Unchanged
    });

    test('returns 403 for Free tier user', async () => {
      // Create test user without Pro subscription
      const clerkUserId = 'user_test_alert_update_free';
      const email = 'alertupdatefree@example.com';
      const user = await createUser(clerkUserId, email);

      // Create alert rule (from when they were Pro)
      const alertRule = await prisma.alertRule.create({
        data: {
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request(`http://localhost:3000/api/alerts/${alertRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          radiusMiles: 20,
        }),
      });

      // Call endpoint
      const response = await alertPUT(request as any, { params: { id: alertRule.id } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(403);
      expect(data.error).toContain('Pro feature');
    });


    test('returns 404 for non-existent alert rule', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_alert_notfound';
      const email = 'alertnotfound@example.com';
      const user = await createUser(clerkUserId, email);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_alert_notfound',
          stripeSubscriptionId: 'sub_test_alert_notfound',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request with non-existent ID
      const request = new Request('http://localhost:3000/api/alerts/nonexistent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          radiusMiles: 20,
        }),
      });

      // Call endpoint
      const response = await alertPUT(request as any, { params: { id: 'nonexistent' } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(404);
      expect(data.error).toBe('Alert rule not found');
    });

    test('returns 403 when trying to update another user\'s alert rule', async () => {
      // Create two users
      const clerkUserId1 = 'user_test_alert_owner';
      const email1 = 'alertowner@example.com';
      const user1 = await createUser(clerkUserId1, email1);

      const clerkUserId2 = 'user_test_alert_other';
      const email2 = 'alertother@example.com';
      const user2 = await createUser(clerkUserId2, email2);

      // Create Pro subscriptions for both
      await prisma.subscription.create({
        data: {
          userId: user1.id,
          stripeCustomerId: 'cus_test_alert_owner',
          stripeSubscriptionId: 'sub_test_alert_owner',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.subscription.create({
        data: {
          userId: user2.id,
          stripeCustomerId: 'cus_test_alert_other',
          stripeSubscriptionId: 'sub_test_alert_other',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Create alert rule for user1
      const alertRule = await prisma.alertRule.create({
        data: {
          userId: user1.id,
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        },
      });

      // Mock Clerk auth as user2
      (auth as any).mockResolvedValue({ userId: clerkUserId2 });

      // Create request
      const request = new Request(`http://localhost:3000/api/alerts/${alertRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          radiusMiles: 20,
        }),
      });

      // Call endpoint
      const response = await alertPUT(request as any, { params: { id: alertRule.id } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(403);
      expect(data.error).toContain('do not own');
    });
  });


  describe('DELETE /api/alerts/[id]', () => {
    test('deletes alert rule for authenticated user', async () => {
      // Create test user
      const clerkUserId = 'user_test_alert_delete';
      const email = 'alertdelete@example.com';
      const user = await createUser(clerkUserId, email);

      // Create alert rule
      const alertRule = await prisma.alertRule.create({
        data: {
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request(`http://localhost:3000/api/alerts/${alertRule.id}`, {
        method: 'DELETE',
      });

      // Call endpoint
      const response = await alertDELETE(request as any, { params: { id: alertRule.id } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify alert rule was deleted
      const deleted = await prisma.alertRule.findUnique({
        where: { id: alertRule.id },
      });
      expect(deleted).toBeNull();
    });

    test('returns 404 for non-existent alert rule', async () => {
      // Create test user
      const clerkUserId = 'user_test_alert_delete_notfound';
      const email = 'alertdeletenotfound@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request with non-existent ID
      const request = new Request('http://localhost:3000/api/alerts/nonexistent', {
        method: 'DELETE',
      });

      // Call endpoint
      const response = await alertDELETE(request as any, { params: { id: 'nonexistent' } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(404);
      expect(data.error).toBe('Alert rule not found');
    });

    test('returns 403 when trying to delete another user\'s alert rule', async () => {
      // Create two users
      const clerkUserId1 = 'user_test_alert_delete_owner';
      const email1 = 'alertdeleteowner@example.com';
      const user1 = await createUser(clerkUserId1, email1);

      const clerkUserId2 = 'user_test_alert_delete_other';
      const email2 = 'alertdeleteother@example.com';
      await createUser(clerkUserId2, email2);

      // Create alert rule for user1
      const alertRule = await prisma.alertRule.create({
        data: {
          userId: user1.id,
          centerPostcode: 'SW1A 1AA',
          radiusMiles: 10,
          fuelType: 'petrol',
          thresholdPpl: 5,
        },
      });

      // Mock Clerk auth as user2
      (auth as any).mockResolvedValue({ userId: clerkUserId2 });

      // Create request
      const request = new Request(`http://localhost:3000/api/alerts/${alertRule.id}`, {
        method: 'DELETE',
      });

      // Call endpoint
      const response = await alertDELETE(request as any, { params: { id: alertRule.id } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(403);
      expect(data.error).toContain('do not own');
    });

    test('returns 401 for unauthenticated request', async () => {
      // Mock Clerk auth to return no user
      (auth as any).mockResolvedValue({ userId: null });

      // Create request
      const request = new Request('http://localhost:3000/api/alerts/someid', {
        method: 'DELETE',
      });

      // Call endpoint
      const response = await alertDELETE(request as any, { params: { id: 'someid' } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});
