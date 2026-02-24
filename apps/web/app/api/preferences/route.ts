// GET/PUT /api/preferences - User preferences management
// Requirements: 3.2, 3.3
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { userPreferencesSchema } from '@fuelfuse/shared';
import { 
  getUserByClerkId, 
  createUser, 
  saveUserPreferences, 
  getUserPreferences 
} from '@/lib/user';

/**
 * GET /api/preferences
 * Retrieve user preferences (authenticated)
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
    
    // Get user from database
    let user = await getUserByClerkId(clerkUserId);
    
    // If user doesn't exist, return null preferences
    if (!user) {
      return NextResponse.json(
        { preferences: null },
        { status: 200 }
      );
    }
    
    // Retrieve preferences
    const preferences = await getUserPreferences(user.id);
    
    return NextResponse.json(
      { preferences },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get preferences error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/preferences
 * Save user preferences (authenticated)
 */
export async function PUT(request: NextRequest) {
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
    const validationResult = userPreferencesSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid preferences data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }
    
    const validatedPreferences = validationResult.data;
    
    // Get or create user
    let user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      // Create user if doesn't exist
      // Note: In production, email should come from Clerk user object
      const email = `${clerkUserId}@temp.com`; // Placeholder
      user = await createUser(clerkUserId, email);
    }
    
    // Save preferences
    const savedPreferences = await saveUserPreferences(user.id, validatedPreferences);
    
    return NextResponse.json(
      { 
        preferences: {
          homePostcode: savedPreferences.homePostcode,
          defaultRadius: savedPreferences.defaultRadius,
          defaultFuelType: savedPreferences.defaultFuelType,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Save preferences error:', error);
    
    // Handle validation errors from service layer
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
