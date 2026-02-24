// POST /api/push/register - Register Expo push token
// Requirements: 4.1
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId, createUser } from '@/lib/user';
import { registerToken } from '@/lib/push-token';
import { pushTokenSchema } from '@fuelfuse/shared';

/**
 * POST /api/push/register
 * Register Expo push token (authenticated)
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
    
    // Parse and validate request body
    const body = await request.json();
    const validated = pushTokenSchema.parse(body);
    
    // Get or create user
    let user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      // Create user if doesn't exist
      // Note: In production, email should come from Clerk user object
      const email = `${clerkUserId}@temp.com`; // Placeholder
      user = await createUser(clerkUserId, email);
    }
    
    // Register push token
    await registerToken(user.id, validated.expoPushToken, validated.platform);
    
    return NextResponse.json(
      { success: true, message: 'Push token registered successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Push token registration error:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
