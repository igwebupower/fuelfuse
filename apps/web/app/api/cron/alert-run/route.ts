// POST /api/cron/alert-run - Alert evaluation cron endpoint
// Requirements: 4.3, 4.8
import { NextRequest, NextResponse } from 'next/server';
import { evaluateAllAlerts } from '@/lib/alert-evaluation';
import { sendPushNotification, createAlertNotification } from '@/lib/push-notification';
import { updateLastTriggered } from '@/lib/alert-rule';
import { prisma } from '@/lib/prisma';

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
 * POST /api/cron/alert-run
 * Evaluates all enabled alert rules and sends notifications
 * Requires x-cron-secret header for authentication
 * Requirements: 4.3, 4.8
 */
export async function POST(request: NextRequest) {
  const startedAt = new Date();
  let sentCount = 0;
  const errors: string[] = [];

  try {
    // Verify cron secret (Requirement 4.8)
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Evaluate all enabled alert rules (Requirement 4.3)
    const evaluations = await evaluateAllAlerts();

    // Process alerts that should trigger
    for (const { rule, evaluation } of evaluations) {
      if (!evaluation.shouldTrigger || !evaluation.station) {
        continue;
      }

      try {
        // Create notification content
        const notification = createAlertNotification(
          evaluation.station.name,
          evaluation.station.brand,
          evaluation.station.pricePerLitre,
          evaluation.priceDrop!,
          evaluation.station.stationId
        );

        // Send push notification
        await sendPushNotification(rule.userId, notification);

        // Update lastTriggeredAt and lastNotifiedPrice
        await updateLastTriggered(
          rule.id,
          evaluation.currentPrice!
        );

        sentCount++;
      } catch (error) {
        const errorMsg = `Failed to process alert ${rule.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const finishedAt = new Date();
    const status = errors.length === 0 ? 'success' : 'failed';

    // Record alert_runs metadata
    await prisma.alertRun.create({
      data: {
        startedAt,
        finishedAt,
        status,
        sentCount,
        errorSummary: errors.length > 0 ? errors : undefined,
      },
    });

    // Return result
    return NextResponse.json(
      {
        status,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        sentCount,
        evaluatedCount: evaluations.length,
        errorSummary: errors.length > 0 ? errors : undefined,
      },
      { status: status === 'success' ? 200 : 500 }
    );
  } catch (error) {
    console.error('Alert run cron error:', error);

    const finishedAt = new Date();

    // Record failed run
    try {
      await prisma.alertRun.create({
        data: {
          startedAt,
          finishedAt,
          status: 'failed',
          sentCount,
          errorSummary: [error instanceof Error ? error.message : String(error)],
        },
      });
    } catch (dbError) {
      console.error('Failed to record alert run:', dbError);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
