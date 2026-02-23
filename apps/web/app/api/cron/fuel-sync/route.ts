// POST /api/cron/fuel-sync - Fuel price ingestion cron endpoint
import { NextRequest, NextResponse } from 'next/server';
import { runFuelSync } from '@/lib/ingestion';

/**
 * Verify cron secret from request headers
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable not configured');
    return false;
  }

  return cronSecret === expectedSecret;
}

/**
 * POST /api/cron/fuel-sync
 * Runs the fuel price ingestion job
 * Requires x-cron-secret header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run fuel sync
    const result = await runFuelSync();

    // Return result with appropriate status code
    const statusCode = result.status === 'success' ? 200 : result.status === 'partial' ? 207 : 500;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('Fuel sync cron error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
