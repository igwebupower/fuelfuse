// Test helper for subscription creation
import { prisma } from './prisma';

/**
 * Create a subscription for testing purposes
 */
export async function createSubscription(
  userId: string,
  plan: string,
  status: string
) {
  return await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: `cus_test_${userId}`,
      status,
      plan,
    },
    update: {
      status,
      plan,
    },
  });
}
