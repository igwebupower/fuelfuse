// Tests for billing API endpoints
// Requirements: 5.1, 5.4

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as createCheckoutSessionPOST } from '../app/api/billing/create-checkout-session/route';
import { GET as billingStatusGET } from '../app/api/billing/status/route';
import { createUser } from '../lib/user';
import { prisma } from '../lib/prisma';
import Stripe from 'stripe';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  };
  
  return {
    default: vi.fn(() => mockStripe),
  };
});

// Import auth after mocking
import { auth } from '@clerk/nextjs/server';

describe('Billing API Endpoints', () => {
  let mockStripe: any;

  beforeEach(() => {
    // Get the mocked Stripe instance
    const StripeConstructor = Stripe as any;
    mockStripe = new StripeConstructor();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Set environment variable
    process.env.STRIPE_PRICE_ID = 'price_test_123';
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_ID;
  });

  describe('POST /api/billing/create-checkout-session', () => {
    test('creates checkout session for authenticated Free tier user', async () => {
      // Create test user
      const clerkUserId = 'user_test_checkout_1';
      const email = 'checkout1@example.com';
      const user = await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Mock Stripe responses
      const mockCustomerId = 'cus_test_123';
      mockStripe.customers.create.mockResolvedValue({
        id: mockCustomerId,
        email,
      });

      const mockSessionId = 'cs_test_123';
      const mockSessionUrl = 'https://checkout.stripe.com/pay/cs_test_123';
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: mockSessionId,
        url: mockSessionUrl,
      });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      // Call endpoint
      const response = await createCheckoutSessionPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.sessionId).toBe(mockSessionId);
      expect(data.url).toBe(mockSessionUrl);
    });

    test('returns 401 for unauthenticated request', async () => {
      // Mock Clerk auth to return no user
      (auth as any).mockResolvedValue({ userId: null });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      // Call endpoint
      const response = await createCheckoutSessionPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 for invalid request body', async () => {
      // Create test user
      const clerkUserId = 'user_test_checkout_invalid';
      const email = 'invalid@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request with invalid URLs
      const request = new Request('http://localhost:3000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'not-a-url',
          cancelUrl: 'also-not-a-url',
        }),
      });

      // Call endpoint
      const response = await createCheckoutSessionPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });

    test('returns 400 when user is already Pro', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_already_pro';
      const email = 'alreadypro@example.com';
      const user = await createUser(clerkUserId, email);

      // Create Pro subscription
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_pro',
          stripeSubscriptionId: 'sub_test_pro',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      // Call endpoint
      const response = await createCheckoutSessionPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(data.error).toBe('User is already subscribed to Pro tier');
    });

    test('creates user if not exists', async () => {
      // Use a new Clerk user ID that doesn't exist in database
      const clerkUserId = 'user_test_new_checkout';

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Mock Stripe responses
      const mockCustomerId = 'cus_test_new';
      mockStripe.customers.create.mockResolvedValue({
        id: mockCustomerId,
        email: `${clerkUserId}@temp.com`,
      });

      const mockSessionId = 'cs_test_new';
      const mockSessionUrl = 'https://checkout.stripe.com/pay/cs_test_new';
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: mockSessionId,
        url: mockSessionUrl,
      });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      // Call endpoint
      const response = await createCheckoutSessionPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.sessionId).toBe(mockSessionId);
      expect(data.url).toBe(mockSessionUrl);

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
      });
      expect(user).toBeDefined();
      expect(user?.clerkUserId).toBe(clerkUserId);
    });

    test('returns 500 when STRIPE_PRICE_ID is not set', async () => {
      // Remove environment variable
      delete process.env.STRIPE_PRICE_ID;

      // Create test user
      const clerkUserId = 'user_test_no_price_id';
      const email = 'nopriceid@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      // Call endpoint
      const response = await createCheckoutSessionPOST(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(500);
      expect(data.error).toBe('Stripe configuration error');
    });
  });

  describe('GET /api/billing/status', () => {
    test('returns Free tier status for user without subscription', async () => {
      // Create test user
      const clerkUserId = 'user_test_status_free';
      const email = 'statusfree@example.com';
      await createUser(clerkUserId, email);

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/status', {
        method: 'GET',
      });

      // Call endpoint
      const response = await billingStatusGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.tier).toBe('free');
      expect(data.status).toBeUndefined();
      expect(data.periodEnd).toBeUndefined();
    });

    test('returns Pro tier status for user with active subscription', async () => {
      // Create test user with Pro subscription
      const clerkUserId = 'user_test_status_pro';
      const email = 'statuspro@example.com';
      const user = await createUser(clerkUserId, email);

      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_status_pro',
          stripeSubscriptionId: 'sub_test_status_pro',
          status: 'active',
          plan: 'pro_monthly',
          periodEnd,
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/status', {
        method: 'GET',
      });

      // Call endpoint
      const response = await billingStatusGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.tier).toBe('pro');
      expect(data.status).toBe('active');
      expect(new Date(data.periodEnd).getTime()).toBe(periodEnd.getTime());
    });

    test('returns Free tier for user with canceled subscription', async () => {
      // Create test user with canceled subscription
      const clerkUserId = 'user_test_status_canceled';
      const email = 'statuscanceled@example.com';
      const user = await createUser(clerkUserId, email);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_status_canceled',
          stripeSubscriptionId: 'sub_test_status_canceled',
          status: 'canceled',
          plan: 'pro_monthly',
          periodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Past date
        },
      });

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/status', {
        method: 'GET',
      });

      // Call endpoint
      const response = await billingStatusGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.tier).toBe('free');
      expect(data.status).toBe('canceled');
    });

    test('returns 401 for unauthenticated request', async () => {
      // Mock Clerk auth to return no user
      (auth as any).mockResolvedValue({ userId: null });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/status', {
        method: 'GET',
      });

      // Call endpoint
      const response = await billingStatusGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('creates user if not exists', async () => {
      // Use a new Clerk user ID that doesn't exist in database
      const clerkUserId = 'user_test_new_status';

      // Mock Clerk auth
      (auth as any).mockResolvedValue({ userId: clerkUserId });

      // Create request
      const request = new Request('http://localhost:3000/api/billing/status', {
        method: 'GET',
      });

      // Call endpoint
      const response = await billingStatusGET(request as any);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.tier).toBe('free');

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
      });
      expect(user).toBeDefined();
      expect(user?.clerkUserId).toBe(clerkUserId);
    });
  });
});
