// Feature: fuelfuse-mvp, Property 14: Checkout session creation returns valid URL
// Validates: Requirements 5.1

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createUser } from '../lib/user';
import { createCheckoutSession } from '../lib/subscription';
import Stripe from 'stripe';

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

describe('Checkout Session - Property 14: Checkout session creation returns valid URL', () => {
  let mockStripe: any;

  beforeEach(() => {
    // Get the mocked Stripe instance
    const StripeConstructor = Stripe as any;
    mockStripe = new StripeConstructor();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  test('creating checkout session returns valid session ID and URL', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate user data with unique ID
        fc.record({
          clerkUserId: fc.uuid().map(id => `user_${id}`),
          email: fc.emailAddress(),
        }),
        // Generate Stripe price ID
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `price_${s}`),
        // Generate URLs
        fc.webUrl(),
        fc.webUrl(),
        async (userData, priceId, successUrl, cancelUrl) => {
          // Create user
          const user = await createUser(userData.clerkUserId, userData.email);

          // Mock Stripe customer creation
          const mockCustomerId = `cus_${Math.random().toString(36).substring(7)}`;
          mockStripe.customers.create.mockResolvedValue({
            id: mockCustomerId,
            email: userData.email,
          });

          // Mock Stripe checkout session creation
          const mockSessionId = `cs_test_${Math.random().toString(36).substring(7)}`;
          const mockSessionUrl = `https://checkout.stripe.com/pay/${mockSessionId}`;
          mockStripe.checkout.sessions.create.mockResolvedValue({
            id: mockSessionId,
            url: mockSessionUrl,
          });

          // Create checkout session
          const session = await createCheckoutSession(
            user.id,
            priceId,
            successUrl,
            cancelUrl
          );

          // Verify session has valid ID and URL
          expect(session.sessionId).toBeTruthy();
          expect(session.sessionId).toMatch(/^cs_/);
          expect(session.url).toBeTruthy();
          expect(session.url).toMatch(/^https:\/\//);
          expect(session.url).toContain('checkout.stripe.com');

          // Verify Stripe customer was created with correct email
          expect(mockStripe.customers.create).toHaveBeenCalledWith(
            expect.objectContaining({
              email: userData.email,
              metadata: expect.objectContaining({
                userId: user.id,
                clerkUserId: userData.clerkUserId,
              }),
            })
          );

          // Verify Stripe checkout session was created with correct parameters
          expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
              customer: mockCustomerId,
              mode: 'subscription',
              payment_method_types: ['card'],
              line_items: [
                {
                  price: priceId,
                  quantity: 1,
                },
              ],
              success_url: successUrl,
              cancel_url: cancelUrl,
              metadata: expect.objectContaining({
                userId: user.id,
              }),
            })
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test('checkout session reuses existing Stripe customer', async () => {
    // Test with specific examples instead of property-based to avoid unique constraint issues
    const testCases = [
      {
        user: { clerkUserId: 'user_reuse_test1', email: 'reuse1@example.com' },
        priceId: 'price_1234567890',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
      {
        user: { clerkUserId: 'user_reuse_test2', email: 'reuse2@example.com' },
        priceId: 'price_abcdefghij',
        successUrl: 'https://app.example.com/upgrade/success',
        cancelUrl: 'https://app.example.com/upgrade/cancel',
      },
    ];

    for (const testCase of testCases) {
      // Create user
      const user = await createUser(testCase.user.clerkUserId, testCase.user.email);

      // Mock first customer creation
      const mockCustomerId = `cus_${Math.random().toString(36).substring(7)}`;
      mockStripe.customers.create.mockResolvedValue({
        id: mockCustomerId,
        email: testCase.user.email,
      });

      // Mock checkout session creation
      const mockSessionId1 = `cs_test_${Math.random().toString(36).substring(7)}`;
      const mockSessionUrl1 = `https://checkout.stripe.com/pay/${mockSessionId1}`;
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: mockSessionId1,
        url: mockSessionUrl1,
      });

      // Create first checkout session
      const session1 = await createCheckoutSession(
        user.id,
        testCase.priceId,
        testCase.successUrl,
        testCase.cancelUrl
      );

      expect(session1.sessionId).toBeTruthy();
      expect(mockStripe.customers.create).toHaveBeenCalled();

      // Reset mock call counts
      const customerCreateCallCount = mockStripe.customers.create.mock.calls.length;

      // Mock second checkout session creation
      const mockSessionId2 = `cs_test_${Math.random().toString(36).substring(7)}`;
      const mockSessionUrl2 = `https://checkout.stripe.com/pay/${mockSessionId2}`;
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: mockSessionId2,
        url: mockSessionUrl2,
      });

      // Create second checkout session for same user
      const session2 = await createCheckoutSession(
        user.id,
        testCase.priceId,
        testCase.successUrl,
        testCase.cancelUrl
      );

      expect(session2.sessionId).toBeTruthy();
      // Customer should NOT be created again
      expect(mockStripe.customers.create).toHaveBeenCalledTimes(customerCreateCallCount);
    }
  });

  test('checkout session creation fails for non-existent user', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-existent user ID
        fc.uuid().map(id => `nonexistent_${id}`),
        // Generate Stripe price ID
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `price_${s}`),
        // Generate URLs
        fc.webUrl(),
        fc.webUrl(),
        async (userId, priceId, successUrl, cancelUrl) => {
          // Attempt to create checkout session for non-existent user
          await expect(
            createCheckoutSession(userId, priceId, successUrl, cancelUrl)
          ).rejects.toThrow('User not found');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('specific checkout session examples work correctly', async () => {
    const testCases = [
      {
        user: { clerkUserId: 'user_test1', email: 'test1@example.com' },
        priceId: 'price_1234567890',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
      {
        user: { clerkUserId: 'user_test2', email: 'test2@example.com' },
        priceId: 'price_abcdefghij',
        successUrl: 'https://app.example.com/upgrade/success',
        cancelUrl: 'https://app.example.com/upgrade/cancel',
      },
    ];

    for (const testCase of testCases) {
      // Create user
      const user = await createUser(testCase.user.clerkUserId, testCase.user.email);

      // Mock Stripe responses
      const mockCustomerId = `cus_${Math.random().toString(36).substring(7)}`;
      mockStripe.customers.create.mockResolvedValue({
        id: mockCustomerId,
        email: testCase.user.email,
      });

      const mockSessionId = `cs_test_${Math.random().toString(36).substring(7)}`;
      const mockSessionUrl = `https://checkout.stripe.com/pay/${mockSessionId}`;
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: mockSessionId,
        url: mockSessionUrl,
      });

      // Create checkout session
      const session = await createCheckoutSession(
        user.id,
        testCase.priceId,
        testCase.successUrl,
        testCase.cancelUrl
      );

      // Verify session
      expect(session.sessionId).toBe(mockSessionId);
      expect(session.url).toBe(mockSessionUrl);
    }
  });
});
