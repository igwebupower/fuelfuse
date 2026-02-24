// Alert evaluation service for FuelFuse
// Evaluates alert rules and determines when to trigger notifications
// Requirements: 4.3, 4.5, 4.6, 4.7

import { prisma } from './prisma';
import { AlertRule } from '@fuelfuse/shared';
import { searchByPostcode, searchByCoordinates } from './search';
import { geocodePostcode } from './geocoding';
import { getEnabledAlertRules, updateLastTriggered } from './alert-rule';

export interface AlertEvaluation {
  shouldTrigger: boolean;
  currentPrice?: number;
  priceDrop?: number;
  station?: {
    stationId: string;
    name: string;
    brand: string;
    address: string;
    pricePerLitre: number;
  };
  reason?: string;
}

/**
 * Evaluate a single alert rule to determine if it should trigger
 * Requirements: 4.3, 4.5, 4.6, 4.7
 * 
 * @param rule - The alert rule to evaluate
 * @returns Evaluation result with trigger decision and details
 */
export async function evaluateAlertRule(rule: AlertRule): Promise<AlertEvaluation> {
  // Skip disabled rules (Requirement 4.7)
  if (!rule.enabled) {
    return { shouldTrigger: false, reason: 'Alert rule is disabled' };
  }

  // Check 24-hour cooldown (Requirement 4.5)
  if (rule.lastTriggeredAt) {
    const hoursSinceLastTrigger = 
      (Date.now() - rule.lastTriggeredAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastTrigger < 24) {
      return { shouldTrigger: false, reason: 'Alert is in 24-hour cooldown period' };
    }
  }

  // Find cheapest station within alert rule radius
  let searchResults;
  
  if (rule.centerPostcode) {
    // Search by postcode
    searchResults = await searchByPostcode({
      postcode: rule.centerPostcode,
      radiusMiles: rule.radiusMiles,
      fuelType: rule.fuelType,
    });
  } else if (rule.lat !== undefined && rule.lng !== undefined) {
    // Search by coordinates
    searchResults = await searchByCoordinates({
      lat: rule.lat,
      lng: rule.lng,
      radiusMiles: rule.radiusMiles,
      fuelType: rule.fuelType,
    });
  } else {
    // Invalid rule configuration
    return { shouldTrigger: false, reason: 'Invalid alert rule configuration' };
  }

  // No stations found
  if (searchResults.length === 0) {
    return { shouldTrigger: false, reason: 'No stations found within radius' };
  }

  // Get cheapest station (results are already sorted by price)
  const cheapestStation = searchResults[0];
  const currentPrice = cheapestStation.pricePerLitre;

  // If no previous price, don't trigger (need baseline)
  if (rule.lastNotifiedPrice === null || rule.lastNotifiedPrice === undefined) {
    return { 
      shouldTrigger: false,
      currentPrice,
      reason: 'No previous price available for comparison',
    };
  }

  // Calculate price drop
  const priceDrop = rule.lastNotifiedPrice - currentPrice;

  // Check if price drop meets threshold (Requirement 4.3)
  if (priceDrop >= rule.thresholdPpl) {
    return {
      shouldTrigger: true,
      currentPrice,
      priceDrop,
      station: {
        stationId: cheapestStation.stationId,
        name: cheapestStation.name,
        brand: cheapestStation.brand,
        address: cheapestStation.address,
        pricePerLitre: currentPrice,
      },
    };
  }

  // Price drop doesn't meet threshold
  return {
    shouldTrigger: false,
    currentPrice,
    priceDrop,
    reason: 'Price drop does not meet threshold',
  };
}

/**
 * Check if user has exceeded daily alert limit (2 per day)
 * Requirements: 4.6
 * 
 * @param userId - User ID to check
 * @returns True if user has exceeded limit
 */
export async function hasExceededDailyLimit(userId: string): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Count alerts triggered in last 24 hours for this user
  const recentAlerts = await prisma.alertRule.count({
    where: {
      userId,
      lastTriggeredAt: {
        gte: twentyFourHoursAgo,
      },
    },
  });

  return recentAlerts >= 2;
}

/**
 * Evaluate all enabled alert rules and return those that should trigger
 * Enforces rate limiting (2 alerts per day per user)
 * Requirements: 4.3, 4.5, 4.6, 4.7
 * 
 * @returns Array of alert rules with evaluation results
 */
export async function evaluateAllAlerts(): Promise<Array<{
  rule: AlertRule;
  evaluation: AlertEvaluation;
}>> {
  // Get all enabled alert rules
  const enabledRules = await getEnabledAlertRules();

  const results: Array<{
    rule: AlertRule;
    evaluation: AlertEvaluation;
  }> = [];

  // Track alerts per user to enforce daily limit
  const userAlertCounts = new Map<string, number>();

  for (const rule of enabledRules) {
    // Check if user has exceeded daily limit
    const currentCount = userAlertCounts.get(rule.userId) || 0;
    
    if (currentCount >= 2) {
      // User has already received 2 alerts in this run, skip
      results.push({
        rule,
        evaluation: { shouldTrigger: false },
      });
      continue;
    }

    // Check if user has exceeded daily limit from previous runs
    const exceededLimit = await hasExceededDailyLimit(rule.userId);
    
    if (exceededLimit) {
      results.push({
        rule,
        evaluation: { shouldTrigger: false },
      });
      continue;
    }

    // Evaluate the alert rule
    const evaluation = await evaluateAlertRule(rule);

    results.push({
      rule,
      evaluation,
    });

    // If alert should trigger, increment user's count
    if (evaluation.shouldTrigger) {
      userAlertCounts.set(rule.userId, currentCount + 1);
    }
  }

  return results;
}
