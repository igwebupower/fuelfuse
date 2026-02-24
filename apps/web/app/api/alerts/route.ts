// POST /api/alerts - Create alert rule
// GET /api/alerts - List user's alert rules
// Requirements: 4.2
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId, createUser } from '@/lib/user';
import { createAlertRule, getAlertRulesForUser } from '@/lib/alert-rule';
import { createAlertRuleSchema } from '@fuelfuse/shared';

/**
 * POST /api/alerts
 * Create alert rule (authenticated, Pro only)
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
    const validated = createAlertRuleSchema.parse(body);
    
    // Get or create user
    let user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      // Create user if doesn't exist
      const email = `${clerkUserId}@temp.com`; // Placeholder
      user = await createUser(clerkUserId, email);
    }
    
    // Create alert rule (enforces Pro tier check)
    const alertRule = await createAlertRule(user.id, validated);
    
    return NextResponse.json(
      { alertRule },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create alert rule error:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    // Handle Pro tier requirement
    if (error.message?.includes('Pro feature')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts
 * List user's alert rules (authenticated)
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
      const email = `${clerkUserId}@temp.com`; // Placeholder
      user = await createUser(clerkUserId, email);
    }
    
    // Get alert rules for user
    const alertRules = await getAlertRulesForUser(user.id);
    
    return NextResponse.json(
      { alertRules },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get alert rules error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
