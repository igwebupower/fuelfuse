// Feature: fuelfuse-mvp, Property 15: Webhook updates subscription status
// Validates: Requirements 5.2

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
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
const stripe = new Stripe('test_key', { apiVersion: '2026-01-28.clover' });

describe('Webhook Subscription Update - Property 15: Webhook updates subscription status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('checkout.session.completed webhook should update subscription to Pro tier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          randomSeed: fc.integer({ min: 0, max: 1000000 }),
          subscriptionStatus: fc.constantFrom('active', 'trialing'),
          periodEnd: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        }),
        async (eventData) => {
          // Create unique IDs using timestamp + random seed to avoid collisions during shrinking
          const uniqueSuffix = `${Date.now()}_${eventData.randomSeed}_${Math.random().toString(36).substring(7)}`;
          const clerkUserId = `clerk_${uniqueSuffix}`;
          const customerId = `cus_${uniqueSuffix}`;
          const subscriptionId = `sub_${uniqueSuffix}`;
          const eventId = `evt_${uniqueSuffix}`;
          
          const user = await prisma.user.create({
            data: {
              clerkUserId,
              email: `test_${uniqueSuffix}@example.com`,
            },
          });

          // Create initial free subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: customerId,
              status: 'incomplete',
              plan: 'free',
            },
          });

          // Round periodEnd to seconds to match Stripe's precision
          const periodEndSeconds = Math.floor(eventData.periodEnd.getTime() / 1000);
          const expectedPeriodEnd = new Date(periodEndSeconds * 1000);

          // Mock Stripe subscription retrieve
          vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
            id: subscriptionId,
            customer: customerId,
            status: eventData.subscriptionStatus,
            current_period_end: periodEndSeconds,
            items: {
              data: [
                {
                  price: {
                    id: 'price_monthly',
                  },
                } as any,
              ],
            },
          } as any);

          // Create mock checkout.session.completed event
          const mockEvent: Stripe.Event = {
            id: eventId,
            type: 'checkout.session.completed',
            data: {
              object: {
                customer: customerId,
                subscription: subscriptionId,
                metadata: { userId: user.id },
              } as Stripe.Checkout.Session,
            },
          } as any;

          vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

          // Create webhook request
          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': 'valid_signature',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call webhook handler
          const response = await POST(request);
          const data = await response.json();

          // Should return 200 OK
          expect(response.status).toBe(200);
          expect(data.received).toBe(true);

          // Verify subscription was updated to Pro tier
          const updatedSubscription = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          expect(updatedSubscription).not.toBeNull();
          expect(updatedSubscription?.stripeSubscriptionId).toBe(subscriptionId);
          expect(updatedSubscription?.status).toBe(eventData.subscriptionStatus);
          expect(updatedSubscription?.plan).toBe('pro_monthly');
          expect(updatedSubscription?.periodEnd?.getTime()).toBe(expectedPeriodEnd.getTime());
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('customer.subscription.updated webhook should update subscription status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          randomSeed: fc.integer({ min: 0, max: 1000000 }),
          newStatus: fc.constantFrom('active', 'past_due', 'canceled', 'trialing'),
          periodEnd: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        }),
        async (eventData) => {
          // Create unique IDs using timestamp + random seed to avoid collisions during shrinking
          const uniqueSuffix = `${Date.now()}_${eventData.randomSeed}_${Math.random().toString(36).substring(7)}`;
          const clerkUserId = `clerk_${uniqueSuffix}`;
          const customerId = `cus_${uniqueSuffix}`;
          const subscriptionId = `sub_${uniqueSuffix}`;
          const eventId = `evt_${uniqueSuffix}`;
          
          const user = await prisma.user.create({
            data: {
              clerkUserId,
              email: `test_${uniqueSuffix}@example.com`,
            },
          });

          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              status: 'active',
              plan: 'pro_monthly',
              periodEnd: new Date('2024-06-01'),
            },
          });

          // Round periodEnd to seconds to match Stripe's precision
          const periodEndSeconds = Math.floor(eventData.periodEnd.getTime() / 1000);
          const expectedPeriodEnd = new Date(periodEndSeconds * 1000);

          // Create mock customer.subscription.updated event
          const mockEvent: Stripe.Event = {
            id: eventId,
            type: 'customer.subscription.updated',
            data: {
              object: {
                id: subscriptionId,
                customer: customerId,
                status: eventData.newStatus,
                current_period_end: periodEndSeconds,
                items: {
                  data: [
                    {
                      price: {
                        id: 'price_monthly',
                      },
                    },
                  ],
                },
              } as Stripe.Subscription,
            },
          } as any;

          vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

          // Create webhook request
          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': 'valid_signature',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call webhook handler
          const response = await POST(request);
          const data = await response.json();

          // Should return 200 OK
          expect(response.status).toBe(200);
          expect(data.received).toBe(true);

          // Verify subscription was updated
          const updatedSubscription = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          expect(updatedSubscription).not.toBeNull();
          expect(updatedSubscription?.status).toBe(eventData.newStatus);
          expect(updatedSubscription?.periodEnd?.getTime()).toBe(expectedPeriodEnd.getTime());
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('customer.subscription.deleted webhook should set subscription to canceled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          randomSeed: fc.integer({ min: 0, max: 1000000 }),
        }),
        async (eventData) => {
          // Create unique IDs using timestamp + random seed to avoid collisions during shrinking
          const uniqueSuffix = `${Date.now()}_${eventData.randomSeed}_${Math.random().toString(36).substring(7)}`;
          const clerkUserId = `clerk_${uniqueSuffix}`;
          const customerId = `cus_${uniqueSuffix}`;
          const subscriptionId = `sub_${uniqueSuffix}`;
          const eventId = `evt_${uniqueSuffix}`;
          
          const user = await prisma.user.create({
            data: {
              clerkUserId,
              email: `test_${uniqueSuffix}@example.com`,
            },
          });

          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              status: 'active',
              plan: 'pro_monthly',
              periodEnd: new Date('2024-12-31'),
            },
          });

          // Create mock customer.subscription.deleted event
          const mockEvent: Stripe.Event = {
            id: eventId,
            type: 'customer.subscription.deleted',
            data: {
              object: {
                id: subscriptionId,
                customer: customerId,
                status: 'canceled',
                current_period_end: Math.floor(Date.now() / 1000),
                items: {
                  data: [
                    {
                      price: {
                        id: 'price_monthly',
                      },
                    },
                  ],
                },
              } as Stripe.Subscription,
            },
          } as any;

          vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

          // Create webhook request
          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': 'valid_signature',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call webhook handler
          const response = await POST(request);
          const data = await response.json();

          // Should return 200 OK
          expect(response.status).toBe(200);
          expect(data.received).toBe(true);

          // Verify subscription was canceled
          const updatedSubscription = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          expect(updatedSubscription).not.toBeNull();
          expect(updatedSubscription?.status).toBe('canceled');
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('webhook should update subscription from free to pro tier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          randomSeed: fc.integer({ min: 0, max: 1000000 }),
          priceType: fc.constantFrom('monthly', 'yearly'),
        }),
        async (eventData) => {
          // Create unique IDs using timestamp + random seed to avoid collisions during shrinking
          const uniqueSuffix = `${Date.now()}_${eventData.randomSeed}_${Math.random().toString(36).substring(7)}`;
          const clerkUserId = `clerk_${uniqueSuffix}`;
          const customerId = `cus_${uniqueSuffix}`;
          const subscriptionId = `sub_${uniqueSuffix}`;
          const eventId = `evt_${uniqueSuffix}`;
          
          const user = await prisma.user.create({
            data: {
              clerkUserId,
              email: `test_${uniqueSuffix}@example.com`,
            },
          });

          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: customerId,
              status: 'incomplete',
              plan: 'free',
            },
          });

          // Determine price ID and expected plan
          const priceId = eventData.priceType === 'yearly' ? 'price_yearly' : 'price_monthly';
          const expectedPlan = eventData.priceType === 'yearly' ? 'pro_yearly' : 'pro_monthly';

          // Mock Stripe subscription retrieve
          vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
            id: subscriptionId,
            customer: customerId,
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            items: {
              data: [
                {
                  price: {
                    id: priceId,
                  },
                } as any,
              ],
            },
          } as any);

          // Create mock checkout.session.completed event
          const mockEvent: Stripe.Event = {
            id: eventId,
            type: 'checkout.session.completed',
            data: {
              object: {
                customer: customerId,
                subscription: subscriptionId,
                metadata: { userId: user.id },
              } as Stripe.Checkout.Session,
            },
          } as any;

          vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

          // Create webhook request
          const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
            method: 'POST',
            headers: {
              'stripe-signature': 'valid_signature',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockEvent),
          });

          // Call webhook handler
          const response = await POST(request);

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Verify subscription was upgraded to Pro
          const updatedSubscription = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          expect(updatedSubscription).not.toBeNull();
          expect(updatedSubscription?.plan).toBe(expectedPlan);
          expect(updatedSubscription?.status).toBe('active');
          expect(updatedSubscription?.stripeSubscriptionId).toBe(subscriptionId);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
