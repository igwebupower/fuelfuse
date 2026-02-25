// Subscription services for FuelFuse
import Stripe from 'stripe';
import { prisma } from './prisma';
import { CheckoutSession, SubscriptionInfo } from '@fuelfuse/shared';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

/**
 * Create a Stripe checkout session for Pro upgrade
 * Validates: Requirements 5.1
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSession> {
  // Get user to retrieve email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if user already has a subscription
  let customerId = user.subscription?.stripeCustomerId;

  // Create or retrieve Stripe customer
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId,
      },
    });
    customerId = customer.id;

    // Store customer ID in database
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeCustomerId: customerId,
        status: 'incomplete',
        plan: 'free',
      },
      update: {
        stripeCustomerId: customerId,
      },
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
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
    metadata: {
      userId: user.id,
    },
  });

  return {
    sessionId: session.id,
    url: session.url || '',
  };
}

/**
 * Get subscription status for a user
 * Validates: Requirements 5.4
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionInfo> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return { tier: 'free' };
  }

  // Check if subscription is active
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const isPro = subscription.plan.startsWith('pro') && isActive;

  return {
    tier: isPro ? 'pro' : 'free',
    status: subscription.status as any,
    periodEnd: subscription.periodEnd || undefined,
  };
}

/**
 * Check if user is Pro tier
 * Validates: Requirements 5.4
 */
export async function isProUser(userId: string): Promise<boolean> {
  const status = await getSubscriptionStatus(userId);
  return status.tier === 'pro';
}

/**
 * Enforce tier limits for radius
 * Validates: Requirements 5.5, 5.6, 5.7
 */
export async function enforceTierLimits(userId: string, radiusMiles: number): Promise<void> {
  const isPro = await isProUser(userId);

  // Free tier: max 5 miles
  // Pro tier: max 25 miles
  const maxRadius = isPro ? 25 : 5;

  if (radiusMiles > maxRadius) {
    throw new Error(
      `Radius ${radiusMiles} miles exceeds ${isPro ? 'Pro' : 'Free'} tier limit of ${maxRadius} miles${
        !isPro ? '. Upgrade to Pro for extended radius.' : ''
      }`
    );
  }
}

/**
 * Check if user can create alerts (Pro only)
 * Validates: Requirements 5.5, 5.6
 */
export async function canCreateAlerts(userId: string): Promise<boolean> {
  return await isProUser(userId);
}

/**
 * Enforce alert creation permission
 * Validates: Requirements 5.5, 5.6
 */
export async function enforceAlertPermission(userId: string): Promise<void> {
  const canCreate = await canCreateAlerts(userId);
  
  if (!canCreate) {
    throw new Error('Alert creation is a Pro feature. Upgrade to Pro to create alerts.');
  }
}
