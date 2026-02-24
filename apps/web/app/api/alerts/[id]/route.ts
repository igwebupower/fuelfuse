// PUT /api/alerts/[id] - Update alert rule
// DELETE /api/alerts/[id] - Delete alert rule
// Requirements: 4.2
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/user';
import { getAlertRule, updateAlertRule, deleteAlertRule } from '@/lib/alert-rule';
import { enforceAlertPermission } from '@/lib/subscription';
import { createAlertRuleSchema } from '@fuelfuse/shared';

/**
 * PUT /api/alerts/[id]
 * Update alert rule (authenticated, Pro only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user with Clerk
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user
    const user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check Pro tier for updates
    await enforceAlertPermission(user.id);
    
    // Get alert rule to verify ownership
    const alertRule = await getAlertRule(params.id);
    
    if (!alertRule) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    if (alertRule.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this alert rule' },
        { status: 403 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    
    // Partial validation - only validate provided fields
    const updateData: any = {};
    if (body.centerPostcode !== undefined) updateData.centerPostcode = body.centerPostcode;
    if (body.lat !== undefined) updateData.lat = body.lat;
    if (body.lng !== undefined) updateData.lng = body.lng;
    if (body.radiusMiles !== undefined) updateData.radiusMiles = body.radiusMiles;
    if (body.fuelType !== undefined) updateData.fuelType = body.fuelType;
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
    if (body.thresholdPpl !== undefined) updateData.thresholdPpl = body.thresholdPpl;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    
    // Update alert rule
    const updated = await updateAlertRule(params.id, updateData);
    
    return NextResponse.json(
      { alertRule: updated },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update alert rule error:', error);
    
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
 * DELETE /api/alerts/[id]
 * Delete alert rule (authenticated)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user with Clerk
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user
    const user = await getUserByClerkId(clerkUserId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get alert rule to verify ownership
    const alertRule = await getAlertRule(params.id);
    
    if (!alertRule) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    if (alertRule.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this alert rule' },
        { status: 403 }
      );
    }
    
    // Delete alert rule
    await deleteAlertRule(params.id);
    
    return NextResponse.json(
      { success: true, message: 'Alert rule deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete alert rule error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
