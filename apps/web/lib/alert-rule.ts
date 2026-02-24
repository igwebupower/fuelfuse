// Alert rule services for FuelFuse
import { prisma } from './prisma';
import { AlertRule } from '@fuelfuse/shared';
import { createAlertRuleSchema } from '@fuelfuse/shared';
import { enforceAlertPermission } from './subscription';

/**
 * Create a new alert rule with all required parameters
 * Validates: Requirements 4.2
 */
export async function createAlertRule(
  userId: string,
  params: {
    centerPostcode?: string;
    lat?: number;
    lng?: number;
    radiusMiles: number;
    fuelType: 'petrol' | 'diesel';
    triggerType?: 'price_drop';
    thresholdPpl?: number;
    enabled?: boolean;
  }
): Promise<AlertRule> {
  // Check if user has Pro tier (alert creation is Pro only)
  await enforceAlertPermission(userId);

  // Validate input with Zod schema
  const validated = createAlertRuleSchema.parse(params);

  // Ensure either postcode or lat/lng is provided
  if (!validated.centerPostcode && (validated.lat === undefined || validated.lng === undefined)) {
    throw new Error('Either centerPostcode or lat/lng coordinates must be provided');
  }

  // Create alert rule
  const alertRule = await prisma.alertRule.create({
    data: {
      userId,
      centerPostcode: validated.centerPostcode,
      lat: validated.lat,
      lng: validated.lng,
      radiusMiles: validated.radiusMiles,
      fuelType: validated.fuelType,
      triggerType: validated.triggerType || 'price_drop',
      thresholdPpl: validated.thresholdPpl || 2,
      enabled: validated.enabled !== false,
    },
  });

  return mapAlertRuleToDTO(alertRule);
}

/**
 * Get a specific alert rule by ID
 */
export async function getAlertRule(ruleId: string): Promise<AlertRule | null> {
  const alertRule = await prisma.alertRule.findUnique({
    where: { id: ruleId },
  });

  if (!alertRule) {
    return null;
  }

  return mapAlertRuleToDTO(alertRule);
}

/**
 * Get all alert rules for a user
 */
export async function getAlertRulesForUser(userId: string): Promise<AlertRule[]> {
  const alertRules = await prisma.alertRule.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return alertRules.map(mapAlertRuleToDTO);
}

/**
 * Update an alert rule
 */
export async function updateAlertRule(
  ruleId: string,
  params: {
    centerPostcode?: string;
    lat?: number;
    lng?: number;
    radiusMiles?: number;
    fuelType?: 'petrol' | 'diesel';
    triggerType?: 'price_drop';
    thresholdPpl?: number;
    enabled?: boolean;
  }
): Promise<AlertRule> {
  // Get existing rule to verify it exists
  const existing = await prisma.alertRule.findUnique({
    where: { id: ruleId },
  });

  if (!existing) {
    throw new Error('Alert rule not found');
  }

  // Build update data with only provided fields
  const updateData: any = {};

  if (params.centerPostcode !== undefined) {
    updateData.centerPostcode = params.centerPostcode;
  }
  if (params.lat !== undefined) {
    updateData.lat = params.lat;
  }
  if (params.lng !== undefined) {
    updateData.lng = params.lng;
  }
  if (params.radiusMiles !== undefined) {
    updateData.radiusMiles = params.radiusMiles;
  }
  if (params.fuelType !== undefined) {
    updateData.fuelType = params.fuelType;
  }
  if (params.triggerType !== undefined) {
    updateData.triggerType = params.triggerType;
  }
  if (params.thresholdPpl !== undefined) {
    updateData.thresholdPpl = params.thresholdPpl;
  }
  if (params.enabled !== undefined) {
    updateData.enabled = params.enabled;
  }

  // Update alert rule
  const updated = await prisma.alertRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  return mapAlertRuleToDTO(updated);
}

/**
 * Delete an alert rule
 */
export async function deleteAlertRule(ruleId: string): Promise<void> {
  await prisma.alertRule.delete({
    where: { id: ruleId },
  });
}

/**
 * Get all enabled alert rules (for alert job)
 */
export async function getEnabledAlertRules(): Promise<AlertRule[]> {
  const alertRules = await prisma.alertRule.findMany({
    where: { enabled: true },
    include: { user: true },
  });

  return alertRules.map(mapAlertRuleToDTO);
}

/**
 * Update last triggered timestamp for an alert rule
 */
export async function updateLastTriggered(ruleId: string, price: number): Promise<void> {
  await prisma.alertRule.update({
    where: { id: ruleId },
    data: {
      lastTriggeredAt: new Date(),
      lastNotifiedPrice: price,
    },
  });
}

/**
 * Map Prisma AlertRule to DTO
 */
function mapAlertRuleToDTO(rule: any): AlertRule {
  return {
    id: rule.id,
    userId: rule.userId,
    centerPostcode: rule.centerPostcode || undefined,
    lat: rule.lat !== null && rule.lat !== undefined ? rule.lat : undefined,
    lng: rule.lng !== null && rule.lng !== undefined ? rule.lng : undefined,
    radiusMiles: rule.radiusMiles,
    fuelType: rule.fuelType as 'petrol' | 'diesel',
    triggerType: rule.triggerType as 'price_drop',
    thresholdPpl: rule.thresholdPpl,
    enabled: rule.enabled,
    lastTriggeredAt: rule.lastTriggeredAt || undefined,
    lastNotifiedPrice: rule.lastNotifiedPrice || undefined,
  };
}
