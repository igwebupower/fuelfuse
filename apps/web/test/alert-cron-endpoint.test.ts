// Feature: fuelfuse-mvp, Task 19: Alert cron endpoint
// Validates: Requirements 4.3, 4.8

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { POST } from '../app/api/cron/alert-run/route';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';

// Mock the alert evaluation and push notification services
vi.mock('../lib/alert-evaluation', () => ({
  evaluateAllAlerts: vi.fn(),
}));

vi.mock('../lib/push-notification', () => ({
  sendPushNotification: vi.fn(),
  createAlertNotification: vi.fn((name, brand, price, drop, id) => ({
    title: `Fuel Price Drop Alert! 🚗`,
    body: `${brand} ${name} now at £${(price / 100).toFixed(2)}/L (down ${Math.round(drop)}p)`,
    data: { stationId: id, newPrice: price, priceDrop: drop },
  })),
}));

vi.mock('../lib/alert-rule', () => ({
  updateLastTriggered: vi.fn(),
}));

import { evaluateAllAlerts } from '../lib/alert-evaluation';
import { sendPushNotification } from '../lib/push-notification';
import { updateLastTriggered } from '../lib/alert-rule';

describe('Alert Cron Endpoint Tests', () => {
  const VALID_SECRET = 'test-cron-secret-12345';
  
  beforeEach(() => {
    process.env.CRON_SECRET = VALID_SECRET;
    vi.clearAllMocks();
  });

  test('Requirement 4.8: Alert cron endpoint requires x-cron-secret authentication', async () => {
    // Create request without secret
    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  test('Requirement 4.8: Alert cron endpoint accepts valid x-cron-secret', async () => {
    // Mock no alerts to trigger
    vi.mocked(evaluateAllAlerts).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(evaluateAllAlerts).toHaveBeenCalledOnce();
  });

  test('Requirement 4.3: Alert cron calls evaluateAllAlerts service', async () => {
    // Mock no alerts to trigger
    vi.mocked(evaluateAllAlerts).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    await POST(request);

    // Verify evaluateAllAlerts was called
    expect(evaluateAllAlerts).toHaveBeenCalledOnce();
  });

  test('Requirement 4.3: Alert cron sends notifications for triggered alerts', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        clerkUserId: 'test-user-alert-cron',
        email: 'test@example.com',
      },
    });

    // Create test alert rule
    const alertRule = await prisma.alertRule.create({
      data: {
        userId: user.id,
        centerPostcode: 'SW1A 1AA',
        radiusMiles: 5,
        fuelType: 'petrol',
        thresholdPpl: 2,
        enabled: true,
        lastNotifiedPrice: 150,
      },
    });

    // Mock alert evaluation with triggered alert
    vi.mocked(evaluateAllAlerts).mockResolvedValue([
      {
        rule: {
          id: alertRule.id,
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          lat: null,
          lng: null,
          radiusMiles: 5,
          fuelType: 'petrol',
          triggerType: 'price_drop',
          thresholdPpl: 2,
          enabled: true,
          lastTriggeredAt: null,
          lastNotifiedPrice: 150,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        evaluation: {
          shouldTrigger: true,
          currentPrice: 145,
          priceDrop: 5,
          station: {
            stationId: 'station-123',
            name: 'Test Station',
            brand: 'Shell',
            address: '123 Test St',
            pricePerLitre: 145,
          },
        },
      },
    ]);

    vi.mocked(sendPushNotification).mockResolvedValue([{ status: 'ok', id: 'ticket-123' }]);
    vi.mocked(updateLastTriggered).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify notification was sent
    expect(sendPushNotification).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        title: expect.stringContaining('Fuel Price Drop Alert'),
        body: expect.stringContaining('Shell'),
      })
    );

    // Verify lastTriggeredAt was updated
    expect(updateLastTriggered).toHaveBeenCalledWith(alertRule.id, 145);

    // Verify response
    expect(response.status).toBe(200);
    expect(data.status).toBe('success');
    expect(data.sentCount).toBe(1);
    expect(data.evaluatedCount).toBe(1);
  });

  test('Alert cron records alert_runs metadata on success', async () => {
    // Mock no alerts to trigger
    vi.mocked(evaluateAllAlerts).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    await POST(request);

    // Verify alert_runs record was created
    const alertRuns = await prisma.alertRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 1,
    });

    expect(alertRuns).toHaveLength(1);
    expect(alertRuns[0].status).toBe('success');
    expect(alertRuns[0].sentCount).toBe(0);
    expect(alertRuns[0].startedAt).toBeInstanceOf(Date);
    expect(alertRuns[0].finishedAt).toBeInstanceOf(Date);
  });

  test('Alert cron records alert_runs metadata with sentCount', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        clerkUserId: 'test-user-alert-cron-2',
        email: 'test2@example.com',
      },
    });

    // Mock alert evaluation with 2 triggered alerts
    vi.mocked(evaluateAllAlerts).mockResolvedValue([
      {
        rule: {
          id: 'rule-1',
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          lat: null,
          lng: null,
          radiusMiles: 5,
          fuelType: 'petrol',
          triggerType: 'price_drop',
          thresholdPpl: 2,
          enabled: true,
          lastTriggeredAt: null,
          lastNotifiedPrice: 150,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        evaluation: {
          shouldTrigger: true,
          currentPrice: 145,
          priceDrop: 5,
          station: {
            stationId: 'station-123',
            name: 'Test Station',
            brand: 'Shell',
            address: '123 Test St',
            pricePerLitre: 145,
          },
        },
      },
      {
        rule: {
          id: 'rule-2',
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          lat: null,
          lng: null,
          radiusMiles: 5,
          fuelType: 'diesel',
          triggerType: 'price_drop',
          thresholdPpl: 2,
          enabled: true,
          lastTriggeredAt: null,
          lastNotifiedPrice: 160,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        evaluation: {
          shouldTrigger: true,
          currentPrice: 155,
          priceDrop: 5,
          station: {
            stationId: 'station-456',
            name: 'Test Station 2',
            brand: 'BP',
            address: '456 Test Ave',
            pricePerLitre: 155,
          },
        },
      },
    ]);

    vi.mocked(sendPushNotification).mockResolvedValue([{ status: 'ok', id: 'ticket-123' }]);
    vi.mocked(updateLastTriggered).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(200);
    expect(data.sentCount).toBe(2);

    // Verify alert_runs record
    const alertRuns = await prisma.alertRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 1,
    });

    expect(alertRuns[0].sentCount).toBe(2);
    expect(alertRuns[0].status).toBe('success');
  });

  test('Alert cron handles notification errors gracefully', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        clerkUserId: 'test-user-alert-cron-3',
        email: 'test3@example.com',
      },
    });

    // Mock alert evaluation with triggered alert
    vi.mocked(evaluateAllAlerts).mockResolvedValue([
      {
        rule: {
          id: 'rule-1',
          userId: user.id,
          centerPostcode: 'SW1A 1AA',
          lat: null,
          lng: null,
          radiusMiles: 5,
          fuelType: 'petrol',
          triggerType: 'price_drop',
          thresholdPpl: 2,
          enabled: true,
          lastTriggeredAt: null,
          lastNotifiedPrice: 150,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        evaluation: {
          shouldTrigger: true,
          currentPrice: 145,
          priceDrop: 5,
          station: {
            stationId: 'station-123',
            name: 'Test Station',
            brand: 'Shell',
            address: '123 Test St',
            pricePerLitre: 145,
          },
        },
      },
    ]);

    // Mock notification failure
    vi.mocked(sendPushNotification).mockRejectedValue(new Error('Push notification failed'));

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify error was handled
    expect(response.status).toBe(500);
    expect(data.status).toBe('failed');
    expect(data.sentCount).toBe(0);
    expect(data.errorSummary).toBeDefined();
    expect(data.errorSummary).toHaveLength(1);

    // Verify alert_runs record with error
    const alertRuns = await prisma.alertRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 1,
    });

    expect(alertRuns[0].status).toBe('failed');
    expect(alertRuns[0].sentCount).toBe(0);
    expect(alertRuns[0].errorSummary).toBeDefined();
  });

  test('Alert cron skips alerts that should not trigger', async () => {
    // Mock alert evaluation with non-triggered alert
    vi.mocked(evaluateAllAlerts).mockResolvedValue([
      {
        rule: {
          id: 'rule-1',
          userId: 'user-1',
          centerPostcode: 'SW1A 1AA',
          lat: null,
          lng: null,
          radiusMiles: 5,
          fuelType: 'petrol',
          triggerType: 'price_drop',
          thresholdPpl: 2,
          enabled: true,
          lastTriggeredAt: null,
          lastNotifiedPrice: 150,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        evaluation: {
          shouldTrigger: false,
          reason: 'Price drop does not meet threshold',
        },
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/cron/alert-run', {
      method: 'POST',
      headers: {
        'x-cron-secret': VALID_SECRET,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify no notifications were sent
    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(updateLastTriggered).not.toHaveBeenCalled();
    expect(data.sentCount).toBe(0);
    expect(data.status).toBe('success');
  });
});
