// Stripe webhook handler for FuelFuse
// Validates: Requirements 5.2, 5.3, 8.3, 8.4

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 * Validates: Requirements 5.2, 5.3, 8.3, 8.4
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature (Requirement 8.3)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Check for idempotency - has this event been processed before? (Requirements 5.3, 8.4)
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent) {
      // Event already processed, return success to acknowledge
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Process the event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Record that we've processed this event (idempotency)
    await prisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 * Updates subscription status to Pro tier (Requirement 5.2)
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Determine plan from price ID
  const priceId = subscription.items.data[0]?.price.id;
  let plan = 'pro_monthly'; // Default
  
  if (priceId) {
    // You can map price IDs to plan names here
    // For now, we'll use a simple check
    if (priceId.includes('yearly') || priceId.includes('annual')) {
      plan = 'pro_yearly';
    }
  }

  // Update subscription in database
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      plan,
      periodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      plan,
      periodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription created for user ${userId}: ${subscriptionId}`);
}

/**
 * Handle subscription update events
 * Updates subscription status in database
 */
async function handleSubscriptionUpdate(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;

  // Find user by customer ID
  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!existingSubscription) {
    console.error(`No subscription found for customer ${customerId}`);
    return;
  }

  // Determine plan from price ID
  const priceId = subscription.items.data[0]?.price.id;
  let plan = existingSubscription.plan; // Keep existing plan by default
  
  if (priceId) {
    if (priceId.includes('yearly') || priceId.includes('annual')) {
      plan = 'pro_yearly';
    } else if (priceId.includes('monthly') || priceId.includes('month')) {
      plan = 'pro_monthly';
    }
  }

  // Update subscription status
  await prisma.subscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      plan,
      periodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`);
}

/**
 * Handle subscription deletion/cancellation
 * Updates subscription status to canceled
 */
async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const customerId = subscription.customer as string;

  // Update subscription status to canceled
  await prisma.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      status: 'canceled',
    },
  });

  console.log(`Subscription canceled for customer ${customerId}`);
}
