// Feature: fuelfuse-mvp, Property 26: Webhook signature verification
// Validates: Requirements 8.3

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { POST } from '../app/api/stripe/webhook/route';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  };
  return {
    default: vi.fn(() => mockStripe),
  };
});

// Import after mocking
const stripe = new Stripe('test_key', { apiVersion: '2024-11-20.acacia' });

describe('Webhook Signature Verification - Property 26: Webhook signature verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('webhook requests with invalid signature should be rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.uuid(),
          eventType: fc.constantFrom(
            'checkout.session.completed',
            'customer.subscription.updated',
            'customer.subscription.deleted'
          ),
          signature: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (eventData) => {
          // Mock Stripe to throw signature verification error
          vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
            throw new Error('Invalid signature');
          });

          // Create a mock webhook request
          const mockEvent = {
            id: eventData.eventId,
            type: eventData.eventType,
            data: {
              object: {},
            },
          };

          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': eventData.signature,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call the webhook handler
          const response = await POST(request);
          const data = await response.json();

          // Should return 401 Unauthorized
          expect(response.status).toBe(401);
          expect(data.error).toBe('Invalid signature');

          // Verify that constructEvent was called
          expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('webhook requests without signature header should be rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.uuid(),
          eventType: fc.constantFrom(
            'checkout.session.completed',
            'customer.subscription.updated'
          ),
        }),
        async (eventData) => {
          // Create a mock webhook request without signature header
          const mockEvent = {
            id: eventData.eventId,
            type: eventData.eventType,
            data: {
              object: {},
            },
          };

          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call the webhook handler
          const response = await POST(request);
          const data = await response.json();

          // Should return 400 Bad Request
          expect(response.status).toBe(400);
          expect(data.error).toBe('Missing stripe-signature header');

          // Verify that constructEvent was NOT called (rejected before verification)
          expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('webhook requests with valid signature should be processed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.uuid(),
          eventType: fc.constantFrom(
            'checkout.session.completed',
            'customer.subscription.updated',
            'customer.subscription.deleted'
          ),
          signature: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (eventData) => {
          // Mock Stripe to return a valid event
          const mockEvent: Stripe.Event = {
            id: eventData.eventId,
            type: eventData.eventType,
            data: {
              object: {
                id: 'sub_test',
                customer: 'cus_test',
                status: 'active',
                current_period_end: Math.floor(Date.now() / 1000) + 86400,
                items: {
                  data: [
                    {
                      price: {
                        id: 'price_monthly',
                      },
                    },
                  ],
                },
              } as any,
            },
          } as any;

          vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

          // Create a mock webhook request with valid signature
          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': eventData.signature,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call the webhook handler
          const response = await POST(request);
          const data = await response.json();

          // Should return 200 OK
          expect(response.status).toBe(200);
          expect(data.received).toBe(true);

          // Verify that constructEvent was called with correct parameters
          expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('signature verification should happen before any event processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventId: fc.uuid(),
          signature: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (eventData) => {
          // Mock Stripe to throw signature verification error
          vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
            throw new Error('Invalid signature');
          });

          // Mock subscription retrieve - this should NOT be called if signature fails
          const mockRetrieve = vi.mocked(stripe.subscriptions.retrieve);
          mockRetrieve.mockClear();

          const mockEvent = {
            id: eventData.eventId,
            type: 'checkout.session.completed',
            data: {
              object: {
                customer: 'cus_test',
                subscription: 'sub_test',
                metadata: { userId: 'user_test' },
              },
            },
          };

          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': eventData.signature,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call the webhook handler
          const response = await POST(request);

          // Should return 401 Unauthorized
          expect(response.status).toBe(401);

          // Verify that subscription retrieve was NOT called
          // (event processing should not happen if signature verification fails)
          expect(mockRetrieve).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
