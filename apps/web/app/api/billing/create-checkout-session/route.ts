// POST /api/billing/create-checkout-session - Create Stripe checkout session for Pro upgrade
// Requirements: 5.1
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getUserByClerkId, createUser } from '@/lib/user';
import { createCheckoutSession, isProUser } from '@/lib/subscription';

// Request body schema
const createCheckoutSessionSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe checkout session for Pro upgrade (authenticated)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user with Clerk
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate with Zod
    const validationResult = createCheckoutSessionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }
    
    const { successUrl, cancelUrl } = validationResult.data;
    
    // Get or create user
    let user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      // Create user if doesn't exist
      // Note: In production, email should come from Clerk user object
      const email = `${clerkUserId}@temp.com`; // Placeholder
      user = await createUser(clerkUserId, email);
    }
    
    // Check if user is already Pro
    const isPro = await isProUser(user.id);
    
    if (isPro) {
      return NextResponse.json(
        { error: 'User is already subscribed to Pro tier' },
        { status: 400 }
      );
    }
    
    // Get Stripe price ID from environment
    const priceId = process.env.STRIPE_PRICE_ID;
    
    if (!priceId) {
      console.error('STRIPE_PRICE_ID environment variable not set');
      return NextResponse.json(
        { error: 'Stripe configuration error' },
        { status: 500 }
      );
    }
    
    // Create checkout session
    const session = await createCheckoutSession(
      user.id,
      priceId,
      successUrl,
      cancelUrl
    );
    
    return NextResponse.json(
      { 
        sessionId: session.sessionId,
        url: session.url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Create checkout session error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
