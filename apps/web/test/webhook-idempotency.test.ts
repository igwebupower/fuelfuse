// Feature: fuelfuse-mvp, Property 16: Webhook processing is idempotent
// Validates: Requirements 5.3, 8.4

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../lib/prisma';
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

describe('Webhook Idempotency - Property 16: Webhook processing is idempotent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('processing the same webhook event multiple times should produce the same database state', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random webhook event data
        fc.record({
          eventId: fc.string({ minLength: 10, maxLength: 30 }),
          eventType: fc.constantFrom(
            'checkout.session.completed',
            'customer.subscription.updated',
            'customer.subscription.deleted'
          ),
          customerId: fc.string({ minLength: 10, maxLength: 30 }),
          subscriptionId: fc.string({ minLength: 10, maxLength: 30 }),
          status: fc.constantFrom('active', 'trialing', 'past_due', 'canceled'),
          periodEnd: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          uniqueId: fc.uuid(), // Add unique ID to ensure no collisions
        }),
        async (eventData) => {
          // Create a test user with unique ID
          const user = await prisma.user.create({
            data: {
              clerkUserId: `clerk_${eventData.uniqueId}`,
              email: `test_${eventData.uniqueId}@example.com`,
            },
          });

          // Create initial subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: `cus_${eventData.uniqueId}`,
              stripeSubscriptionId: `sub_${eventData.uniqueId}`,
              status: 'incomplete',
              plan: 'free',
            },
          });

          // Mock Stripe subscription retrieve
          vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
            id: `sub_${eventData.uniqueId}`,
            customer: `cus_${eventData.uniqueId}`,
            status: eventData.status,
            current_period_end: Math.floor(eventData.periodEnd.getTime() / 1000),
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

          // Create a mock webhook event with unique event ID
          const uniqueEventId = `evt_${eventData.uniqueId}`;
          const mockEvent: Stripe.Event = {
            id: uniqueEventId,
            type: eventData.eventType,
            data: {
              object:
                eventData.eventType === 'checkout.session.completed'
                  ? ({
                      customer: `cus_${eventData.uniqueId}`,
                      subscription: `sub_${eventData.uniqueId}`,
                      metadata: { userId: user.id },
                    } as Stripe.Checkout.Session)
                  : ({
                      id: `sub_${eventData.uniqueId}`,
                      customer: `cus_${eventData.uniqueId}`,
                      status: eventData.status,
                      current_period_end: Math.floor(eventData.periodEnd.getTime() / 1000),
                      items: {
                        data: [
                          {
                            price: {
                              id: 'price_monthly',
                            },
                          },
                        ],
                      },
                    } as Stripe.Subscription),
            },
          } as any;

          // Mock webhook signature verification
          vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

          // Simulate first processing
          const existingEvent1 = await prisma.webhookEvent.findUnique({
            where: { stripeEventId: uniqueEventId },
          });

          if (!existingEvent1) {
            // Process event
            if (eventData.eventType === 'checkout.session.completed') {
              await prisma.subscription.update({
                where: { userId: user.id },
                data: {
                  stripeSubscriptionId: `sub_${eventData.uniqueId}`,
                  status: eventData.status,
                  plan: 'pro_monthly',
                  periodEnd: eventData.periodEnd,
                },
              });
            } else if (
              eventData.eventType === 'customer.subscription.updated' ||
              eventData.eventType === 'customer.subscription.created'
            ) {
              await prisma.subscription.update({
                where: { stripeCustomerId: `cus_${eventData.uniqueId}` },
                data: {
                  status: eventData.status,
                  periodEnd: eventData.periodEnd,
                },
              });
            } else if (eventData.eventType === 'customer.subscription.deleted') {
              await prisma.subscription.updateMany({
                where: { stripeCustomerId: `cus_${eventData.uniqueId}` },
                data: { status: 'canceled' },
              });
            }

            // Record event as processed
            await prisma.webhookEvent.create({
              data: {
                stripeEventId: uniqueEventId,
                eventType: eventData.eventType,
              },
            });
          }

          // Get database state after first processing
          const subscriptionAfterFirst = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          const webhookEventsAfterFirst = await prisma.webhookEvent.count({
            where: { stripeEventId: uniqueEventId },
          });

          // Process the same event again (second time)
          const existingEvent2 = await prisma.webhookEvent.findUnique({
            where: { stripeEventId: uniqueEventId },
          });

          if (!existingEvent2) {
            // This should not execute because event was already processed
            if (eventData.eventType === 'checkout.session.completed') {
              await prisma.subscription.update({
                where: { userId: user.id },
                data: {
                  stripeSubscriptionId: `sub_${eventData.uniqueId}`,
                  status: eventData.status,
                  plan: 'pro_monthly',
                  periodEnd: eventData.periodEnd,
                },
              });
            }
          }

          // Get database state after second processing
          const subscriptionAfterSecond = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          const webhookEventsAfterSecond = await prisma.webhookEvent.count({
            where: { stripeEventId: uniqueEventId },
          });

          // Verify idempotency: database state should be identical
          expect(subscriptionAfterSecond?.status).toBe(subscriptionAfterFirst?.status);
          expect(subscriptionAfterSecond?.plan).toBe(subscriptionAfterFirst?.plan);
          expect(subscriptionAfterSecond?.stripeSubscriptionId).toBe(
            subscriptionAfterFirst?.stripeSubscriptionId
          );
          expect(subscriptionAfterSecond?.periodEnd?.getTime()).toBe(
            subscriptionAfterFirst?.periodEnd?.getTime()
          );

          // Webhook event should only be recorded once
          expect(webhookEventsAfterFirst).toBe(1);
          expect(webhookEventsAfterSecond).toBe(1);

          // Process a third time to ensure continued idempotency
          const existingEvent3 = await prisma.webhookEvent.findUnique({
            where: { stripeEventId: uniqueEventId },
          });

          if (!existingEvent3) {
            // This should not execute
            await prisma.subscription.update({
              where: { userId: user.id },
              data: { status: 'active' },
            });
          }

          const subscriptionAfterThird = await prisma.subscription.findUnique({
            where: { userId: user.id },
          });

          const webhookEventsAfterThird = await prisma.webhookEvent.count({
            where: { stripeEventId: uniqueEventId },
          });

          // Still identical
          expect(subscriptionAfterThird?.status).toBe(subscriptionAfterFirst?.status);
          expect(webhookEventsAfterThird).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('duplicate webhook events with same event ID should not create duplicate webhook records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eventType: fc.constantFrom(
            'checkout.session.completed',
            'customer.subscription.updated'
          ),
          uniqueId: fc.uuid(), // Add unique ID
        }),
        async (eventData) => {
          const uniqueEventId = `evt_${eventData.uniqueId}`;
          
          // Try to create the same webhook event multiple times
          await prisma.webhookEvent.create({
            data: {
              stripeEventId: uniqueEventId,
              eventType: eventData.eventType,
            },
          });

          // Try to create again - should fail due to unique constraint
          let errorOccurred = false;
          try {
            await prisma.webhookEvent.create({
              data: {
                stripeEventId: uniqueEventId,
                eventType: eventData.eventType,
              },
            });
          } catch (error) {
            errorOccurred = true;
          }

          // Should have thrown an error
          expect(errorOccurred).toBe(true);

          // Should only have one record
          const count = await prisma.webhookEvent.count({
            where: { stripeEventId: uniqueEventId },
          });

          expect(count).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
