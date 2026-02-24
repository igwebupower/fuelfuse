// GET /api/billing/status - Get user's subscription status
// Requirements: 5.4
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId, createUser } from '@/lib/user';
import { getSubscriptionStatus } from '@/lib/subscription';

/**
 * GET /api/billing/status
 * Get user's subscription status (authenticated)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user with Clerk
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get or create user
    let user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      // Create user if doesn't exist
      // Note: In production, email should come from Clerk user object
      const email = `${clerkUserId}@temp.com`; // Placeholder
      user = await createUser(clerkUserId, email);
    }
    
    // Get subscription status
    const status = await getSubscriptionStatus(user.id);
    
    return NextResponse.json(
      { 
        tier: status.tier,
        status: status.status,
        periodEnd: status.periodEnd,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get billing status error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
